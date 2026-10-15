"""
scratch/test_mock_camera.py
Unit test for VitalCare Local Camera Agent diagnostic stage progression.
"""

import sys
import os
import http.server
import socket
import threading
import json
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'camera-agent'))
from discovery import probe_camera_detailed, build_ws_security_header, test_rtsp_stream_protocol

# 1. Test WS-Security UsernameToken header builder
sec_header = build_ws_security_header("admin", "password123")
assert "<wsse:Username>admin</wsse:Username>" in sec_header
assert "PasswordDigest" in sec_header
assert "Nonce" in sec_header
assert "Created" in sec_header
print("[Test] WS-Security UsernameToken Header Generator: PASSED")

# 2. Test mock RTSP server
def run_mock_rtsp():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind(('127.0.0.1', 18554))
    sock.listen(5)
    sock.settimeout(3.0)

    try:
        start = time.time()
        while time.time() - start < 4.0:
            try:
                conn, _ = sock.accept()
                conn.settimeout(2.0)
                while True:
                    req = conn.recv(4096).decode('utf-8', errors='ignore')
                    if not req:
                        break
                    if "OPTIONS" in req:
                        conn.sendall(b"RTSP/1.0 200 OK\r\nCSeq: 1\r\nPublic: OPTIONS, DESCRIBE, SETUP, PLAY\r\n\r\n")
                    elif "DESCRIBE" in req:
                        sdp = (
                            "v=0\r\n"
                            "o=- 1600000000 1 IN IP4 127.0.0.1\r\n"
                            "s=VitalCare Mock Stream\r\n"
                            "m=video 0 RTP/AVP 96\r\n"
                            "a=rtpmap:96 H264/90000\r\n"
                        )
                        resp = f"RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Type: application/sdp\r\nContent-Length: {len(sdp)}\r\n\r\n{sdp}"
                        conn.sendall(resp.encode('utf-8'))
                conn.close()
            except socket.timeout:
                continue
    finally:
        sock.close()

rtsp_thread = threading.Thread(target=run_mock_rtsp, daemon=True)
rtsp_thread.start()
time.sleep(0.5)

res = test_rtsp_stream_protocol("127.0.0.1", 18554, "rtsp://127.0.0.1:18554/live", "admin", "password")
assert res["port_reachable"] is True
assert res["protocol_responding"] is True
assert res["sdp_available"] is True
assert res["has_video_track"] is True
print("[Test] RTSP Protocol Test (OPTIONS -> DESCRIBE -> SDP m=video): PASSED")
print("\nAll unit tests passed successfully!")
