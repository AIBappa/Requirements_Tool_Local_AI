# Pipeline Author — LLM-Assisted Software Development

A local desktop tool for authoring software requirements using LLMs. Supports local models via Ollama and cloud APIs (Anthropic, OpenAI, Gemini, Azure).

## Getting Started

### Option 1: Local Use (Laptop)

1. **Open PowerShell** in the `Code\` directory:
   ```
   cd Code
   ```

2. **Start the server**:
   ```
   python server.py
   ```
   This replaces the old `python -m http.server` command. It serves the web app, proxies Ollama API calls (so you can access from any device), and manages sessions on disk.

3. **Open the app** in your browser:
   ```
   http://localhost:8080/
   ```

4. **Configure your AI provider**:  
   Click **"Connection Setup"** in the sidebar and choose one of:
   - **Local (Ollama)** — for running LLMs on your machine
   - **Anthropic** — Claude models via API key
   - **OpenAI** — GPT models via API key
   - **Gemini** — Google Gemini models via API key
   - **Azure** — Azure OpenAI via API key and endpoint

   Also note: https://freellm.net/providers/ - this contains list of free LLM providers.

### Option 2: Access from Phone via Cloudflare Tunnel

1. Run `python server.py` on your laptop (leave it running)
2. In a separate terminal, start Cloudflare Tunnel:
   ```
   cloudflared tunnel --url http://localhost:8080
   ```
   Download `cloudflared` from [developers.cloudflare.com](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) if you don't have it.
3. Cloudflare will give you a URL like `https://something.trycloudflare.com`
4. Open that URL on your phone — everything works because the server proxies Ollama calls

**No CORS issues, no separate browser, no extra config.** The phone just becomes another input device.

### Option 3: Deploy on Coolify / Hetzner

A `Coolify/Dockerfile` is included for easy deployment.

1. Push this repository to GitHub
2. In Coolify, create a new project and point it to your GitHub repo
3. Select "Dockerfile" as the build type and set the build path to `Coolify/`
4. Set the port to `80`
5. Coolify will build and serve the app with HTTPS

For Ollama access from a remote server, use Tailscale (free) to connect your laptop to the server.

## Sessions

The app now supports **multiple pipeline sessions** stored on the server:

- **Create sessions** — each session tracks its own pipeline progress
- **Resume anywhere** — work on your laptop, then open the same session from your phone
- **Auto-save** — every change is saved to the server automatically
- **Session list** — when you open the app, you'll see all your sessions

## Files

| File | Purpose |
|---|---|
| `server.py` | Python backend — serves static files, proxies Ollama, manages sessions |
| `index.html` | Main application page |
| `app.js` | Application logic |
| `pipeline-config.js` | Pipeline stages and model configuration |
| `styles.css` | Styling |
| `Coolify/Dockerfile` | Docker configuration for Coolify deployment |

## Requirements

- **Python 3.x** — for the server
- **Ollama** — required only for local mode ([ollama.com](https://ollama.com))
- **API keys** — required only for cloud providers (Anthropic / OpenAI / Gemini / Azure)
- **cloudflared** — optional, for remote access via Cloudflare Tunnel

## Pipeline Stages

The tool guides you through 9 stages of software requirements authoring:

1. Product Requirements Document (PRD)
2. System Requirements Specification (SRS / FRS)
3. Requirements Validation Gate
4. Software Requirements Document (Architecture + Contracts)
5. Security & Architecture Validation Gate
6. SDD + Atomic Task Generation
7. Task Validation Gate
8. Local Task-by-Task Code Generation
9. Integration & Deployment Validation