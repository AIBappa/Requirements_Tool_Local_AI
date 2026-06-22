#!/usr/bin/env python3
"""
Pipeline Author Server

Serves the static frontend, proxies Ollama API calls, and manages pipeline sessions
persisted on disk so you can resume work from any device.

Usage:
    python server.py
    # Then open http://localhost:8080

With Cloudflare Tunnel (access from phone):
    cloudflared tunnel --url http://localhost:8080
    # Then open the generated *.trycloudflare.com URL on your phone
"""

import http.server
import json
import os
import re
import shutil
import time
import urllib.request
import uuid
from pathlib import Path
from urllib.parse import urlparse

# ─── Configuration ───

PORT = 8080
OLLAMA_BASE = "http://localhost:11434"
NVIDIA_BASE = "https://integrate.api.nvidia.com/v1"
SESSIONS_DIR = Path(__file__).parent / "sessions"
STATIC_DIR = Path(__file__).parent
CONFIG_FILE = SESSIONS_DIR / "config.json"

# Ensure directories exist
SESSIONS_DIR.mkdir(exist_ok=True)

def load_server_config():
    if CONFIG_FILE.exists():
        try:
            return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return {"exportsDir": os.environ.get("PIPELINE_EXPORTS_DIR", "saved_exports")}

def resolve_exports_dir(config):
    raw = config.get("exportsDir", "saved_exports")
    if not raw:
        raw = "saved_exports"
    p = Path(raw)
    if raw.startswith("http://") or raw.startswith("https://"):
        return p  # URL, not a filesystem path
    if p.is_absolute():
        return p
    return STATIC_DIR / raw

def reload_exports_dir():
    global EXPORTS_DIR
    EXPORTS_DIR = resolve_exports_dir(load_server_config())


# ─── Session helpers ───

def list_sessions():
    """Return all sessions, newest first."""
    sessions = []
    for f in sorted(SESSIONS_DIR.glob("*.json"), key=os.path.getmtime, reverse=True):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            sessions.append({
                "id": data.get("id", f.stem),
                "name": data.get("name", "Untitled Session"),
                "description": data.get("description", ""),
                "createdAt": data.get("createdAt", ""),
                "updatedAt": data.get("updatedAt", ""),
                "currentStage": data.get("currentStage", 1),
                "completed": data.get("completed", 0),
                "totalStages": data.get("totalStages", 9),
            })
        except (json.JSONDecodeError, OSError):
            continue
    return sessions


def load_session(session_id):
    path = SESSIONS_DIR / f"{session_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_session(session_id, data):
    path = SESSIONS_DIR / f"{session_id}.json"
    data["id"] = session_id
    data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    return data


def delete_session(session_id):
    path = SESSIONS_DIR / f"{session_id}.json"
    if path.exists():
        path.unlink()
        return True
    return False


def create_session(data):
    session_id = str(uuid.uuid4())
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    session = {
        "id": session_id,
        "name": data.get("name", "New Session"),
        "description": data.get("description", ""),
        "createdAt": now,
        "updatedAt": now,
        "currentStage": 1,
        "totalStages": 9,
        "stageData": {},
    }
    save_session(session_id, session)
    return session


# ─── HTTP handler ───

class PipelineHandler(http.server.SimpleHTTPRequestHandler):
    """Custom handler that serves static files and API endpoints."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        # ── API: List sessions ──
        if path == "/api/sessions":
            self._send_json(list_sessions())
            return

        # ── API: Get a single session ──
        m = re.match(r"^/api/sessions/([a-f0-9\-]+)$", path)
        if m:
            session = load_session(m.group(1))
            if session is None:
                self.send_error(404, "Session not found")
            else:
                self._send_json(session)
            return

        # ── API: Get server config ──
        if path == "/api/config":
            cfg = load_server_config()
            cfg["exportsDirResolved"] = str(EXPORTS_DIR)
            self._send_json(cfg)
            return

        # ── API: List exports ──
        if path == "/api/exports":
            exports_dir_str = str(EXPORTS_DIR)
            if exports_dir_str.startswith("http://") or exports_dir_str.startswith("https://"):
                self._send_json([])
                return
            exports = []
            for f in sorted(EXPORTS_DIR.glob("*.json"), key=os.path.getmtime, reverse=True):
                try:
                    data = json.loads(f.read_text(encoding="utf-8"))
                    exports.append({
                        "fileName": f.name,
                        "timestamp": data.get("exportedAt", ""),
                        "sessionId": data.get("sessionId", ""),
                        "size": f.stat().st_size,
                        "stagesCompleted": data.get("stagesCompleted", 0),
                        "totalManualInputs": data.get("totalManualInputs", 0),
                    })
                except (json.JSONDecodeError, OSError):
                    continue
            self._send_json(exports)
            return

        # ── API: Download / view a specific export ──
        m = re.match(r"^/api/exports/([^/]+)$", path)
        if m:
            filename = m.group(1)
            exports_dir_str = str(EXPORTS_DIR)
            if exports_dir_str.startswith("http://") or exports_dir_str.startswith("https://"):
                self.send_error(501, "Remote URL mode: cannot download from remote storage")
                return
            filepath = EXPORTS_DIR / filename
            if not filepath.exists() or not filepath.is_file():
                self.send_error(404, "Export not found")
                return
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(filepath.stat().st_size))
            self.end_headers()
            with open(filepath, "rb") as f:
                self.wfile.write(f.read())
            return

        # ── Ollama proxy ──
        m = re.match(r"^/api/ollama/(.+)$", path)
        if m:
            self._proxy_ollama(m.group(1))
            return

        # ── Static files ──
        # Rewrite root to index.html for SPA
        if path == "" or path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        # ── API: Create session ──
        if path == "/api/sessions":
            data = self._read_body()
            session = create_session(data)
            self._send_json(session, status=201)
            return

        # ── API: Save export ──
        if path == "/api/exports":
            data = self._read_body()
            payload = data.get("data", {})
            payload["exportedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            exports_dir_str = str(EXPORTS_DIR)
            if exports_dir_str.startswith("http://") or exports_dir_str.startswith("https://"):
                # Remote URL mode: POST the export payload to the remote endpoint
                try:
                    req = urllib.request.Request(
                        exports_dir_str + "/" + data.get("fileName", f"export-{time.strftime('%Y-%m-%dT%H-%M-%S')}.json"),
                        data=json.dumps(payload).encode("utf-8"),
                        method="POST",
                        headers={"Content-Type": "application/json"},
                    )
                    with urllib.request.urlopen(req, timeout=15) as resp:
                        self._send_json(json.loads(resp.read()))
                except urllib.error.HTTPError as e:
                    self.send_error(502, f"Remote export failed: {e.reason}")
                except urllib.error.URLError as e:
                    self.send_error(502, f"Remote export unreachable: {e.reason}")
                except Exception as e:
                    self.send_error(500, f"Remote export error: {e}")
                return
            # Local filesystem mode
            filename = data.get("fileName", f"export-{time.strftime('%Y-%m-%dT%H-%M-%S')}.json")
            filepath = EXPORTS_DIR / filename
            try:
                EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
                filepath.write_text(json.dumps(payload, indent=2), encoding="utf-8")
                self._send_json({"fileName": filename, "saved": True})
            except OSError as e:
                self.send_error(500, f"Failed to save export: {e}")
            return

        # ── Ollama proxy (chat/completions) ──
        m = re.match(r"^/api/ollama/(.+)$", path)
        if m:
            self._proxy_ollama(m.group(1))
            return

        # ── NVIDIA NIM proxy ──
        if path == "/api/nvidia":
            self._proxy_nvidia()
            return

        self.send_error(404, "Not found")

    def do_PUT(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        m = re.match(r"^/api/sessions/([a-f0-9\-]+)$", path)
        if m:
            session_id = m.group(1)
            existing = load_session(session_id)
            if existing is None:
                self.send_error(404, "Session not found")
                return
            data = self._read_body()
            # Merge: keep existing fields if not provided
            existing.update(data)
            existing["id"] = session_id
            saved = save_session(session_id, existing)
            self._send_json(saved)
            return

        # ── API: Save server config ──
        if path == "/api/config":
            data = self._read_body()
            exports_dir = data.get("exportsDir", "saved_exports")
            config_data = {"exportsDir": exports_dir}
            try:
                CONFIG_FILE.write_text(json.dumps(config_data, indent=2), encoding="utf-8")
                reload_exports_dir()
                self._send_json({"saved": True, "exportsDir": exports_dir, "exportsDirResolved": str(EXPORTS_DIR)})
            except OSError as e:
                self.send_error(500, f"Failed to save config: {e}")
            return

        self.send_error(404, "Not found")

    def do_DELETE(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        m = re.match(r"^/api/sessions/([a-f0-9\-]+)$", path)
        if m:
            if delete_session(m.group(1)):
                self._send_json({"deleted": True})
            else:
                self.send_error(404, "Session not found")
            return

        # ── API: Delete export ──
        m = re.match(r"^/api/exports/([^/]+)$", path)
        if m:
            filepath = EXPORTS_DIR / m.group(1)
            if filepath.exists() and filepath.is_file():
                filepath.unlink()
                self._send_json({"deleted": True})
            else:
                self.send_error(404, "Export not found")
            return

        self.send_error(404, "Not found")

    # ─── Helpers ───

    def _send_json(self, data, status=200):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self):
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {}

    def _proxy_ollama(self, ollama_path):
        """Forward a request to Ollama and return its response."""
        target_url = f"{OLLAMA_BASE}/api/{ollama_path}"
        body = self._read_body()
        method = self.command

        try:
            data = json.dumps(body).encode("utf-8") if body else None
            req = urllib.request.Request(
                target_url,
                data=data,
                method=method,
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                response_body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response_body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                # Forward any streaming headers if present
                content_type = resp.headers.get("Content-Type", "")
                if "stream" in content_type:
                    self.send_header("Content-Type", content_type)
                self.end_headers()
                self.wfile.write(response_body)
        except urllib.error.HTTPError as e:
            self.send_error(e.code, str(e.reason))
        except urllib.error.URLError as e:
            self.send_error(502, f"Ollama connection failed: {e.reason}")
        except Exception as e:
            self.send_error(500, f"Proxy error: {str(e)}")

    def _proxy_nvidia(self):
        """Forward a request to NVIDIA NIM and return its response."""
        body = self._read_body()
        api_key = body.pop("_apiKey", "")
        if not api_key:
            self.send_error(400, "Missing NVIDIA API key")
            return

        target_url = f"{NVIDIA_BASE}/chat/completions"

        try:
            data = json.dumps(body).encode("utf-8") if body else None
            req = urllib.request.Request(
                target_url,
                data=data,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
            )
            with urllib.request.urlopen(req, timeout=120) as resp:
                response_body = resp.read()
                self.send_response(resp.status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response_body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(response_body)
        except urllib.error.HTTPError as e:
            try:
                err_body = e.read().decode("utf-8")
                self._send_json({"error": err_body}, status=e.code)
            except Exception:
                self.send_error(e.code, str(e.reason))
        except urllib.error.URLError as e:
            self.send_error(502, f"NVIDIA connection failed: {e.reason}")
        except Exception as e:
            self.send_error(500, f"NVIDIA proxy error: {str(e)}")

    def log_message(self, format, *args):
        """Quieter logging — only log API calls and errors."""
        msg = format % args
        if "/api/" in msg or "Error" in msg or "error" in msg:
            print(f"[{self.log_date_time_string()}] {msg}")


# ─── Entry point ───

server_config = load_server_config()
EXPORTS_DIR = resolve_exports_dir(server_config)

if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), PipelineHandler)
    print(f"🚀 Pipeline Author server running at http://localhost:{PORT}")
    print(f"📁 Sessions stored in: {SESSIONS_DIR}")
    print(f"📦 Exports stored in: {EXPORTS_DIR}")
    print(f"🔌 Ollama proxy: http://localhost:{PORT}/api/ollama/... → {OLLAMA_BASE}/api/...")
    print(f"🔌 NVIDIA NIM proxy: http://localhost:{PORT}/api/nvidia → {NVIDIA_BASE}/chat/completions")
    print()
    print("To expose via Cloudflare Tunnel:")
    print(f"    cloudflared tunnel --url http://localhost:{PORT}")
    print()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()