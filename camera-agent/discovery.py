"""
camera-agent/discovery.py
VitalCare Local Camera Agent — Discovery & Probe Engine

Zero-dependency Python module using only the standard library.
Handles:
  1. UDP Multicast WS-Discovery (239.255.255.250:3702)
  2. Multi-Port TCP & ICMP IP Reachability (80, 81, 443, 554, 8000, 8080, 8081, 8443, 8554, 8899, 9000, 34567)
  3. ONVIF WS-Security UsernameToken Authentication
  4. ONVIF Device Information, Capabilities, Profiles, and GetStreamUri
  5. Protocol-Level RTSP Validation (OPTIONS -> DESCRIBE -> SDP m=video)
  6. Unified Multi-Stage Camera Diagnostics with Precise Error Reporting
"""

import socket
import urllib.request
import urllib.parse
import urllib.error
import xml.etree.ElementTree as ET
import hashlib
import base64
import datetime
import secrets
import re
import json
import time
import threading
import subprocess
import platform

# ─── WS-Discovery Constants ──────────────────────────────────────────────────
WSD_MULTICAST_ADDR = '239.255.255.250'
WSD_PORT = 3702
WSD_PROBE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <soap:Header>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
    <wsa:MessageID>urn:uuid:{uuid}</wsa:MessageID>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
  </soap:Header>
  <soap:Body>
    <wsd:Probe>
      <wsd:Types>dn:NetworkVideoTransmitter</wsd:Types>
    </wsd:Probe>
  </soap:Body>
</soap:Envelope>"""

# Candidate camera service ports to scan for IP reachability
CANDIDATE_PORTS = [80, 81, 443, 554, 8000, 8080, 8081, 8443, 8554, 8899, 9000, 34567]


def check_icmp_ping(ip):
    """Checks whether host responds to ICMP echo ping."""
    param = '-n' if platform.system().lower() == 'windows' else '-c'
    timeout_param = '-w' if platform.system().lower() == 'windows' else '-W'
    cmd = ['ping', param, '1', timeout_param, '1000', ip]
    try:
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return res.returncode == 0
    except Exception:
        return False


# ─── WS-Discovery Scanner ─────────────────────────────────────────────────────
def discover_cameras(timeout=3.0):
    """
    Sends UDP multicast WS-Discovery probe to 239.255.255.250:3702.
    Collects ProbeMatch XML responses and parses XAddrs / IP addresses.
    Returns a list of discovered camera dicts.
    """
    discovered_devices = []
    seen_ips = set()

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.settimeout(timeout)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    except Exception:
        pass

    probe_id = secrets.token_hex(16)
    probe_msg = WSD_PROBE_XML.format(uuid=probe_id).encode('utf-8')

    try:
        sock.sendto(probe_msg, (WSD_MULTICAST_ADDR, WSD_PORT))
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                data, addr = sock.recvfrom(8192)
                sender_ip = addr[0]
                xml_str = data.decode('utf-8', errors='ignore')

                xaddr_match = re.search(r'http://([\d\.]+):?(\d+)?/onvif/device_service', xml_str, re.IGNORECASE)
                ip = xaddr_match.group(1) if xaddr_match else sender_ip
                onvif_port = int(xaddr_match.group(2)) if (xaddr_match and xaddr_match.group(2)) else 80

                if ip not in seen_ips and not ip.startswith('239.') and not ip.startswith('255.'):
                    seen_ips.add(ip)
                    discovered_devices.append({
                        'ip': ip,
                        'onvifPort': onvif_port,
                        'xaddr': f"http://{ip}:{onvif_port}/onvif/device_service",
                        'discoveredAt': datetime.datetime.now(datetime.timezone.utc).isoformat()
                    })
            except socket.timeout:
                break
            except Exception:
                continue
    finally:
        sock.close()

    return discovered_devices


# ─── ONVIF WS-Security Authentication Helper ─────────────────────────────────
def build_ws_security_header(username, password):
    """
    Generates authentic ONVIF WS-Security UsernameToken XML header.
    PasswordDigest = Base64( SHA-1( binary_nonce + created_str_utf8 + password_utf8 ) )
    """
    nonce_bytes = secrets.token_bytes(16)
    nonce_b64 = base64.b64encode(nonce_bytes).decode('ascii')
    
    now_utc = datetime.datetime.now(datetime.timezone.utc)
    created_str = now_utc.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + 'Z'

    sha1 = hashlib.sha1()
    sha1.update(nonce_bytes + created_str.encode('utf-8') + password.encode('utf-8'))
    digest_b64 = base64.b64encode(sha1.digest()).decode('ascii')

    return f"""<wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
  <wsse:UsernameToken>
    <wsse:Username>{username}</wsse:Username>
    <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">{digest_b64}</wsse:Password>
    <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">{nonce_b64}</wsse:Nonce>
    <wsu:Created>{created_str}</wsu:Created>
  </wsse:UsernameToken>
</wsse:Security>"""


def send_onvif_soap(endpoint_url, body_xml, username=None, password=None, timeout=5.0):
    """
    Sends SOAP POST request to ONVIF service endpoint.
    Includes WS-Security UsernameToken if credentials are provided.
    Returns (status_code, response_text).
    """
    sec_header = build_ws_security_header(username, password) if username and password else ""
    
    soap_envelope = f"""<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
               xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
               xmlns:tt="http://www.onvif.org/ver10/schema">
  <soap:Header>
    {sec_header}
  </soap:Header>
  <soap:Body>
    {body_xml}
  </soap:Body>
</soap:Envelope>"""

    headers = {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': str(len(soap_envelope.encode('utf-8')))
    }

    req = urllib.request.Request(endpoint_url, data=soap_envelope.encode('utf-8'), headers=headers, method='POST')

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode('utf-8', errors='ignore')
            return resp.status, body
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore') if e.fp else ""
        return e.code, body
    except Exception as e:
        return 0, str(e)


# ─── Protocol-Level RTSP Validation ───────────────────────────────────────────
def test_rtsp_stream_protocol(ip, port, stream_uri, username, password, timeout=4.0):
    """
    Performs protocol-level RTSP diagnostic test:
      1. TCP CONNECT to RTSP port
      2. RTSP OPTIONS request
      3. RTSP DESCRIBE request (with Digest/Basic authentication if challenged)
      4. Validates SDP response contains video track ('m=video')
    
    Returns dict with detailed diagnostic state.
    """
    res = {
        "port_reachable": False,
        "protocol_responding": False,
        "sdp_available": False,
        "has_video_track": False,
        "message": ""
    }

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((ip, port))
        res["port_reachable"] = True
    except Exception as e:
        res["message"] = f"RTSP port {port} unreachable: {str(e)}"
        return res

    try:
        options_req = f"OPTIONS {stream_uri} RTSP/1.0\r\nCSeq: 1\r\nUser-Agent: VitalCareAgent/1.0\r\n\r\n"
        sock.sendall(options_req.encode('utf-8'))
        resp = sock.recv(4096).decode('utf-8', errors='ignore')

        if "RTSP/1.0" in resp:
            res["protocol_responding"] = True
        else:
            res["message"] = "RTSP server did not return valid RTSP/1.0 response to OPTIONS"
            return res

        describe_req = f"DESCRIBE {stream_uri} RTSP/1.0\r\nCSeq: 2\r\nAccept: application/sdp\r\nUser-Agent: VitalCareAgent/1.0\r\n\r\n"
        sock.sendall(describe_req.encode('utf-8'))
        resp_desc = sock.recv(8192).decode('utf-8', errors='ignore')

        if "401 Unauthorized" in resp_desc or "401 " in resp_desc:
            auth_match = re.search(r'WWW-Authenticate:\s*(Basic|Digest)\s+(.*)', resp_desc, re.IGNORECASE)
            if auth_match and username and password:
                auth_type = auth_match.group(1).capitalize()
                auth_params = auth_match.group(2)

                auth_header_val = ""
                if auth_type == "Basic":
                    creds = base64.b64encode(f"{username}:{password}".encode('utf-8')).decode('ascii')
                    auth_header_val = f"Basic {creds}"
                elif auth_type == "Digest":
                    realm_m = re.search(r'realm="([^"]+)"', auth_params)
                    nonce_m = re.search(r'nonce="([^"]+)"', auth_params)
                    realm = realm_m.group(1) if realm_m else ""
                    nonce = nonce_m.group(1) if nonce_m else ""
                    
                    uri_path = stream_uri
                    ha1 = hashlib.md5(f"{username}:{realm}:{password}".encode('utf-8')).hexdigest()
                    ha2 = hashlib.md5(f"DESCRIBE:{uri_path}".encode('utf-8')).hexdigest()
                    response_hash = hashlib.md5(f"{ha1}:{nonce}:{ha2}".encode('utf-8')).hexdigest()

                    auth_header_val = f'Digest username="{username}", realm="{realm}", nonce="{nonce}", uri="{uri_path}", response="{response_hash}"'

                if auth_header_val:
                    describe_auth_req = f"DESCRIBE {stream_uri} RTSP/1.0\r\nCSeq: 3\r\nAuthorization: {auth_header_val}\r\nAccept: application/sdp\r\nUser-Agent: VitalCareAgent/1.0\r\n\r\n"
                    sock.sendall(describe_auth_req.encode('utf-8'))
                    resp_desc = sock.recv(8192).decode('utf-8', errors='ignore')

        if "200 OK" in resp_desc or "v=0" in resp_desc:
            res["sdp_available"] = True
            if "m=video" in resp_desc:
                res["has_video_track"] = True
                res["message"] = "RTSP stream verified with valid SDP video track"
            else:
                res["message"] = "SDP payload received but no video track (m=video) found"
        elif "401" in resp_desc:
            res["message"] = "RTSP authentication failed — invalid username/password"
        else:
            res["message"] = f"RTSP DESCRIBE request failed: {resp_desc.splitlines()[0] if resp_desc else 'No response'}"

    except socket.timeout:
        res["message"] = "RTSP protocol handshake timed out"
    except Exception as e:
        res["message"] = f"RTSP protocol test error: {str(e)}"
    finally:
        sock.close()

    return res


# ─── Unified Detailed Camera Probe ────────────────────────────────────────────
def probe_camera_detailed(ip, username, password, port=554, onvif_port=80, custom_rtsp_path=""):
    """
    Unified camera probe implementation for both automatic scan & manual IP entry.
    
    Diagnostic Stages:
      1. ip_reachability
      2. onvif_detection
      3. onvif_authentication
      4. media_profile
      5. rtsp_detection
      6. rtsp_test
    """
    stages = {
        "ip_reachability": {"status": "not_run", "message": ""},
        "onvif_detection": {"status": "not_run", "message": ""},
        "onvif_authentication": {"status": "not_run", "message": ""},
        "media_profile": {"status": "not_run", "message": ""},
        "rtsp_detection": {"status": "not_run", "message": ""},
        "rtsp_test": {"status": "not_run", "message": ""}
    }

    result = {
        "success": False,
        "ip": ip,
        "host_reachable": False,
        "open_ports": [],
        "onvif": False,
        "rtsp": False,
        "stage": "ip_reachability",
        "streamUri": None,
        "manufacturer": None,
        "model": None,
        "firmware": None,
        "message": "",
        "stages": stages
    }

    # ── Stage 1: ip_reachability & Service Port Scan ──────────────────────────
    ports_to_test = list(dict.fromkeys([onvif_port, port] + CANDIDATE_PORTS))
    open_ports_set = set()

    def scan_port_worker(p):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(0.6)
        try:
            s.connect((ip, p))
            s.close()
            open_ports_set.add(p)
        except Exception:
            pass

    threads = []
    for p in ports_to_test:
        t = threading.Thread(target=scan_port_worker, args=(p,))
        t.start()
        threads.append(t)

    for t in threads:
        t.join(timeout=1.0)

    open_ports = sorted(list(open_ports_set))
    icmp_ok = False
    if not open_ports:
        icmp_ok = check_icmp_ping(ip)

    host_reachable = len(open_ports) > 0 or icmp_ok
    result["host_reachable"] = host_reachable
    result["open_ports"] = open_ports

    if not host_reachable:
        stages["ip_reachability"] = {
            "status": "failed",
            "message": f"Host {ip} is completely unreachable (ICMP ping failed and no TCP service ports open)"
        }
        result["stage"] = "ip_reachability"
        result["message"] = f"Host {ip} is unreachable on the network"
        for st in ["onvif_detection", "onvif_authentication", "media_profile", "rtsp_detection", "rtsp_test"]:
            stages[st] = {"status": "skipped", "message": "Skipped due to IP reachability failure"}
        return result

    port_desc = f"Open TCP port(s): {', '.join(map(str, open_ports))}" if open_ports else "ICMP Ping responding (No standard TCP service ports open)"
    stages["ip_reachability"] = {
        "status": "success",
        "message": f"Host {ip} is reachable. {port_desc}"
    }

    # Determine best ports for ONVIF & RTSP probing
    effective_onvif_port = onvif_port
    if onvif_port not in open_ports and open_ports:
        for preferred in [8000, 80, 8080, 8899, 81, 443, 9000, 34567]:
            if preferred in open_ports:
                effective_onvif_port = preferred
                break
        else:
            effective_onvif_port = open_ports[0]

    effective_rtsp_port = port
    if port not in open_ports and open_ports:
        for preferred in [554, 8554, 8000]:
            if preferred in open_ports:
                effective_rtsp_port = preferred
                break
        else:
            effective_rtsp_port = open_ports[0]

    # ── Stage 2: onvif_detection ──────────────────────────────────────────────
    onvif_endpoint = f"http://{ip}:{effective_onvif_port}/onvif/device_service"
    code, body = send_onvif_soap(onvif_endpoint, "<tds:GetDeviceInformation/>", timeout=3.0)

    onvif_found = False
    server_info = ""
    auth_info = ""

    if code != 0 and ("Envelope" in body or "DeviceInformation" in body or "onvif" in body.lower()):
        onvif_found = True
    else:
        # Inspect HTTP server header & auth mechanism on open port
        try:
            req = urllib.request.Request(f"http://{ip}:{effective_onvif_port}/", headers={"User-Agent": "VitalCareAgent/1.0"})
            with urllib.request.urlopen(req, timeout=2.0) as resp:
                server_info = resp.headers.get("Server", "")
        except urllib.error.HTTPError as e:
            server_info = e.headers.get("Server", "")
            auth_header = e.headers.get("WWW-Authenticate", "")
            if "Digest" in auth_header:
                auth_info = "Digest authentication required"
            elif "Basic" in auth_header:
                auth_info = "Basic authentication required"
        except Exception:
            pass

    if not onvif_found:
        diag_msg = f"HTTP service detected on port {effective_onvif_port}"
        if server_info:
            diag_msg += f" (Server: {server_info})"
        if auth_info:
            diag_msg += f" [{auth_info}]"
        diag_msg += ", but ONVIF device service not confirmed"

        stages["onvif_detection"] = {
            "status": "failed",
            "message": diag_msg
        }
        result["stage"] = "onvif_detection"
        result["message"] = f"Host reachable (open ports: {', '.join(map(str, open_ports))}); ONVIF service not confirmed."

        # If custom RTSP path supplied or candidate RTSP port open, attempt RTSP test fallback
        if custom_rtsp_path or effective_rtsp_port in [554, 8554, 8000]:
            stream_uri = f"rtsp://{ip}:{effective_rtsp_port}{custom_rtsp_path if custom_rtsp_path.startswith('/') else '/' + (custom_rtsp_path or 'live')}"
            stages["onvif_authentication"] = {"status": "skipped", "message": "ONVIF service not available"}
            stages["media_profile"] = {"status": "skipped", "message": "ONVIF service not available"}
            stages["rtsp_detection"] = {"status": "success", "message": f"Using RTSP endpoint: {stream_uri}"}

            rtsp_res = test_rtsp_stream_protocol(ip, effective_rtsp_port, stream_uri, username, password)
            if rtsp_res["has_video_track"]:
                stages["rtsp_test"] = {"status": "success", "message": rtsp_res["message"]}
                result["rtsp"] = True
                result["success"] = True
                result["streamUri"] = sanitize_uri(stream_uri)
                result["message"] = "RTSP stream detected and verified successfully"
            else:
                stages["rtsp_test"] = {"status": "failed", "message": rtsp_res["message"]}
                result["message"] = f"RTSP stream test failed: {rtsp_res['message']}"
        else:
            for st in ["onvif_authentication", "media_profile", "rtsp_detection", "rtsp_test"]:
                stages[st] = {"status": "skipped", "message": "Skipped — ONVIF endpoint not confirmed"}

        return result

    result["onvif"] = True
    stages["onvif_detection"] = {
        "status": "success",
        "message": f"ONVIF Device Service active at {onvif_endpoint}"
    }

    # ── Stage 3: onvif_authentication ─────────────────────────────────────────
    code_auth, body_auth = send_onvif_soap(onvif_endpoint, "<tds:GetDeviceInformation/>", username, password, timeout=4.0)

    if code_auth == 401 or "NotAuthorized" in body_auth or "AuthenticationFailed" in body_auth or ("Sender" in body_auth and "Security" in body_auth):
        stages["onvif_authentication"] = {
            "status": "failed",
            "message": "ONVIF WS-Security UsernameToken authentication failed (HTTP 401 / NotAuthorized)"
        }
        result["stage"] = "onvif_authentication"
        result["message"] = "ONVIF authentication failed — check username/password"
        for st in ["media_profile", "rtsp_detection", "rtsp_test"]:
            stages[st] = {"status": "skipped", "message": "Skipped due to ONVIF authentication failure"}
        return result

    def parse_xml_tag(xml, tag):
        m = re.search(rf'<(?:[^:]+:)?{tag}[^>]*>([^<]+)<', xml)
        return m.group(1).strip() if m else None

    result["manufacturer"] = parse_xml_tag(body_auth, "Manufacturer")
    result["model"] = parse_xml_tag(body_auth, "Model")
    result["firmware"] = parse_xml_tag(body_auth, "FirmwareVersion")

    stages["onvif_authentication"] = {
        "status": "success",
        "message": f"Authenticated via WS-Security ({result['manufacturer'] or 'Generic'} {result['model'] or 'Camera'})"
    }

    # ── Stage 4: media_profile ────────────────────────────────────────────────
    code_cap, body_cap = send_onvif_soap(onvif_endpoint, "<tds:GetCapabilities><tds:Category>Media</tds:Category></tds:GetCapabilities>", username, password, timeout=4.0)
    
    media_endpoint = f"http://{ip}:{effective_onvif_port}/onvif/media_service"
    m_url = parse_xml_tag(body_cap, "XAddr")
    if m_url and m_url.startswith("http"):
        media_endpoint = m_url

    code_prof, body_prof = send_onvif_soap(media_endpoint, "<trt:GetProfiles/>", username, password, timeout=4.0)
    profiles = re.findall(r'token="([^"]+)"', body_prof)
    if not profiles:
        profiles = re.findall(r'<trt:Profiles[^>]*token="([^"]+)"', body_prof)

    if not profiles:
        stages["media_profile"] = {"status": "failed", "message": "Failed to retrieve ONVIF media profile tokens"}
        result["stage"] = "media_profile"
        result["message"] = "ONVIF media profiles unavailable"
        for st in ["rtsp_detection", "rtsp_test"]:
            stages[st] = {"status": "skipped", "message": "Skipped due to media profile failure"}
        return result

    first_profile_token = profiles[0]
    stages["media_profile"] = {
        "status": "success",
        "message": f"Retrieved {len(profiles)} media profile(s) (Primary token: '{first_profile_token}')"
    }

    # ── Stage 5: rtsp_detection ───────────────────────────────────────────────
    get_stream_uri_body = f"""<trt:GetStreamUri>
  <trt:StreamSetup>
    <tt:Stream>RTP-Unicast</tt:Stream>
    <tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>
  </trt:StreamSetup>
  <trt:ProfileToken>{first_profile_token}</trt:ProfileToken>
</trt:GetStreamUri>"""

    code_uri, body_uri = send_onvif_soap(media_endpoint, get_stream_uri_body, username, password, timeout=4.0)
    discovered_rtsp_uri = parse_xml_tag(body_uri, "Uri")

    if discovered_rtsp_uri:
        stages["rtsp_detection"] = {"status": "success", "message": "Obtained stream URI via ONVIF GetStreamUri"}
    elif custom_rtsp_path:
        discovered_rtsp_uri = f"rtsp://{ip}:{effective_rtsp_port}{custom_rtsp_path if custom_rtsp_path.startswith('/') else '/' + custom_rtsp_path}"
        stages["rtsp_detection"] = {"status": "success", "message": f"Using custom fallback RTSP path: {custom_rtsp_path}"}
    else:
        discovered_rtsp_uri = f"rtsp://{ip}:{effective_rtsp_port}/cam/realmonitor?channel=1&subtype=0"
        stages["rtsp_detection"] = {"status": "success", "message": "Using standard brand RTSP path fallback (/cam/realmonitor)"}

    # ── Stage 6: rtsp_test ────────────────────────────────────────────────────
    rtsp_res = test_rtsp_stream_protocol(ip, effective_rtsp_port, discovered_rtsp_uri, username, password)

    if rtsp_res["has_video_track"]:
        stages["rtsp_test"] = {"status": "success", "message": rtsp_res["message"]}
        result["rtsp"] = True
        result["success"] = True
        result["stage"] = "rtsp_test"
        result["streamUri"] = sanitize_uri(discovered_rtsp_uri)
        result["message"] = "Camera detected and RTSP stream verified successfully"
    else:
        stages["rtsp_test"] = {"status": "failed", "message": rtsp_res["message"]}
        result["stage"] = "rtsp_test"
        result["message"] = f"RTSP stream verification failed: {rtsp_res['message']}"

    return result


def sanitize_uri(uri):
    """
    Masks credentials in RTSP URIs before returning to callers.
    rtsp://admin:secret@192.168.1.1:554/path -> rtsp://***:***@192.168.1.1:554/path
    """
    if not uri:
        return uri
    return re.sub(r'rtsp://([^:]+):([^@]+)@', 'rtsp://***:***@', uri)
