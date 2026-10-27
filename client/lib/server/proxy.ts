// Server-only: forwards the browser's same-origin /api/v1/* and /admin/api/v1/*
// calls to the FastAPI service. Same idea as the shaapi BFF: the image does not
// bake an API URL at build time (NEXT_PUBLIC_*), it reads API_INTERNAL_URL at
// runtime, so one GHCR image runs on any Dokploy domain. The refresh cookie
// stays first-party since the browser only ever talks to this origin.
import type { NextRequest } from 'next/server';

const API_URL = (process.env.API_INTERNAL_URL || 'http://localhost:8000').replace(/\/$/, '');

// Request headers worth passing on; everything else (host, connection...) is
// set by fetch for the upstream hop.
const FORWARD_REQUEST = ['authorization', 'content-type', 'cookie', 'accept', 'accept-language', 'user-agent'];
const FORWARD_RESPONSE = ['content-type', 'content-disposition', 'cache-control', 'x-request-id'];

/**
 * Original client IP, so the API's per-IP rate limits apply per visitor.
 *
 * The LAST entry is the one the edge proxy (Traefik on Dokploy) appended; the
 * first is whatever the browser chose to send, and trusting it would let any
 * client dodge the login and sign-up limits by inventing an address.
 */
function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',').at(-1)!.trim();
  return req.headers.get('x-real-ip') || '0.0.0.0';
}

export async function proxy(req: NextRequest, prefix: string, parts: string[]): Promise<Response> {
  // Dot segments would be normalised by fetch and could escape the prefix.
  if (parts.some((p) => p === '.' || p === '..' || p === '')) {
    return Response.json({ code: 404, msg: 'Route non disponible', data: null }, { status: 404 });
  }
  const path = parts.map(encodeURIComponent).join('/');

  const headers = new Headers();
  for (const name of FORWARD_REQUEST) {
    const value = req.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-forwarded-for', clientIp(req));
  headers.set('x-forwarded-proto', req.nextUrl.protocol.replace(':', ''));

  const hasBody = !['GET', 'HEAD'].includes(req.method);
  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}${prefix}/${path}${req.nextUrl.search}`, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: 'no-store',
      redirect: 'manual',
    });
  } catch {
    return Response.json({ code: 502, msg: 'API injoignable', data: null }, { status: 502 });
  }

  const out = new Headers();
  for (const name of FORWARD_RESPONSE) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  // Several Set-Cookie headers must stay separate (refresh token + deletes).
  for (const cookie of upstream.headers.getSetCookie()) out.append('set-cookie', cookie);

  return new Response(upstream.body, { status: upstream.status, headers: out });
}
