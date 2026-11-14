const configuredOrigins = (process.env.CORS_ORIGINS || process.env.APP_ORIGIN || process.env.FRONTEND_URL || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

export const allowedOrigins = new Set(configuredOrigins.map((value) => {
  try { return new URL(value).origin; } catch { return value.replace(/\/$/, ''); }
}));

export function isAllowedOrigin(origin, request = null) {
  if (!origin) return true;
  try {
    const normalized = new URL(origin).origin;
    if (allowedOrigins.has(normalized)) return true;
    if (request?.get) {
      const host = request.get('host');
      const forwardedProto = request.get('x-forwarded-proto');
      const protocol = forwardedProto || (request.secure ? 'https' : 'http');
      if (host && `${protocol}://${host}` === normalized) return true;
    }
    if (process.env.NODE_ENV !== 'production') {
      const parsed = new URL(normalized);
      return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    }
    return false;
  } catch {
    return false;
  }
}

export function corsOriginCallback(origin, callback) {
  if (!origin) return callback(null, true);
  try {
    const normalized = new URL(origin).origin;
    if (allowedOrigins.has(normalized)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') {
      const host = new URL(normalized).hostname;
      if (['localhost', '127.0.0.1', '::1'].includes(host)) return callback(null, true);
    }
  } catch { /* rejected below */ }
  // Returning false omits CORS permission; it does not bypass request-side CSRF checks.
  return callback(null, false);
}
