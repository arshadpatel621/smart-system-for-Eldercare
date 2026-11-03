import crypto from 'crypto';
import type { CameraRecord, PTZDirection } from './camera.types';
import { getDecryptedPassword } from './camera.repository';

const SOAP_TIMEOUT_MS = 4000;
const SOAP_ENVELOPE = `<?xml version="1.0" encoding="UTF-8"?>
<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope"
  xmlns:tds="http://www.onvif.org/ver10/device/wsdl"
  xmlns:trt="http://www.onvif.org/ver10/media/wsdl"
  xmlns:tptz="http://www.onvif.org/ver20/ptz/wsdl"
  xmlns:tt="http://www.onvif.org/ver10/schema">`;

export interface OnvifPtzConfiguration {
  ptzServiceUrl: string;
  profileToken: string;
  panTiltSpaceUri: string;
  panTiltMinX: number;
  panTiltMaxX: number;
  panTiltMinY: number;
  panTiltMaxY: number;
  zoomSpaceUri: string;
  zoomMin: number;
  zoomMax: number;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function getElement(xml: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(
    new RegExp(
      `<(?:[\\w.-]+:)?${escapedName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escapedName}\\s*>`,
      'i',
    ),
  );
  return match?.[1];
}

function hasElement(xml: string, name: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(
    `<(?:[\\w.-]+:)?${escapedName}\\b(?:[^>]*\\/\\s*>|[^>]*>)`,
    'i',
  ).test(xml);
}

function getAttribute(xml: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`\\b${escapedName}=["']([^"']+)["']`, 'i'));
  return match ? decodeXml(match[1]) : undefined;
}

function getRange(spaceXml: string, axis: 'X' | 'Y'): [number, number] {
  const range = getElement(spaceXml, `${axis}Range`);
  const min = Number(getElement(range ?? '', 'Min')?.replace(/<[^>]+>/g, ''));
  const max = Number(getElement(range ?? '', 'Max')?.replace(/<[^>]+>/g, ''));
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max || min > 0 || max < 0) {
    throw new Error(`Camera returned an invalid ONVIF ${axis} velocity range.`);
  }
  return [min, max];
}

function buildSecurityHeader(username: string, password: string): string {
  const nonce = crypto.randomBytes(16);
  const created = new Date().toISOString();
  const digest = crypto
    .createHash('sha1')
    .update(Buffer.concat([nonce, Buffer.from(created, 'utf8'), Buffer.from(password, 'utf8')]))
    .digest('base64');

  return `<s:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd"
      xmlns:wsu="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(username)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password>
        <wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonce.toString('base64')}</wsse:Nonce>
        <wsu:Created>${created}</wsu:Created>
      </wsse:UsernameToken>
    </wsse:Security>
  </s:Header>`;
}

async function postSoap(
  url: string,
  username: string,
  password: string,
  body: string,
  operation: string,
): Promise<string> {
  const envelope = `${SOAP_ENVELOPE}${buildSecurityHeader(username, password)}<s:Body>${body}</s:Body></s:Envelope>`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SOAP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/soap+xml; charset=utf-8' },
      body: envelope,
      signal: controller.signal,
    });
    const responseBody = await response.text();
    if (!response.ok) {
      throw new Error(`ONVIF ${operation} failed with HTTP ${response.status}.`);
    }

    const fault = getElement(responseBody, 'Fault');
    if (fault) {
      const reason = getElement(fault, 'Text') ?? getElement(fault, 'faultstring');
      throw new Error(
        `ONVIF ${operation} was rejected${reason ? `: ${decodeXml(reason.replace(/<[^>]+>/g, '').trim())}` : '.'}`,
      );
    }
    return responseBody;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`ONVIF ${operation} timed out after ${SOAP_TIMEOUT_MS / 1000}s.`);
    }
    if (error instanceof Error && error.message.startsWith('ONVIF ')) throw error;
    throw new Error(
      `ONVIF ${operation} request failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function serviceAddress(
  xml: string,
  namespaceUri: 'http://www.onvif.org/ver10/media/wsdl' | 'http://www.onvif.org/ver20/ptz/wsdl',
  serviceName: 'media' | 'ptz',
  camera: CameraRecord,
): string {
  const services = xml.match(/<(?:[\w.-]+:)?Service\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?Service>/gi) ?? [];
  const service = services.find((candidate) => {
    const namespace = getElement(candidate, 'Namespace');
    return namespace?.replace(/<[^>]+>/g, '').trim() === namespaceUri;
  });
  const advertisedAddress = service && getElement(service, 'XAddr');
  if (!advertisedAddress) {
    throw new Error(`Camera did not advertise an ONVIF ${serviceName} service.`);
  }

  let url: URL;
  try {
    url = new URL(decodeXml(advertisedAddress.replace(/<[^>]+>/g, '').trim()));
  } catch {
    throw new Error(`Camera advertised an invalid ONVIF ${serviceName} service URL.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Camera advertised an unsupported ONVIF service protocol.');
  }
  if (url.username || url.password) {
    throw new Error('Camera advertised an ONVIF service URL containing credentials.');
  }
  url.hostname = camera.ipAddress;
  return url.toString();
}

export async function discoverOnvifPtz(
  camera: CameraRecord,
): Promise<OnvifPtzConfiguration> {
  const password = getDecryptedPassword(camera);
  const deviceUrl = `http://${camera.ipAddress}:${camera.onvifPort}/onvif/device_service`;
  const services = await postSoap(
    deviceUrl,
    camera.username,
    password,
    '<tds:GetServices><tds:IncludeCapability>true</tds:IncludeCapability></tds:GetServices>',
    'GetServices',
  );
  const mediaUrl = serviceAddress(
    services,
    'http://www.onvif.org/ver10/media/wsdl',
    'media',
    camera,
  );
  const ptzServiceUrl = serviceAddress(
    services,
    'http://www.onvif.org/ver20/ptz/wsdl',
    'ptz',
    camera,
  );

  const profiles = await postSoap(
    mediaUrl,
    camera.username,
    password,
    '<trt:GetProfiles/>',
    'GetProfiles',
  );
  const profileBlocks = profiles.match(/<(?:[\w.-]+:)?Profiles\b[^>]*>[\s\S]*?<\/(?:[\w.-]+:)?Profiles>/gi) ?? [];
  const selectedProfile = profileBlocks.find((profile) => hasElement(profile, 'PTZConfiguration'));
  const profileToken = selectedProfile && getAttribute(selectedProfile, 'token');
  if (!selectedProfile || !profileToken) {
    throw new Error('Camera has no ONVIF media profile with PTZ configuration.');
  }

  const nodes = await postSoap(
    ptzServiceUrl,
    camera.username,
    password,
    '<tptz:GetNodes/>',
    'GetNodes',
  );
  const spaces = getElement(nodes, 'SupportedPTZSpaces');
  const panTiltSpace = spaces && getElement(spaces, 'ContinuousPanTiltVelocitySpace');
  const zoomSpace = spaces && getElement(spaces, 'ContinuousZoomVelocitySpace');
  if (!panTiltSpace || !zoomSpace) {
    throw new Error('Camera does not advertise continuous ONVIF pan/tilt and zoom velocity spaces.');
  }

  const panTiltSpaceUri = getElement(panTiltSpace, 'URI');
  const zoomSpaceUri = getElement(zoomSpace, 'URI');
  if (!panTiltSpaceUri || !zoomSpaceUri) {
    throw new Error('Camera returned incomplete ONVIF PTZ velocity-space information.');
  }
  const [panTiltMinX, panTiltMaxX] = getRange(panTiltSpace, 'X');
  const [panTiltMinY, panTiltMaxY] = getRange(panTiltSpace, 'Y');
  const [zoomMin, zoomMax] = getRange(zoomSpace, 'X');

  return {
    ptzServiceUrl,
    profileToken,
    panTiltSpaceUri: decodeXml(panTiltSpaceUri.replace(/<[^>]+>/g, '').trim()),
    panTiltMinX,
    panTiltMaxX,
    panTiltMinY,
    panTiltMaxY,
    zoomSpaceUri: decodeXml(zoomSpaceUri.replace(/<[^>]+>/g, '').trim()),
    zoomMin,
    zoomMax,
  };
}

function velocity(rangeMin: number, rangeMax: number, direction: -1 | 0 | 1, speed: number): number {
  if (direction === 0) return 0;
  const magnitude = Math.min(1, Math.max(1, speed) / 10);
  return direction < 0 ? Math.abs(rangeMin) * -magnitude : rangeMax * magnitude;
}

export async function sendOnvifPtzCommand(
  camera: CameraRecord,
  configuration: OnvifPtzConfiguration,
  action: PTZDirection,
  speed: number,
): Promise<void> {
  const password = getDecryptedPassword(camera);
  let body: string;

  if (action === 'stop') {
    body = `<tptz:Stop><tptz:ProfileToken>${escapeXml(configuration.profileToken)}</tptz:ProfileToken><tptz:PanTilt>true</tptz:PanTilt><tptz:Zoom>true</tptz:Zoom></tptz:Stop>`;
  } else if (action === 'home') {
    body = `<tptz:GotoHomePosition><tptz:ProfileToken>${escapeXml(configuration.profileToken)}</tptz:ProfileToken></tptz:GotoHomePosition>`;
  } else {
    const x = velocity(
      configuration.panTiltMinX,
      configuration.panTiltMaxX,
      action === 'left' ? -1 : action === 'right' ? 1 : 0,
      speed,
    );
    const y = velocity(
      configuration.panTiltMinY,
      configuration.panTiltMaxY,
      action === 'down' ? -1 : action === 'up' ? 1 : 0,
      speed,
    );
    const zoom = velocity(
      configuration.zoomMin,
      configuration.zoomMax,
      action === 'zoom_in' ? 1 : action === 'zoom_out' ? -1 : 0,
      speed,
    );
    body = `<tptz:ContinuousMove><tptz:ProfileToken>${escapeXml(configuration.profileToken)}</tptz:ProfileToken><tptz:Velocity><tt:PanTilt x="${x.toFixed(3)}" y="${y.toFixed(3)}" space="${escapeXml(configuration.panTiltSpaceUri)}"/><tt:Zoom x="${zoom.toFixed(3)}" space="${escapeXml(configuration.zoomSpaceUri)}"/></tptz:Velocity></tptz:ContinuousMove>`;
  }

  const operation =
    action === 'stop' ? 'Stop' : action === 'home' ? 'GotoHomePosition' : 'ContinuousMove';
  await postSoap(
    configuration.ptzServiceUrl,
    camera.username,
    password,
    body,
    operation,
  );
}
