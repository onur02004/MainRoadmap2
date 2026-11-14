const buckets = new Map();
let cleanupAt = Date.now() + 60_000;

export function createRateLimit({ windowMs = 60_000, max = 60, keyGenerator } = {}) {
  return (req, res, next) => {
    const now = Date.now();
    if (now >= cleanupAt) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key);
      }
      cleanupAt = now + 60_000;
    }

    const identity = keyGenerator
      ? keyGenerator(req)
      : (req.user?.id ? `user:${req.user.id}` : `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`);
    const routeKey = keyGenerator ? 'custom' : `${req.baseUrl || ''}:${req.route?.path || req.path}`;
    const key = `${routeKey}:${identity}`;
    // Bound memory even when callers generate many unique paths/IPs.
    if (!buckets.has(key) && buckets.size > 20_000) {
      const oldestKey = buckets.keys().next().value;
      if (oldestKey) buckets.delete(oldestKey);
    }
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      return res.status(429).json({ status: 'error', message: 'Çok fazla istek gönderdin. Lütfen biraz sonra tekrar dene.' });
    }
    return next();
  };
}
