import { createHash } from 'node:crypto';
import { HttpError } from './http.js';

const unsafeMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function securityHeaders(request, response, next) {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  response.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=()');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  next();
}

export function requireTrustedOrigin(trustedOrigins) {
  const allowed = new Set(trustedOrigins);
  return (request, response, next) => {
    if (!unsafeMethods.has(request.method)) return next();
    const origin = request.get('origin');
    const fetchSite = request.get('sec-fetch-site');
    if (fetchSite === 'cross-site' || (origin && !allowed.has(origin))) {
      return next(new HttpError(403, 'UNTRUSTED_ORIGIN', 'Nguồn gửi yêu cầu không được phép'));
    }
    return next();
  };
}

export function requireJsonBody(request, response, next) {
  if (!unsafeMethods.has(request.method)) return next();
  const hasBody = request.get('content-length') !== undefined || request.get('transfer-encoding') !== undefined;
  if (!hasBody) {
    request.body = {};
    return next();
  }
  if (hasBody && !request.is('application/json')) {
    return next(new HttpError(415, 'JSON_REQUIRED', 'Nội dung yêu cầu phải dùng application/json'));
  }
  if (request.body === null || Array.isArray(request.body) || typeof request.body !== 'object') {
    return next(new HttpError(400, 'INVALID_JSON_BODY', 'Nội dung JSON phải là một object'));
  }
  return next();
}

const digest = (value) => createHash('sha256').update(String(value)).digest('base64url').slice(0, 16);

export function createRateLimiter({ windowMs, max, key = (request) => request.ip, skipSuccessfulRequests = false, maxEntries = 10_000 }) {
  const buckets = new Map();

  return (request, response, next) => {
    const now = Date.now();
    const bucketKey = String(key(request));
    let bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && buckets.size >= maxEntries) buckets.delete(buckets.keys().next().value);
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    response.setHeader('RateLimit-Limit', String(max));
    response.setHeader('RateLimit-Remaining', String(remaining));
    response.setHeader('RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (skipSuccessfulRequests) {
      response.once('finish', () => {
        if (response.statusCode < 400) bucket.count = Math.max(0, bucket.count - 1);
      });
    }

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      response.setHeader('Retry-After', String(retryAfter));
      return next(new HttpError(429, 'RATE_LIMITED', 'Có quá nhiều yêu cầu, vui lòng thử lại sau'));
    }
    return next();
  };
}

export function loginRateLimitKey(request) {
  return `${request.ip}:${digest(String(request.body?.username ?? '').trim().toLowerCase())}`;
}
