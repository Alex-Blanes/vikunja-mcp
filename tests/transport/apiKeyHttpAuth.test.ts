import type { IncomingMessage, ServerResponse } from 'node:http';
import { hasValidApiKey, setupApiKeyHttpAuth } from '../../src/transport/apiKeyHttpAuth';
import { getOidcAuthMiddleware, setOidcAuthMiddleware } from '../../src/transport/oidcMiddlewareSeam';

const req = (key?: unknown): IncomingMessage =>
  ({ headers: key === undefined ? {} : { 'x-api-key': key } }) as unknown as IncomingMessage;

describe('apiKeyHttpAuth', () => {
  afterEach(() => setOidcAuthMiddleware(undefined));

  it('accepts only the exact key', () => {
    expect(hasValidApiKey(req('secret'), 'secret')).toBe(true);
    expect(hasValidApiKey(req('secreT'), 'secret')).toBe(false);
    expect(hasValidApiKey(req('secret-but-longer'), 'secret')).toBe(false);
    expect(hasValidApiKey(req(), 'secret')).toBe(false);
    expect(hasValidApiKey(req(['secret']), 'secret')).toBe(false);
  });

  it('lets a valid request through and answers 401 otherwise', async () => {
    setupApiKeyHttpAuth('secret');
    const middleware = getOidcAuthMiddleware();
    if (!middleware) throw new Error('middleware not registered');
    const res = { writeHead: jest.fn(), end: jest.fn() } as unknown as ServerResponse;

    await expect(middleware(req('secret'), res)).resolves.toBe(true);
    expect(res.writeHead).not.toHaveBeenCalled();

    await expect(middleware(req('wrong'), res)).resolves.toBe(false);
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
    expect(res.end).toHaveBeenCalledWith(JSON.stringify({ error: 'invalid_api_key' }));
  });
});
