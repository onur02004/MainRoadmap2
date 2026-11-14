export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  // Report-only until the existing inline scripts and third-party embeds are migrated
  // to nonces/hashes. This allows production CSP violations to be identified safely.
  res.setHeader('Content-Security-Policy-Report-Only', [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https:",
    "style-src 'self' 'unsafe-inline' https:",
    "script-src 'self' 'unsafe-inline' https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://open.spotify.com https://www.youtube.com https://youtube.com"
  ].join('; '));
  next();
}

export function csrfOriginGuard(req, res, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // non-browser clients; cookie auth remains SameSite=Lax
  try {
    const normalized = new URL(origin).origin;
    const requestOrigin = `${req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http')}://${req.get('host')}`;
    const configured = (process.env.CORS_ORIGINS || process.env.APP_ORIGIN || process.env.FRONTEND_URL || '')
      .split(',').map((value) => value.trim()).filter(Boolean).map((value) => {
        try { return new URL(value).origin; } catch { return value.replace(/\/$/, ''); }
      });
    const localDev = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1', '::1'].includes(new URL(normalized).hostname);
    if (normalized !== requestOrigin && !configured.includes(normalized) && !localDev) {
      return res.status(403).json({ status: 'error', message: 'İstek kaynağı doğrulanamadı.' });
    }
  } catch {
    return res.status(403).json({ status: 'error', message: 'Geçersiz istek kaynağı.' });
  }
  return next();
}
