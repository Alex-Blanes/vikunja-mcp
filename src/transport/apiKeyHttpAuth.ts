/**
 * Shared static API key for `transport=http` (Alex-Blanes soft-fork patch).
 *
 * Upstream only serves HTTP behind OIDC. This deployment has a handful of
 * trusted clients on a private network (Claude Code, Hermes, lab-ia) and no
 * identity provider, so they share one key in the `X-API-Key` header instead.
 *
 * The middleware attaches no request identity, so every call runs on the
 * process-wide credential auto-connected from `VIKUNJA_URL` /
 * `VIKUNJA_API_TOKEN` in src/index.ts — single-user, exactly like stdio mode.
 */

import { timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setOidcAuthMiddleware } from './oidcMiddlewareSeam';

/**
 * Constant-time check of the `X-API-Key` header.
 *
 * A plain === leaks the length of the matching prefix through how long it takes
 * to fail, which is enough to recover a key one character at a time.
 */
export function hasValidApiKey(req: IncomingMessage, expected: string): boolean {
  const received = req.headers['x-api-key'];
  if (typeof received !== 'string') {
    return false;
  }

  const a = Buffer.from(received, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  // timingSafeEqual throws on length mismatch, so the lengths are compared
  // first. Key length is not the secret; its contents are.
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Register the API-key check on the transport auth seam. */
export function setupApiKeyHttpAuth(apiKey: string): void {
  setOidcAuthMiddleware((req: IncomingMessage, res: ServerResponse) => {
    if (hasValidApiKey(req, apiKey)) {
      return Promise.resolve(true);
    }
    res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'invalid_api_key' }));
    return Promise.resolve(false);
  });
}
