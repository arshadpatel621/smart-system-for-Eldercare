/**
 * camera.probe.ts
 * Comprehensive connection diagnostics for IP cameras.
 *
 * Capabilities:
 *  1. TCP port scanner — checks RTSP, ONVIF, HTTP, HTTPS ports
 *  2. RTSP probe via FFmpeg — validates authentication, resolves working stream path
 *  3. ONVIF probe — queries device info (model, firmware, serial, stream URI)
 *  4. Result aggregation — produces a single ProbeResult summary
 */

import net from 'net';
import { spawn } from 'child_process';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import type { CameraBrand, PortScanResult, ProbeResult } from './camera.types';
import {
  getBrandProfile,
  resolveRtspPath,
  buildRtspUrl,
  buildRedactedRtspUrl,
} from './brand.profiles';

// ─── TCP Port Scanner ─────────────────────────────────────────────────────────

const STANDARD_PORTS: { port: number; label: string }[] = [
  { port: 554,  label: 'RTSP' },
  { port: 80,   label: 'HTTP / ONVIF' },
  { port: 443,  label: 'HTTPS' },
  { port: 8080, label: 'HTTP Alt / ONVIF Alt' },
  { port: 8554, label: 'RTSP Alt' },
  { port: 2020, label: 'Tapo ONVIF' },
];

const PORT_SCAN_TIMEOUT_MS = 1500;

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
    socket.connect(port, host, () => finish(true));
    socket.on('error', () => finish(false));
    socket.on('timeout', () => finish(false));
  });
}

/**
 * Scans standard IP camera ports concurrently.
 */
async function scanPorts(ipAddress: string): Promise<PortScanResult[]> {
  const results = await Promise.all(
    STANDARD_PORTS.map(async ({ port, label }) => ({
      port,
      label,
      open: await checkPort(ipAddress, port),
    }))
  );
  return results;
}

// ─── RTSP Probe via FFmpeg ────────────────────────────────────────────────────

const RTSP_PROBE_TIMEOUT_MS = 6000;

export interface RtspProbeResult {
  success: boolean;
  workingPath?: string;
  resolution?: string;
  fps?: number;
  authError: boolean;
  timeout: boolean;
  networkUnreachable: boolean;
  errorMessage?: string;
}

/**
 * Attempts to connect to an RTSP stream using FFmpeg.
 * Tests a single RTSP path and returns detailed diagnostics.
 */
function probeRtspPath(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  rtspPath: string
): Promise<RtspProbeResult> {
  return new Promise((resolve) => {
    const rtspUrl = buildRtspUrl(ipAddress, port, username, password, rtspPath);
    const redactedUrl = buildRedactedRtspUrl(ipAddress, port, username, rtspPath);

    console.log(`[Probe] Testing RTSP: ${redactedUrl}`);

    const ffmpegPath = ffmpegInstaller.path;
    const proc = spawn(ffmpegPath, [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-t', '1',
      '-f', 'null',
      '-',
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill();
      resolve({ success: false, authError: false, timeout: true, networkUnreachable: false, errorMessage: 'Connection timed out' });
    }, RTSP_PROBE_TIMEOUT_MS);

    proc.on('close', (code) => {
      clearTimeout(timer);

      const lower = stderr.toLowerCase();

      // Detect authentication errors
      if (lower.includes('401') || lower.includes('unauthorized') || lower.includes('authentication failed') || lower.includes('wrong password')) {
        resolve({ success: false, authError: true, timeout: false, networkUnreachable: false, errorMessage: 'Authentication failed — check username/password' });
        return;
      }

      // Detect network unreachable
      if (lower.includes('connection refused') || lower.includes('no route to host') || lower.includes('network unreachable') || lower.includes('host is unreachable')) {
        resolve({ success: false, authError: false, timeout: false, networkUnreachable: true, errorMessage: 'Host unreachable — check IP address and network' });
        return;
      }

      // Parse stream metadata from FFmpeg stderr (appears in both success and some failure modes)
      let resolution: string | undefined;
      let fps: number | undefined;
      const resMatch = stderr.match(/(\d{3,4}x\d{3,4})/);
      if (resMatch) resolution = resMatch[1];
      const fpsMatch = stderr.match(/(\d+(?:\.\d+)?)\s*(?:fps|tbr)/i);
      if (fpsMatch) fps = Math.round(parseFloat(fpsMatch[1]));

      if (code === 0 || stderr.includes('frame=') || stderr.includes('Video:')) {
        resolve({ success: true, workingPath: rtspPath, resolution, fps, authError: false, timeout: false, networkUnreachable: false });
      } else {
        resolve({ success: false, authError: false, timeout: false, networkUnreachable: false, errorMessage: `RTSP handshake failed (exit code ${code})` });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      resolve({ success: false, authError: false, timeout: false, networkUnreachable: false, errorMessage: `FFmpeg error: ${err.message}` });
    });
  });
}

/**
 * Probes all known RTSP path templates for a brand, returning the first that works.
 * If a custom path is provided, it is tested exclusively.
 */
async function probeRtsp(
  ipAddress: string,
  port: number,
  brand: CameraBrand,
  username: string,
  password: string,
  customPath?: string
): Promise<RtspProbeResult> {
  // If user provided a custom path, test it exclusively
  if (customPath) {
    return probeRtspPath(ipAddress, port, username, password, customPath);
  }

  const profile = getBrandProfile(brand);

  // Test each brand template in sequence (stop on first success)
  for (const template of profile.rtspPathTemplates) {
    const resolvedPath = resolveRtspPath(template, 1);
    const result = await probeRtspPath(ipAddress, port, username, password, resolvedPath);

    if (result.authError) return result; // Auth error is definitive — no point trying more paths
    if (result.networkUnreachable) return result; // Network issue is definitive
    if (result.success) return result;
  }

  return {
    success: false,
    authError: false,
    timeout: false,
    networkUnreachable: false,
    errorMessage: `None of the known RTSP paths for ${profile.displayName} responded`,
  };
}

// ─── ONVIF Probe ──────────────────────────────────────────────────────────────

const ONVIF_TIMEOUT_MS = 5000;

export interface OnvifProbeResult {
  available: boolean;
  manufacturer?: string;
  model?: string;
  firmware?: string;
  serialNumber?: string;
  onvifVersion?: string;
  discoveredRtspPath?: string;
  errorMessage?: string;
}

/**
 * Queries the camera's ONVIF device information endpoint.
 * Uses raw SOAP requests without an ONVIF library to avoid heavy dependencies.
 */
async function probeOnvif(
  ipAddress: string,
  onvifPort: number,
  username: string,
  password: string
): Promise<OnvifProbeResult> {
  // Build WS-Security digest token for ONVIF auth
  const nonce = Buffer.from(Math.random().toString(36)).toString('base64');
  const created = new Date().toISOString();
  const passwordDigest = require('crypto')
    .createHash('sha1')
    .update(Buffer.from(nonce, 'base64').toString() + created + password)
    .digest('base64');

  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
  xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd"
  xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <soap:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${username}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${passwordDigest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce}</wsse:Nonce>
        <wsu:Created>${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </soap:Header>
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

    if (!response.ok && !xml.includes('DeviceInformation')) {
      return { available: false, errorMessage: `ONVIF HTTP ${response.status}` };
    }

    // Parse device information from SOAP XML response
    const extract = (tag: string): string | undefined => {
      const match = xml.match(new RegExp(`<(?:tds:|tt:)?${tag}[^>]*>([^<]+)<`));
      return match?.[1]?.trim();
    };

    return {
      available: true,
      manufacturer: extract('Manufacturer'),
      model: extract('Model'),
      firmware: extract('FirmwareVersion'),
      serialNumber: extract('SerialNumber'),
      onvifVersion: extract('XAddr') ? '2.0' : undefined,
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return { available: false, errorMessage: 'ONVIF query timed out' };
    }
    return { available: false, errorMessage: err.message };
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
  port: number,
  onvifPort: number,
  username: string,
  password: string,
  customRtspPath?: string
): Promise<ProbeResult> {
  console.log(`[Probe] Starting probe for ${ipAddress} (brand: ${brand})`);
  const testedAt = new Date().toISOString();

  // Run port scan, RTSP probe, and ONVIF probe concurrently
  const [portsScanned, rtspResult, onvifResult] = await Promise.all([
    scanPorts(ipAddress),
    probeRtsp(ipAddress, port, brand, username, password, customRtspPath),
    probeOnvif(ipAddress, onvifPort, username, password),
  ]);

  const rtspPortOpen = portsScanned.find((p) => p.port === port)?.open ?? false;
  const onvifPortOpen = portsScanned.find((p) => p.port === onvifPort)?.open ?? false;

  return {
    success: rtspResult.success,
    ipAddress,
    brand,
    portsScanned,
    rtspAvailable: rtspResult.success,
    onvifAvailable: onvifResult.available,
    discoveredRtspPath: rtspResult.workingPath,
    resolution: rtspResult.resolution,
    fps: rtspResult.fps,
    // ONVIF metadata
    onvifVersion: onvifResult.onvifVersion,
    manufacturer: onvifResult.manufacturer ?? (brand === 'cpplus' ? 'CP Plus' : undefined),
    model: onvifResult.model,
    firmware: onvifResult.firmware,
    serialNumber: onvifResult.serialNumber,
    // Error flags
    authError: rtspResult.authError,
    timeout: rtspResult.timeout,
    networkUnreachable: rtspResult.networkUnreachable,
    errorMessage: rtspResult.success
      ? undefined
      : (rtspResult.errorMessage ?? onvifResult.errorMessage),
    testedAt,
  };
}
