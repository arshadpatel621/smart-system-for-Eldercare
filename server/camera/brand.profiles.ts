/**
 * brand.profiles.ts
 * Per-brand RTSP URL templates, default port tables, and stream path knowledge base.
 *
 * When a user selects a brand and clicks "Test Connection", the server uses these
 * profiles to attempt each known RTSP path in order, without requiring the user
 * to manually enter the RTSP URL for standard installations.
 *
 * Custom RTSP paths (entered by user) always take priority over these defaults.
 */

import type { CameraBrand } from './camera.types';

export interface BrandProfile {
  brand: CameraBrand;
  displayName: string;
  defaultRtspPort: number;
  defaultOnvifPort: number;
  /**
   * Known RTSP path templates for this brand.
   * Placeholders: {channel} = 1, {subtype} = 0 (main) or 1 (sub)
   * Tested in order — first successful probe wins.
   */
  rtspPathTemplates: string[];
  /**
   * Known ONVIF profile paths (for WS-Discovery and GetStreamUri).
   */
  onvifPath: string;
  /** Whether brand typically requires digest auth in RTSP */
  usesDigestAuth: boolean;
  /** Brand-specific notes for connection troubleshooting */
  notes: string;
}

export const BRAND_PROFILES: Record<CameraBrand, BrandProfile> = {
  cpplus: {
    brand: 'cpplus',
    displayName: 'CP Plus',
    defaultRtspPort: 554,
    defaultOnvifPort: 8899,
    rtspPathTemplates: [
      '/live/ch0',
      '/live/ch1',
      '/onvif1',
      '/onvif2',
      '/cam/realmonitor?channel={channel}&subtype=0',
      '/cam/realmonitor?channel={channel}&subtype=1',
      '/ch0_0.264',
      '/ch0_1.264',
      '/h264/ch{channel}/main/av_stream',
      '/stream{channel}',
      '/main',
      '/sub',
      '/video1',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: true,
    notes: 'CP Plus cameras use Dahua RTSP paths (/cam/realmonitor) or Ezykam/Tuya paths (/live/ch0, /onvif1). Default ONVIF port is 8899 or 80.',
  },
  dahua: {
    brand: 'dahua',
    displayName: 'Dahua',
    defaultRtspPort: 554,
    defaultOnvifPort: 80,
    rtspPathTemplates: [
      '/cam/realmonitor?channel={channel}&subtype=0',
      '/cam/realmonitor?channel={channel}&subtype=1',
      '/live',
      '/h264Preview_{channel:02d}_main',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: true,
    notes: 'Dahua standard path. CP Plus cameras use identical paths.',
  },
  hikvision: {
    brand: 'hikvision',
    displayName: 'Hikvision',
    defaultRtspPort: 554,
    defaultOnvifPort: 80,
    rtspPathTemplates: [
      '/Streaming/Channels/{channel}01',
      '/Streaming/Channels/{channel}02',
      '/h264/ch{channel}/main/av_stream',
      '/h264/ch{channel}/sub/av_stream',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: true,
    notes: 'Hikvision uses /Streaming/Channels/101 for channel 1 main stream.',
  },
  tplink_tapo: {
    brand: 'tplink_tapo',
    displayName: 'TP-Link Tapo',
    defaultRtspPort: 554,
    defaultOnvifPort: 2020,
    rtspPathTemplates: [
      '/stream1',
      '/stream2',
      '/h264Preview_01_main',
      '/video1',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: false,
    notes: 'Tapo cameras use username/password directly in RTSP URL.',
  },
  ezviz: {
    brand: 'ezviz',
    displayName: 'EZVIZ',
    defaultRtspPort: 554,
    defaultOnvifPort: 80,
    rtspPathTemplates: [
      '/h264/ch{channel}/main/av_stream',
      '/h264/ch{channel}/sub/av_stream',
      '/Streaming/Channels/{channel}01',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: true,
    notes: 'EZVIZ cameras use Hikvision-compatible paths (Hikvision OEM).',
  },
  onvif: {
    brand: 'onvif',
    displayName: 'Generic ONVIF',
    defaultRtspPort: 554,
    defaultOnvifPort: 80,
    rtspPathTemplates: [
      '/stream1',
      '/live/ch{channel}',
      '/h264',
      '/video',
      '/Streaming/Channels/{channel}01',
      '/cam/realmonitor?channel={channel}&subtype=0',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: true,
    notes: 'Generic ONVIF camera — stream URL will be discovered via ONVIF GetStreamUri.',
  },
  rtsp: {
    brand: 'rtsp',
    displayName: 'Generic RTSP',
    defaultRtspPort: 554,
    defaultOnvifPort: 80,
    rtspPathTemplates: [
      '/stream1',
      '/live',
      '/video',
      '/h264',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: false,
    notes: 'Generic RTSP — requires a custom RTSP path if auto-detection fails.',
  },
};

/**
 * Gets the BrandProfile for a given brand identifier.
 */
export function getBrandProfile(brand: CameraBrand): BrandProfile {
  return BRAND_PROFILES[brand];
}

/**
 * Resolves RTSP path templates by substituting placeholders.
 * @param template - e.g. '/cam/realmonitor?channel={channel}&subtype=0'
 * @param channel  - channel number (default 1)
 */
export function resolveRtspPath(template: string, channel: number = 1): string {
  const padded = String(channel).padStart(2, '0'); // e.g. 01, 02
  return template
    .replace(/\{channel\}/g, String(channel))
    .replace(/\{channel:02d\}/g, padded);
}

/**
 * Normalizes RTSP path or URI:
 * - If already a full RTSP URI, preserves it.
 * - If a relative path, ensures a leading slash and preserves queries without double encoding.
 */
export function normalizeRtspPath(rtspPath: string = ''): string {
  if (!rtspPath || !rtspPath.trim()) return '';
  const trimmed = rtspPath.trim();
  if (/^rtsp:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export interface ParsedRtspTarget {
  host: string;
  port: number;
  pathAndQuery: string;
  username?: string;
  password?: string;
}

/**
 * Parses RTSP path or full URI into its components:
 * Preserves host, port, path, and any query parameters intact.
 */
export function parseRtspTarget(
  ipAddress: string,
  defaultPort: number,
  pathOrUri: string = ''
): ParsedRtspTarget {
  const trimmed = (pathOrUri || '').trim();
  if (/^rtsp:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const isLoopback =
        url.hostname === '127.0.0.1' ||
        url.hostname === 'localhost' ||
        url.hostname === '0.0.0.0';
      const host = (!isLoopback && url.hostname) ? url.hostname : ipAddress;
      const port = url.port ? Number(url.port) : defaultPort;
      const pathAndQuery = (url.pathname || '/') + (url.search || '');
      return {
        host,
        port,
        pathAndQuery: pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`,
        username: url.username ? decodeURIComponent(url.username) : undefined,
        password: url.password ? decodeURIComponent(url.password) : undefined,
      };
    } catch {
      const m = trimmed.match(/^rtsp:\/\/(?:([^:@]+)(?::([^@]+))?@)?([^/:]+)(?::(\d+))?(\/.*)?$/i);
      if (m) {
        const isLoopback = m[3] === '127.0.0.1' || m[3] === 'localhost' || m[3] === '0.0.0.0';
        const host = (!isLoopback && m[3]) ? m[3] : ipAddress;
        const port = m[4] ? Number(m[4]) : defaultPort;
        const pathAndQuery = m[5] || '/';
        return {
          host,
          port,
          pathAndQuery: pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`,
          username: m[1] ? decodeURIComponent(m[1]) : undefined,
          password: m[2] ? decodeURIComponent(m[2]) : undefined,
        };
      }
    }
  }

  const normalized = normalizeRtspPath(trimmed);
  return {
    host: ipAddress,
    port: defaultPort,
    pathAndQuery: normalized || '/',
  };
}

/**
 * Builds a complete RTSP URL from parts or existing URI:
 * - Preserves host, port, path, and any query parameters.
 * - Safely encodes credentials with encodeURIComponent without double-encoding the path.
 * - Never logs or leaks plain passwords.
 */
export function buildRtspUrl(
  ipAddress: string,
  port: number,
  username?: string,
  password?: string,
  rtspPath: string = ''
): string {
  const parsed = parseRtspTarget(ipAddress, port, rtspPath);
  const finalUser = username !== undefined ? username : parsed.username;
  const finalPass = password !== undefined ? password : parsed.password;

  if (!finalUser && !finalPass) {
    return `rtsp://${parsed.host}:${parsed.port}${parsed.pathAndQuery}`;
  }

  const encodedUser = finalUser ? encodeURIComponent(finalUser) : '';
  const encodedPass = finalPass ? encodeURIComponent(finalPass) : '';
  const auth = encodedPass
    ? `${encodedUser}:${encodedPass}@`
    : encodedUser
    ? `${encodedUser}@`
    : '';

  return `rtsp://${auth}${parsed.host}:${parsed.port}${parsed.pathAndQuery}`;
}

/**
 * Builds a redacted RTSP URL for logging (password replaced with ***).
 * Strictly guarantees passwords are never exposed.
 */
export function buildRedactedRtspUrl(
  ipAddress: string,
  port: number,
  username?: string,
  rtspPath: string = ''
): string {
  const parsed = parseRtspTarget(ipAddress, port, rtspPath);
  const finalUser = username !== undefined ? username : parsed.username;

  if (!finalUser) {
    return `rtsp://${parsed.host}:${parsed.port}${parsed.pathAndQuery}`;
  }

  const encodedUser = encodeURIComponent(finalUser);
  return `rtsp://${encodedUser}:***@${parsed.host}:${parsed.port}${parsed.pathAndQuery}`;
}
