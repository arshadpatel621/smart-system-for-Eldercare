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
    defaultOnvifPort: 80,
    rtspPathTemplates: [
      '/cam/realmonitor?channel={channel}&subtype=0',
      '/cam/realmonitor?channel={channel}&subtype=1',
      '/h264/ch{channel}/main/av_stream',
      '/stream{channel}',
    ],
    onvifPath: '/onvif/device_service',
    usesDigestAuth: true,
    notes: 'CP Plus cameras (Dahua OEM) use Dahua RTSP paths.',
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
 * Builds a complete RTSP URL from parts, never logging the password.
 */
export function buildRtspUrl(
  ipAddress: string,
  port: number,
  username: string,
  password: string,
  rtspPath: string
): string {
  const encodedUser = encodeURIComponent(username);
  const encodedPass = encodeURIComponent(password);
  return `rtsp://${encodedUser}:${encodedPass}@${ipAddress}:${port}${rtspPath}`;
}

/**
 * Builds a redacted RTSP URL for logging (password replaced with ***).
 */
export function buildRedactedRtspUrl(
  ipAddress: string,
  port: number,
  username: string,
  rtspPath: string
): string {
  return `rtsp://${username}:***@${ipAddress}:${port}${rtspPath}`;
}
