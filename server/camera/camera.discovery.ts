/**
 * camera.discovery.ts
 * LAN-based auto-discovery for ONVIF-compatible IP cameras.
 *
 * Uses UDP multicast WS-Discovery (the standard ONVIF discovery mechanism)
 * to find cameras on the local network without requiring the user to know IPs.
 *
 * After discovering devices, probes each for actual ONVIF port and RTSP availability.
 */

import dgram from 'dgram';
import http from 'http';
import net from 'net';
import type { DiscoveredCamera } from './camera.types';

// WS-Discovery multicast address and port (ONVIF standard)
const WSD_MULTICAST_ADDR = '239.255.255.250';
const WSD_PORT = 3702;
const DISCOVERY_TIMEOUT_MS = 4000;

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

interface DiscoveredTarget {
  ip: string;
  onvifPort: number;
}

/**
 * Parses XAddrs or returns empty array.
 */
function extractDiscoveredTargets(xmlResponse: string, senderIp: string): DiscoveredTarget[] {
  const targets: DiscoveredTarget[] = [];
  // Match http://<ip>:<port>/onvif/device_service or similar XAddrs
  const xaddrRegex = /http:\/\/([\d.]+):?(\d+)?\/(?:onvif\/)?device_service/gi;
  let match: RegExpExecArray | null;

  while ((match = xaddrRegex.exec(xmlResponse)) !== null) {
    const ip = match[1];
    const port = match[2] ? parseInt(match[2], 10) : 80;
    if (ip && !ip.startsWith('239.') && !ip.startsWith('255.')) {
      targets.push({ ip, onvifPort: port });
    }
  }

  // If no XAddr matched, fallback to sender IP and standard port 80
  if (targets.length === 0 && senderIp && !senderIp.startsWith('239.') && !senderIp.startsWith('255.')) {
    targets.push({ ip: senderIp, onvifPort: 80 });
  }

  return targets;
}

/**
 * Extracts a field value from a simple XML response.
 */
function extractXml(xml: string, tag: string): string | undefined {
  const match = xml.match(new RegExp(`<(?:[^:]+:)?${tag}[^>]*>([^<]+)<`));
  return match?.[1]?.trim();
}

/**
 * Queries ONVIF device information from a discovered camera IP and port.
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
      timeout: 2500,
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
 * Checks whether RTSP ports 554 or 8554 are open on a given IP.
 */
async function checkRtspAvailability(ipAddress: string): Promise<boolean> {
  const checkPort = (port: number): Promise<boolean> =>
    new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(1500);
      socket.connect(port, ipAddress, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
    });

  const [p554, p8554] = await Promise.all([checkPort(554), checkPort(8554)]);
  return p554 || p8554;
}

/**
 * Broadcasts a WS-Discovery Probe on the LAN and returns discovered camera targets.
 */
function discoverOnvifTargets(): Promise<DiscoveredTarget[]> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    const targetMap = new Map<string, DiscoveredTarget>();

    socket.on('message', (msg, rinfo) => {
      const xml = msg.toString();
      const targets = extractDiscoveredTargets(xml, rinfo.address);
      for (const t of targets) {
        // Prioritize non-80 ports if discovered (e.g. 8899, 2020)
        if (!targetMap.has(t.ip) || (t.onvifPort !== 80 && targetMap.get(t.ip)?.onvifPort === 80)) {
          targetMap.set(t.ip, t);
        }
      }
    });

    socket.on('error', (err) => {
      console.warn('[Discovery] UDP socket error:', err.message);
    });

    socket.bind(0, () => {
      try {
        socket.addMembership(WSD_MULTICAST_ADDR);
      } catch {
        // If interface membership fails on virtual adapters, socket still sends
      }
      const probe = Buffer.from(WSD_PROBE, 'utf8');
      socket.send(probe, 0, probe.length, WSD_PORT, WSD_MULTICAST_ADDR);
    });

    // Collect responses for DISCOVERY_TIMEOUT_MS then resolve
    setTimeout(() => {
      try {
        socket.close();
      } catch {
        // Ignore close errors
      }
      resolve(Array.from(targetMap.values()));
    }, DISCOVERY_TIMEOUT_MS);
  });
}

/**
 * Scans the LAN for ONVIF cameras using WS-Discovery.
 * Returns enriched camera details for each discovered device.
 */
export async function discoverCamerasOnLAN(): Promise<DiscoveredCamera[]> {
  console.log('[Discovery] Starting ONVIF WS-Discovery scan...');

  const targets = await discoverOnvifTargets();
  console.log(
    `[Discovery] Found ${targets.length} candidate target(s): ${targets.map((t) => `${t.ip}:${t.onvifPort}`).join(', ')}`
  );

  if (targets.length === 0) {
    console.log('[Discovery] No ONVIF devices responded to WS-Discovery probe.');
    return [];
  }

  // Enrich each discovered target concurrently
  const results = await Promise.all(
    targets.map(async (target): Promise<DiscoveredCamera> => {
      const [deviceInfo, rtspAvailable] = await Promise.all([
        fetchOnvifDeviceInfo(target.ip, target.onvifPort),
        checkRtspAvailability(target.ip),
      ]);

      return {
        ipAddress: target.ip,
        manufacturer: deviceInfo.manufacturer,
        model: deviceInfo.model,
        onvifVersion: deviceInfo.onvifVersion,
        rtspAvailable,
        onvifPort: target.onvifPort,
        discoveredAt: new Date().toISOString(),
      };
    })
  );

  console.log(`[Discovery] Enriched ${results.length} device(s).`);
  return results;
}
