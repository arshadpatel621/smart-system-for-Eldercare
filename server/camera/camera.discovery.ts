/**
 * camera.discovery.ts
 * LAN-based auto-discovery for ONVIF-compatible IP cameras.
 *
 * Uses UDP multicast WS-Discovery (the standard ONVIF discovery mechanism)
 * to find cameras on the local network without requiring the user to know IPs.
 *
 * After discovering devices, probes each for RTSP availability.
 */

import dgram from 'dgram';
import http from 'http';
import type { DiscoveredCamera } from './camera.types';

// WS-Discovery multicast address and port (ONVIF standard)
const WSD_MULTICAST_ADDR = '239.255.255.250';
const WSD_PORT = 3702;
const DISCOVERY_TIMEOUT_MS = 5000;

// WS-Discovery Probe message (ONVIF compliant)
const WSD_PROBE = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
  xmlns:wsa="http://schemas.xmlsoap.org/ws/2004/08/addressing"
  xmlns:wsd="http://schemas.xmlsoap.org/ws/2005/04/discovery"
  xmlns:dn="http://www.onvif.org/ver10/network/wsdl">
  <soap:Header>
    <wsa:Action>http://schemas.xmlsoap.org/ws/2005/04/discovery/Probe</wsa:Action>
    <wsa:MessageID>urn:uuid:${Math.random().toString(36).slice(2)}</wsa:MessageID>
    <wsa:To>urn:schemas-xmlsoap-org:ws:2005:04:discovery</wsa:To>
  </soap:Header>
  <soap:Body>
    <wsd:Probe>
      <wsd:Types>dn:NetworkVideoTransmitter</wsd:Types>
    </wsd:Probe>
  </soap:Body>
</soap:Envelope>`;

/**
 * Extracts IP addresses from WS-Discovery XAddrs field responses.
 */
function extractIpAddresses(xmlResponse: string): string[] {
  const matches = xmlResponse.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Extracts a field value from a simple XML response.
 */
function extractXml(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]+)<`));
  return match?.[1]?.trim();
}

/**
 * Queries ONVIF device information from a discovered camera IP.
 */
async function fetchOnvifDeviceInfo(
  ipAddress: string,
  port: number = 80
): Promise<Pick<DiscoveredCamera, 'manufacturer' | 'model' | 'onvifVersion'>> {
  const soapBody = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:tds="http://www.onvif.org/ver10/device/wsdl">
  <soap:Body><tds:GetDeviceInformation/></soap:Body>
</soap:Envelope>`;

  return new Promise((resolve) => {
    const options: http.RequestOptions = {
      hostname: ipAddress,
      port,
      path: '/onvif/device_service',
      method: 'POST',
      headers: {
        'Content-Type': 'application/soap+xml',
        'Content-Length': Buffer.byteLength(soapBody),
      },
      timeout: 3000,
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          manufacturer: extractXml(data, 'Manufacturer'),
          model: extractXml(data, 'Model'),
          onvifVersion: '2.0',
        });
      });
    });

    req.on('error', () => resolve({}));
    req.on('timeout', () => { req.destroy(); resolve({}); });
    req.write(soapBody);
    req.end();
  });
}

/**
 * Checks whether RTSP port 554 is open on a given IP.
 */
async function checkRtspAvailability(ipAddress: string): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(2000);
    socket.connect(554, ipAddress, () => { socket.destroy(); resolve(true); });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => { socket.destroy(); resolve(false); });
  });
}

/**
 * Broadcasts a WS-Discovery Probe on the LAN and returns unique responding IPs.
 */
function discoverOnvifIps(): Promise<string[]> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const discoveredIps = new Set<string>();

    socket.on('message', (msg) => {
      const xml = msg.toString();
      const ips = extractIpAddresses(xml);
      ips.forEach((ip) => {
        // Exclude multicast/broadcast addresses
        if (!ip.startsWith('239.') && !ip.startsWith('255.')) {
          discoveredIps.add(ip);
        }
      });
    });

    socket.bind(0, () => {
      socket.addMembership(WSD_MULTICAST_ADDR);
      const probe = Buffer.from(WSD_PROBE, 'utf8');
      socket.send(probe, 0, probe.length, WSD_PORT, WSD_MULTICAST_ADDR);
    });

    socket.on('error', (err) => {
      console.warn('[Discovery] UDP socket error:', err.message);
    });

    // Collect responses for DISCOVERY_TIMEOUT_MS then resolve
    setTimeout(() => {
      socket.close();
      resolve([...discoveredIps]);
    }, DISCOVERY_TIMEOUT_MS);
  });
}

/**
 * Scans the LAN for ONVIF cameras using WS-Discovery.
 * Returns enriched camera details for each discovered device.
 *
 * @returns Array of discovered cameras with IP, brand metadata, and stream info
 */
export async function discoverCamerasOnLAN(): Promise<DiscoveredCamera[]> {
  console.log('[Discovery] Starting ONVIF WS-Discovery scan...');

  const discoveredIps = await discoverOnvifIps();
  console.log(`[Discovery] Found ${discoveredIps.length} candidate IP(s): ${discoveredIps.join(', ')}`);

  if (discoveredIps.length === 0) {
    console.log('[Discovery] No ONVIF devices responded to WS-Discovery probe.');
    return [];
  }

  // Enrich each discovered IP concurrently
  const results = await Promise.all(
    discoveredIps.map(async (ip): Promise<DiscoveredCamera> => {
      const [deviceInfo, rtspAvailable] = await Promise.all([
        fetchOnvifDeviceInfo(ip),
        checkRtspAvailability(ip),
      ]);

      return {
        ipAddress: ip,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        onvifVersion: deviceInfo.onvifVersion,
        rtspAvailable,
        onvifPort: 80,
        discoveredAt: new Date().toISOString(),
      };
    })
  );

  console.log(`[Discovery] Enriched ${results.length} device(s).`);
  return results;
}
