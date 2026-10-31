/**
 * camera.probe.ts
 * Comprehensive connection diagnostics for IP cameras.
 *
 * Capabilities:
 *  1. TCP port scanner — checks RTSP, ONVIF, HTTP, HTTPS ports (including custom ports)
 *  2. ONVIF probe — queries device info & resolves stream URI via GetProfiles + GetStreamUri
 *  3. RTSP probe via FFmpeg — validates authentication, resolves working stream path
 *  4. Result aggregation — produces a unified ProbeResult summary
 */

import net from 'net';
import crypto from 'crypto';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import type { CameraBrand, PortScanResult, ProbeResult } from './camera.types';
import {
  getBrandProfile,
  resolveRtspPath,
  buildRtspUrl,
  buildRedactedRtspUrl,
} from './brand.profiles';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── TCP Port Scanner ─────────────────────────────────────────────────────────

const STANDARD_PORTS: { port: number; label: string }[] = [
  { port: 554,  label: 'RTSP' },
  { port: 5543, label: 'RTSP Alt (5543)' },
  { port: 8554, label: 'RTSP Alt' },
  { port: 8899, label: 'CP Plus / XM ONVIF' },
  { port: 80,   label: 'HTTP / ONVIF' },
  { port: 8000, label: 'Control / Admin' },
  { port: 443,  label: 'HTTPS' },
  { port: 8080, label: 'HTTP Alt / ONVIF Alt' },
  { port: 2020, label: 'Tapo ONVIF' },
];

const PORT_SCAN_TIMEOUT_MS = 3000;

/**
 * Checks if a single TCP port is open on a given host.
 */
function checkPort(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (open: boolean) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(PORT_SCAN_TIMEOUT_MS);
    const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(host);
    const options = isIpv4 ? { port, host, family: 4 } : { port, host };
    socket.connect(options, () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
  });
}

/**
 * Scans candidate IP camera ports, prioritizing user-specified ports and batching
 * queries in small groups of 3 to avoid overwhelming embedded camera network stacks.
 */
async function scanPorts(ipAddress: string, extraPorts: number[] = []): Promise<PortScanResult[]> {
  const portMap = new Map<number, string>();
  for (const ep of extraPorts) {
    if (ep > 0 && ep <= 65535 && !portMap.has(ep)) {
      portMap.set(ep, `Custom Port (${ep})`);
    }
  }
  for (const p of STANDARD_PORTS) {
    if (!portMap.has(p.port)) {
      portMap.set(p.port, p.label);
    }
  }

  const portsToScan = Array.from(portMap.entries()).map(([port, label]) => ({ port, label }));

  const results: PortScanResult[] = [];
  const batchSize = 3;
  for (let i = 0; i < portsToScan.length; i += batchSize) {
    const batch = portsToScan.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async ({ port, label }) => ({
        port,
        label,
        open: await checkPort(ipAddress, port),
      }))
    );
    results.push(...batchResults);
  }
  return results;
}

// ─── RTSP Probe via FFmpeg ────────────────────────────────────────────────────

const RTSP_PROBE_TIMEOUT_MS = 6000;

export interface RtspProbeResult {
  success: boolean;
  workingPath?: string;
  resolution?: string;
  fps?: number;
  codec?: string;
  authError: boolean;
  timeout: boolean;
  networkUnreachable: boolean;
  statusCode?: number;
  failureReason?:
    | 'auth'
    | 'not_found'
    | 'bad_request'
    | 'timeout'
    | 'network'
    | 'port_closed'
    | 'codec'
    | 'uri_error'
    | 'bandwidth'
    | 'server_error'
    | 'handshake';
  errorMessage?: string;
}

/**
 * Parses FFmpeg stderr output and exit code to accurately capture connection and stream issues.
 */
export function parseFfmpegStderr(
  stderr: string,
  code: number | null,
  port: number
): RtspProbeResult {
  const lower = stderr.toLowerCase();

  // 1. Detect active video stream metadata
  const hasVideoStream =
    lower.includes('video:') ||
    (lower.includes('stream #') && lower.includes('video')) ||
    lower.includes('frame=');

  if (hasVideoStream) {
    let resolution: string | undefined;
    let fps: number | undefined;
    let codec: string | undefined;

    const resMatch = stderr.match(/(\d{3,4}x\d{3,4})/);
    if (resMatch) resolution = resMatch[1];
    const fpsMatch = stderr.match(/(\d+(?:\.\d+)?)\s*(?:fps|tbr)/i);
    if (fpsMatch) fps = Math.round(parseFloat(fpsMatch[1]));
    const codecMatch = stderr.match(/Video:\s*([a-zA-Z0-9_-]+)/i);
    if (codecMatch) codec = codecMatch[1];

    return {
      success: true,
      resolution,
      fps,
      codec,
      authError: false,
      timeout: false,
      networkUnreachable: false,
    };
  }

  // 2. Detect authentication or authorization failure
  if (
    lower.includes('401') ||
    lower.includes('unauthorized') ||
    lower.includes('authentication failed') ||
    lower.includes('wrong password')
  ) {
    return {
      success: false,
      authError: true,
      timeout: false,
      networkUnreachable: false,
      statusCode: 401,
      failureReason: 'auth',
      errorMessage: 'RTSP authentication failed (401 Unauthorized) — verify camera username and password',
    };
  }

  if (
    lower.includes('403') ||
    lower.includes('forbidden') ||
    lower.includes('access denied')
  ) {
    return {
      success: false,
      authError: true,
      timeout: false,
      networkUnreachable: false,
      statusCode: 403,
      failureReason: 'auth',
      errorMessage: 'RTSP access forbidden (403 Forbidden) — check camera permissions',
    };
  }

  // 3. Detect standard RTSP method response failures
  const methodMatch = stderr.match(/method\s+([A-Z]+)\s+failed:\s*(\d{3})\s*([^\r\n]*)/i);
  if (methodMatch) {
    const status = parseInt(methodMatch[2], 10);
    const reasonText = methodMatch[3].trim();
    if (status === 404) {
      return {
        success: false,
        authError: false,
        timeout: false,
        networkUnreachable: false,
        statusCode: 404,
        failureReason: 'not_found',
        errorMessage: 'RTSP stream path not found (404 Not Found) — path does not exist on camera',
      };
    }
    if (status === 400) {
      return {
        success: false,
        authError: false,
        timeout: false,
        networkUnreachable: false,
        statusCode: 400,
        failureReason: 'bad_request',
        errorMessage: 'RTSP request rejected (400 Bad Request) — verify stream URL format',
      };
    }
    if (status === 453) {
      return {
        success: false,
        authError: false,
        timeout: false,
        networkUnreachable: false,
        statusCode: 453,
        failureReason: 'bandwidth',
        errorMessage: 'RTSP stream unavailable: bandwidth limit reached (453 Not Enough Bandwidth)',
      };
    }
    return {
      success: false,
      authError: status === 401 || status === 403,
      timeout: false,
      networkUnreachable: false,
      statusCode: status,
      failureReason: status >= 500 ? 'server_error' : 'handshake',
      errorMessage: `RTSP ${methodMatch[1]} failed: ${status} ${reasonText}`,
    };
  }

  if (lower.includes('404') || lower.includes('stream not found') || lower.includes('not found')) {
    return {
      success: false,
      authError: false,
      timeout: false,
      networkUnreachable: false,
      statusCode: 404,
      failureReason: 'not_found',
      errorMessage: 'RTSP stream path not found (404 Not Found)',
    };
  }

  // 4. Detect connection refused on this specific port
  if (
    lower.includes('connection refused') ||
    lower.includes('10061') ||
    lower.includes('error number -138')
  ) {
    return {
      success: false,
      authError: false,
      timeout: false,
      networkUnreachable: false,
      failureReason: 'port_closed',
      errorMessage: `RTSP Port ${port} connection refused — RTSP service not responding on this port`,
    };
  }

  // 5. Detect host unreachable / network unreachable
  if (
    lower.includes('no route to host') ||
    lower.includes('network unreachable') ||
    lower.includes('network is unreachable') ||
    lower.includes('host is unreachable') ||
    lower.includes('10065') ||
    lower.includes('10051') ||
    lower.includes('error number -113')
  ) {
    return {
      success: false,
      authError: false,
      timeout: false,
      networkUnreachable: true,
      failureReason: 'network',
      errorMessage: 'Camera host unreachable — check IP address and network connection',
    };
  }

  // 6. Detect connection timeout
  if (
    lower.includes('connection timed out') ||
    lower.includes('immediate exit requested') ||
    lower.includes('operation timed out') ||
    lower.includes('10060')
  ) {
    return {
      success: false,
      authError: false,
      timeout: true,
      networkUnreachable: false,
      failureReason: 'timeout',
      errorMessage: 'RTSP connection timed out while waiting for camera response',
    };
  }

  // 7. Detect URL / argument parsing errors
  if (
    lower.includes('invalid argument') ||
    lower.includes('protocol not found') ||
    lower.includes('url using bad/illegal format')
  ) {
    return {
      success: false,
      authError: false,
      timeout: false,
      networkUnreachable: false,
      failureReason: 'uri_error',
      errorMessage: 'Invalid RTSP URI syntax or format',
    };
  }

  // 8. Detect codec / transport errors
  if (
    lower.includes('invalid data found') ||
    lower.includes('could not find codec parameters') ||
    lower.includes('unsupported codec')
  ) {
    return {
      success: false,
      authError: false,
      timeout: false,
      networkUnreachable: false,
      failureReason: 'codec',
      errorMessage: 'RTSP stream codec/transport error: unable to parse video stream payload',
    };
  }

  return {
    success: false,
    authError: false,
    timeout: false,
    networkUnreachable: false,
    failureReason: 'handshake',
    errorMessage: `RTSP handshake failed (exit code ${code ?? 'unknown'})`,
  };
}

/**
 * Attempts to connect to an RTSP stream using FFmpeg.
 * Tests a single RTSP path/URI and returns detailed diagnostics.
 */
function probeRtspPath(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  rtspPathOrUri: string
): Promise<RtspProbeResult> {
  return new Promise((resolve) => {
    const rtspUrl = buildRtspUrl(ipAddress, port, username, password, rtspPathOrUri);
    const redactedUrl = buildRedactedRtspUrl(ipAddress, port, username, rtspPathOrUri);

    console.log(`[Probe] Testing RTSP: ${redactedUrl}`);

    const ffmpegPath = ffmpegInstaller.path;
    const proc = spawn(
      ffmpegPath,
      [
        '-rtsp_transport', 'tcp',
        '-stimeout', '5000000', // 5-second socket timeout in microseconds
        '-analyzeduration', '2000000', // 2-second analyze duration
        '-probesize', '1048576', // 1MB probe size
        '-i', rtspUrl,
        '-an', // disable audio in probe
        '-frames:v', '1',
        '-f', 'null',
        '-',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] }
    );

    let stderr = '';
    let settled = false;

    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
    };

    const tryResolveVideoSuccess = () => {
      if (settled) return false;
      const lower = stderr.toLowerCase();
      const hasVideoStream =
        lower.includes('video:') ||
        (lower.includes('stream #') && lower.includes('video')) ||
        lower.includes('frame=');

      if (hasVideoStream) {
        cleanup();
        let resolution: string | undefined;
        let fps: number | undefined;
        let codec: string | undefined;

        const resMatch = stderr.match(/(\d{3,4}x\d{3,4})/);
        if (resMatch) resolution = resMatch[1];
        const fpsMatch = stderr.match(/(\d+(?:\.\d+)?)\s*(?:fps|tbr)/i);
        if (fpsMatch) fps = Math.round(parseFloat(fpsMatch[1]));
        const codecMatch = stderr.match(/Video:\s*([a-zA-Z0-9_-]+)/i);
        if (codecMatch) codec = codecMatch[1];

        try { proc.kill(); } catch { /* ignore */ }

        resolve({
          success: true,
          workingPath: rtspPathOrUri,
          resolution,
          fps,
          codec,
          authError: false,
          timeout: false,
          networkUnreachable: false,
        });
        return true;
      }
      return false;
    };

    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      tryResolveVideoSuccess();
    });

    const timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      try { proc.kill(); } catch { /* ignore */ }
      resolve({
        success: false,
        authError: false,
        timeout: true,
        networkUnreachable: false,
        failureReason: 'timeout',
        errorMessage: 'RTSP connection timed out while waiting for camera response',
      });
    }, RTSP_PROBE_TIMEOUT_MS);

    proc.on('close', (code) => {
      if (settled) return;
      cleanup();

      if (tryResolveVideoSuccess()) {
        return;
      }

      const parsedFailure = parseFfmpegStderr(stderr, code, port);
      resolve({
        ...parsedFailure,
        workingPath: parsedFailure.success ? rtspPathOrUri : undefined,
      });
    });

    proc.on('error', (err) => {
      if (settled) return;
      cleanup();
      resolve({
        success: false,
        authError: false,
        timeout: false,
        networkUnreachable: false,
        failureReason: 'handshake',
        errorMessage: `FFmpeg execution error: ${err.message}`,
      });
    });
  });
}

/**
 * Probes candidate RTSP paths, testing discovered path, custom path, or known brand templates.
 */
async function probeRtsp(
  ipAddress: string,
  port: number,
  brand: CameraBrand,
  username: string,
  password: string,
  candidatePath?: string,
  discoveredPath?: string,
  onvifStreamUri?: string
): Promise<RtspProbeResult> {
  const testedTargets = new Set<string>();
  const pathsToTest: string[] = [];

  // Prioritize ONVIF discovered path / URI first
  if (onvifStreamUri && onvifStreamUri.trim()) {
    pathsToTest.push(onvifStreamUri.trim());
  }
  if (discoveredPath && discoveredPath.trim()) {
    const formatted = discoveredPath.trim().startsWith('/') ? discoveredPath.trim() : `/${discoveredPath.trim()}`;
    if (!pathsToTest.includes(formatted)) {
      pathsToTest.push(formatted);
    }
  }
  if (candidatePath && candidatePath.trim()) {
    const formatted = candidatePath.trim().startsWith('/') ? candidatePath.trim() : `/${candidatePath.trim()}`;
    if (!pathsToTest.includes(formatted)) {
      pathsToTest.push(formatted);
    }
  }

  let primaryFailure: RtspProbeResult | undefined;

  for (const target of pathsToTest) {
    if (testedTargets.has(target)) continue;
    testedTargets.add(target);

    const result = await probeRtspPath(ipAddress, port, username, password, target);

    if (result.success) {
      return result;
    }

    if (!primaryFailure) {
      primaryFailure = result;
    }

    // Stop immediately if definitive auth error or network unreachable
    if (result.authError || result.networkUnreachable) {
      return result;
    }
  }

  // Fallback to top brand templates only if primary paths did not succeed
  const profile = getBrandProfile(brand);
  const templatesToTest = profile.rtspPathTemplates.slice(0, 3);
  for (const template of templatesToTest) {
    const resolvedPath = resolveRtspPath(template, 1);
    if (testedTargets.has(resolvedPath)) continue;
    testedTargets.add(resolvedPath);

    const result = await probeRtspPath(ipAddress, port, username, password, resolvedPath);

    if (result.success) return result;
    if (result.authError) return result;
    if (result.networkUnreachable) return result;
  }

  if (primaryFailure) {
    return primaryFailure;
  }

  return {
    success: false,
    authError: false,
    timeout: false,
    networkUnreachable: false,
    failureReason: 'not_found',
    errorMessage: `None of the known RTSP paths for ${profile.displayName} responded`,
  };
}

// ─── ONVIF Probe ──────────────────────────────────────────────────────────────

const ONVIF_TIMEOUT_MS = 4000;

export interface OnvifProbeResult {
  available: boolean;
  authError?: boolean;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  serialNumber?: string;
  onvifVersion?: string;
  discoveredRtspPath?: string;
  discoveredRtspPort?: number;
  onvifStreamUri?: string;
  errorMessage?: string;
}

/**
 * Builds authentic ONVIF WS-Security UsernameToken header using binary SHA-1 digest.
 */
function buildOnvifSecurityHeader(username: string, password: string): string {
  if (!username && !password) return '';
  const nonceBytes = crypto.randomBytes(16);
  const nonceB64 = nonceBytes.toString('base64');
  const created = new Date().toISOString();

  const sha1 = crypto.createHash('sha1');
  sha1.update(Buffer.concat([
    nonceBytes,
    Buffer.from(created, 'utf8'),
    Buffer.from(password, 'utf8'),
  ]));
  const passwordDigest = sha1.digest('base64');

  return `<soap:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd" xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(username)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${passwordDigest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceB64}</wsse:Nonce>
        <wsu:Created>${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>`;
}

interface OnvifStreamInfo {
  path?: string;
  rawUri?: string;
  port?: number;
}

/**
 * Attempts to resolve the live RTSP stream path from ONVIF Media Service.
 */
async function resolveOnvifStreamPath(
  ipAddress: string,
  onvifPort: number,
  username: string,
  password: string
): Promise<OnvifStreamInfo> {
  const securityHeader = buildOnvifSecurityHeader(username, password);

  const profilesEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl">
  ${securityHeader}
  <soap:Body>
    <trt:GetProfiles/>
  </soap:Body>
</soap:Envelope>`;

  const endpoints = ['/onvif/media_service', '/onvif/Media', '/onvif/device_service'];

  for (const endpoint of endpoints) {
    try {
      const url = `http://${ipAddress}:${onvifPort}${endpoint}`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(profilesEnvelope)),
        },
        body: profilesEnvelope,
        signal: controller.signal,
      });
      clearTimeout(timer);

      const xml = await res.text();
      const tokenMatch = xml.match(/token=["']([^"']+)["']/i);
      if (!tokenMatch) continue;

      const profileToken = tokenMatch[1];

      const streamUriEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema">
  ${buildOnvifSecurityHeader(username, password)}
  <soap:Body>
    <trt:GetStreamUri>
      <trt:StreamSetup>
        <tt:Stream>RTP-Unicast</tt:Stream>
        <tt:Transport><tt:Protocol>RTSP</tt:Protocol></tt:Transport>
      </trt:StreamSetup>
      <trt:ProfileToken>${escapeXml(profileToken)}</trt:ProfileToken>
    </trt:GetStreamUri>
  </soap:Body>
</soap:Envelope>`;

      const uriCtrl = new AbortController();
      const uriTimer = setTimeout(() => uriCtrl.abort(), 2500);

      const uriRes = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/soap+xml; charset=utf-8',
          'Content-Length': String(Buffer.byteLength(streamUriEnvelope)),
        },
        body: streamUriEnvelope,
        signal: uriCtrl.signal,
      });
      clearTimeout(uriTimer);

      const uriXml = await uriRes.text();
      const uriMatch = uriXml.match(/<(?:\w+:)?Uri>([^<]+)<\/(?:\w+:)?Uri>/i);
      if (uriMatch) {
        const rawUri = uriMatch[1].trim();
        try {
          const parsed = new URL(rawUri);
          const path = parsed.pathname + (parsed.search || '');
          const port = parsed.port ? Number(parsed.port) : undefined;
          return { path, rawUri, port };
        } catch {
          const m = rawUri.match(/rtsp:\/\/[^/:]+(?::(\d+))?(\/.*)/i);
          if (m) {
            return {
              path: m[2],
              rawUri,
              port: m[1] ? Number(m[1]) : undefined,
            };
          }
        }
      }
    } catch {
      // Continue to next endpoint attempt
    }
  }

  return {};
}

/**
 * Queries the camera's ONVIF device information endpoint.
 */
async function probeOnvif(
  ipAddress: string,
  onvifPort: number,
  username: string,
  password: string
): Promise<OnvifProbeResult> {
  const securityHeader = buildOnvifSecurityHeader(username, password);

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  ${securityHeader}
  <soap:Body>
    <tds:GetDeviceInformation/>
  </soap:Body>
</soap:Envelope>`;

  const url = `http://${ipAddress}:${onvifPort}/onvif/device_service`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ONVIF_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml; charset=utf-8',
        'Content-Length': String(Buffer.byteLength(soapBody)),
      },
      body: soapBody,
      signal: controller.signal,
    });

    clearTimeout(timer);

    const xml = await response.text();

    if (
      xml.includes('FailedAuthentication') ||
      xml.includes('NotAuthorized') ||
      xml.includes('Sender: wsse:FailedAuthentication') ||
      response.status === 401
    ) {
      return {
        available: true,
        authError: true,
        errorMessage: 'Camera Authentication Failed. Check the ONVIF/PC View password in your camera mobile app.',
      };
    }

    if (!response.ok && !xml.includes('DeviceInformation')) {
      return { available: false, errorMessage: `ONVIF HTTP ${response.status}` };
    }

    // Parse device information from SOAP XML response
    const extract = (tag: string): string | undefined => {
      const match = xml.match(new RegExp(`<(?:tds:|tt:)?${tag}[^>]*>([^<]+)<`));
      return match?.[1]?.trim();
    };

    // Try resolving stream path via ONVIF Media service
    const streamInfo = await resolveOnvifStreamPath(ipAddress, onvifPort, username, password);

    return {
      available: true,
      authError: false,
      manufacturer: extract('Manufacturer'),
      model: extract('Model'),
      firmware: extract('FirmwareVersion'),
      serialNumber: extract('SerialNumber'),
      onvifVersion: '2.0',
      discoveredRtspPath: streamInfo.path,
      discoveredRtspPort: streamInfo.port,
      onvifStreamUri: streamInfo.rawUri,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('abort') || message.includes('AbortError')) {
      return { available: false, errorMessage: 'ONVIF query timed out' };
    }
    return { available: false, errorMessage: message };
  }
}

// ─── Main Probe Orchestrator ──────────────────────────────────────────────────

/**
 * Runs a comprehensive connection probe for a camera.
 * Returns a ProbeResult combining port scan, RTSP, and ONVIF diagnostics.
 */
export async function probeCamera(
  ipAddress: string,
  brand: CameraBrand,
  port: number = 554,
  onvifPort: number = 80,
  username: string = 'admin',
  password: string = '',
  customRtspPath?: string
): Promise<ProbeResult> {
  console.log(`[Probe] Starting probe for ${ipAddress} (brand: ${brand})`);
  const testedAt = new Date().toISOString();

  // Support local mock mode for development / automated testing
  if (ipAddress === 'mock' || ipAddress === '0.0.0.0') {
    return {
      success: true,
      ipAddress,
      brand,
      portsScanned: [
        { port: port || 554, open: true, label: `RTSP (${port || 554})` },
        { port: onvifPort || 80, open: true, label: `ONVIF (${onvifPort || 80})` },
      ],
      rtspAvailable: true,
      onvifAvailable: true,
      detectedRtspPort: port || 554,
      detectedOnvifPort: onvifPort || 80,
      discoveredRtspPath: customRtspPath || '/mock/stream',
      onvifVersion: '2.0',
      manufacturer: 'VitalCare Mock Provider',
      model: 'Simulated Camera 1080p',
      firmware: '1.0.0-mock',
      serialNumber: 'VC-MOCK-001',
      resolution: '1280x720',
      fps: 15,
      authError: false,
      timeout: false,
      networkUnreachable: false,
      testedAt,
    };
  }

  // 1. Scan ports first to see what the camera has open, including user specified ports
  const extraPorts = [port, onvifPort].filter((p): p is number => typeof p === 'number' && p > 0);
  const portsScanned = await scanPorts(ipAddress, extraPorts);
  const openPorts = portsScanned.filter((p) => p.open).map((p) => p.port);

  // If host is completely unreachable across all ports
  if (openPorts.length === 0) {
    return {
      success: false,
      ipAddress,
      brand,
      portsScanned,
      rtspAvailable: false,
      onvifAvailable: false,
      authError: false,
      timeout: true,
      networkUnreachable: true,
      errorMessage: `Camera at ${ipAddress} is not reachable on your local network. Check IP address, ensure camera is powered on and connected to the same Wi-Fi.`,
      testedAt,
    };
  }

  // 2. Select the best ONVIF port based on what is actually open
  const effectiveOnvifPort = openPorts.includes(onvifPort)
    ? onvifPort
    : openPorts.includes(8000)
    ? 8000
    : openPorts.includes(8899)
    ? 8899
    : openPorts.includes(80)
    ? 80
    : openPorts.includes(2020)
    ? 2020
    : openPorts.includes(8080)
    ? 8080
    : onvifPort;

  // 3. Probe ONVIF first to resolve device info and stream profile path
  const onvifResult = await probeOnvif(ipAddress, effectiveOnvifPort, username, password);

  // If ONVIF returned an RTSP port that was not in the initial scan list, verify it now
  if (onvifResult.discoveredRtspPort && !portsScanned.some((p) => p.port === onvifResult.discoveredRtspPort)) {
    const isPortOpen = await checkPort(ipAddress, onvifResult.discoveredRtspPort);
    portsScanned.push({
      port: onvifResult.discoveredRtspPort,
      label: `ONVIF RTSP (${onvifResult.discoveredRtspPort})`,
      open: isPortOpen,
    });
    if (isPortOpen) {
      openPorts.push(onvifResult.discoveredRtspPort);
    }
  }

  // 4. Select the best RTSP port: prefer ONVIF-discovered port if open, or user-specified if not default 554 and open, or user-specified if open, or 5543/554/8554
  const effectiveRtspPort =
    onvifResult.discoveredRtspPort && openPorts.includes(onvifResult.discoveredRtspPort)
      ? onvifResult.discoveredRtspPort
      : port !== 554 && openPorts.includes(port)
      ? port
      : openPorts.includes(5543)
      ? 5543
      : openPorts.includes(port)
      ? port
      : openPorts.includes(554)
      ? 554
      : openPorts.includes(8554)
      ? 8554
      : port;

  // 5. Probe RTSP: only run FFmpeg if the RTSP port is verified open!
  let rtspResult: RtspProbeResult;
  if (!openPorts.includes(effectiveRtspPort)) {
    console.log(`[Probe] Skipping RTSP probe: port ${effectiveRtspPort} is closed on ${ipAddress}`);
    rtspResult = {
      success: false,
      authError: false,
      timeout: false,
      networkUnreachable: false,
      errorMessage: `RTSP Port ${effectiveRtspPort} is closed on ${ipAddress}. Turn ON "ONVIF" or "PC View" in your camera mobile app, or verify the camera streaming port.`,
    };
  } else {
    rtspResult = await probeRtsp(
      ipAddress,
      effectiveRtspPort,
      brand,
      username,
      password,
      customRtspPath,
      onvifResult.discoveredRtspPath,
      onvifResult.onvifStreamUri
    );
  }

  const authError = rtspResult.authError || !!onvifResult.authError;
  let errorMessage: string | undefined;

  if (!rtspResult.success) {
    if (authError) {
      errorMessage = 'Camera Authentication Failed. Check the ONVIF/PC View password in your camera mobile app.';
    } else if (!openPorts.includes(effectiveRtspPort)) {
      errorMessage = `RTSP Port ${effectiveRtspPort} is closed on ${ipAddress}. Turn ON "ONVIF" or "PC View" in your camera mobile app.`;
    } else {
      errorMessage =
        rtspResult.errorMessage ??
        onvifResult.errorMessage ??
        `None of the known RTSP paths for ${brand.toUpperCase()} responded.`;
    }
  }

  const workingPath = rtspResult.workingPath || onvifResult.discoveredRtspPath;

  return {
    success: rtspResult.success,
    ipAddress,
    brand,
    portsScanned,
    rtspAvailable: rtspResult.success,
    onvifAvailable: onvifResult.available,
    detectedRtspPort: openPorts.includes(effectiveRtspPort) ? effectiveRtspPort : undefined,
    detectedOnvifPort: onvifResult.available ? effectiveOnvifPort : undefined,
    discoveredRtspPath: workingPath,
    onvifStreamUri: onvifResult.onvifStreamUri,
    resolution: rtspResult.resolution,
    fps: rtspResult.fps,
    // ONVIF metadata
    onvifVersion: onvifResult.onvifVersion,
    manufacturer: onvifResult.manufacturer ?? (brand === 'cpplus' ? 'CP Plus' : undefined),
    model: onvifResult.model,
    firmware: onvifResult.firmware,
    serialNumber: onvifResult.serialNumber,
    // Error flags
    authError,
    timeout: rtspResult.timeout,
    networkUnreachable: rtspResult.networkUnreachable,
    errorMessage,
    testedAt,
  };
}
