import { NextRequest, NextResponse } from 'next/server';
import { networkInterfaces } from 'os';

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

export async function GET(req: NextRequest) {
  // Use the Host header from the actual request to determine the external URL
  const host = req.headers.get('host') || '';
  const proto = req.headers.get('x-forwarded-proto') || 'http';

  // If accessed via localhost, try to substitute with LAN IP
  let urlHost = host;
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    const localIp = getLocalIp();
    const port = host.includes(':') ? host.split(':')[1] : '';
    urlHost = port ? `${localIp}:${port}` : localIp;
  }

  const baseUrl = `${proto}://${urlHost}`;
  return NextResponse.json({ url: baseUrl, mobileUrl: `${baseUrl}/mobile` });
}