#!/usr/bin/env python3
"""Quick test: call the server's PDF and DOCX export endpoints."""
import json
import http.client
import sys

def test_export(endpoint, expected_type):
    conn = http.client.HTTPConnection("localhost", 8080, timeout=15)
    payload = json.dumps({"stageData": {}, "pipelineDef": []})
    conn.request("POST", endpoint, payload, {"Content-Type": "application/json"})
    resp = conn.getresponse()
    data = resp.read()
    print(f"[{endpoint}] Status: {resp.status}, Size: {len(data)} bytes, Type: {resp.getheader('Content-Type')}")
    if resp.status == 200:
        print(f"  First 50 bytes: {data[:50]}")
    else:
        body = data.decode("utf-8", errors="replace")
        print(f"  Error: {body[:200]}")
    conn.close()
    return resp.status == 200

if __name__ == "__main__":
    pdf_ok = test_export("/api/export/pdf", "application/pdf")
    docx_ok = test_export("/api/export/docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    
    if pdf_ok and docx_ok:
        print("\n✓ Both endpoints working!")
        sys.exit(0)
    else:
        print("\n✗ Some endpoints failed")
        sys.exit(1)