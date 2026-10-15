"""
camera-agent/agent.py
VitalCare Local Camera Agent — HTTP Service

Zero-dependency Python HTTP server bound strictly to 127.0.0.1:8000.
Exposes REST endpoints:
  - GET  /health   : Health check endpoint
  - GET  /discover : Triggers UDP WS-Discovery scan
  - POST /detect   : Executes multi-stage camera probe (ONVIF + RTSP SDP verification)
"""

import http.server
import json
import re
import urllib.parse
import sys
import os

# Add local path to sys.path so discovery import works seamlessly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from discovery import discover_cameras, probe_camera_detailed, sanitize_uri

HOST = '127.0.0.1'
PORT = 8000

ALLOWED_ORIGIN_PATTERNS = [
    r'^http://localhost:\d+$',
    r'^http://127\.0\.0\.1:\d+$',
    r'^https?://.*\.vercel\.app$',
    r'^https?://.*vitalcare.*$'
]


def is_origin_allowed(origin):
    if not origin:
        return True
    for pattern in ALLOWED_ORIGIN_PATTERNS:
        if re.match(pattern, origin, re.IGNORECASE):
            return True
    return False


class CameraAgentRequestHandler(http.server.BaseHTTPRequestHandler):

    def _send_cors_headers(self):
        origin = self.headers.get('Origin')
        if origin and is_origin_allowed(origin):
            self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Access-Control-Allow-Credentials', 'true')
        else:
            # Default fallback for local dev
            self.send_header('Access-Control-Allow-Origin', 'http://localhost:5173')

        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def _send_json_response(self, status_code, data):
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self._send_cors_headers()
        self.end_headers()
        response_bytes = json.dumps(data, indent=2).encode('utf-8')
        self.wfile.write(response_bytes)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path in ('', '/health', '/status'):
            self._send_json_response(200, {
                "status": "online",
                "agent": "VitalCare Local Camera Agent",
                "version": "1.0.0",
                "bound": f"{HOST}:{PORT}"
            })
            return

        if path == '/discover':
            print("[Agent] Initiating ONVIF WS-Discovery scan...")
            devices = discover_cameras(timeout=3.0)
            print(f"[Agent] Discovery complete. Found {len(devices)} device(s).")
            self._send_json_response(200, {
                "success": True,
                "count": len(devices),
                "devices": devices
            })
            return

        self._send_json_response(404, {"error": "Endpoint not found"})

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path.rstrip('/')

        if path == '/discover':
            devices = discover_cameras(timeout=3.0)
            self._send_json_response(200, {
                "success": True,
                "count": len(devices),
                "devices": devices
            })
            return

        if path in ('/detect', '/probe'):
            content_length = int(self.headers.get('Content-Length', 0))
            body_bytes = self.rfile.read(content_length)
            
            try:
                payload = json.loads(body_bytes.decode('utf-8'))
            except Exception:
                self._send_json_response(400, {"error": "Invalid JSON payload"})
                return

            ip = payload.get('ip') or payload.get('ipAddress')
            username = payload.get('username', 'admin')
            password = payload.get('password', '')
            port = int(payload.get('port', 554))
            onvif_port = int(payload.get('onvifPort', payload.get('port', 80)))
            custom_path = payload.get('customRtspPath', '')

            if not ip:
                self._send_json_response(400, {"error": "Missing required field: ip"})
                return

            # Sanitize log print — NEVER print passwords or raw credentials!
            print(f"[Agent] Testing camera at IP: {ip} (ONVIF Port: {onvif_port}, RTSP Port: {port})")

            diag_result = probe_camera_detailed(
                ip=ip,
                username=username,
                password=password,
                port=port,
                onvif_port=onvif_port,
                custom_rtsp_path=custom_path
            )

            # Sanitize response stream URI before returning
            if diag_result.get('streamUri'):
                diag_result['streamUri'] = sanitize_uri(diag_result['streamUri'])

            print(f"[Agent] Camera {ip} probe result: success={diag_result['success']}, stage={diag_result['stage']}")
            self._send_json_response(200, diag_result)
            return

        self._send_json_response(404, {"error": "Endpoint not found"})

    def log_message(self, format, *args):
        # Override default logger to prevent accidental credential leaking
        msg = format % args
        if 'password' not in msg.lower():
            sys.stdout.write(f"[Agent Server] {msg}\n")


def run_agent(host=HOST, port=PORT):
    server = http.server.HTTPServer((host, port), CameraAgentRequestHandler)
    print("\n" + "="*60)
    print(f"  VitalCare Local Camera Agent")
    print(f"  Server listening strictly on http://{host}:{port}")
    print(f"  CORS enabled for localhost and Vercel domains")
    print("="*60 + "\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Agent] Shutting down Local Camera Agent...")
        server.server_close()


if __name__ == '__main__':
    run_agent()
