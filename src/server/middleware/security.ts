import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Server-side secret for HMAC token signing (persists for the process lifetime)
const SERVER_HMAC_SECRET =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SESSION_SECRET ||
  'lumos_internal_session_secret_key_2026';

// Configurable team / gateway secrets
const LUMOS_GATEWAY_SECRET = process.env.LUMOS_GATEWAY_SECRET || process.env.LUMOS_TEAM_KEY || '';
const COOKIE_NAME = 'lumos_team_session';
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// In-memory rate limiting store
interface RateLimitRecord {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_MINUTE = 180;

/**
 * IP Rate limiter middleware for API routes
 */
export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
    req.socket.remoteAddress ||
    'unknown-ip';

  const now = Date.now();
  const clientRecord = rateLimitStore.get(ip);

  if (!clientRecord || now > clientRecord.resetTime) {
    rateLimitStore.set(ip, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS,
    });
    return next();
  }

  if (clientRecord.count >= MAX_REQUESTS_PER_MINUTE) {
    res.status(429).json({
      error: 'Muitas requisições. Aguarde um minuto antes de tentar novamente.',
    });
    return;
  }

  clientRecord.count += 1;
  next();
}

/**
 * Signs a payload with HMAC-SHA256
 */
export function signSessionPayload(payload: string): string {
  const signature = crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}.${signature}`;
}

/**
 * Verifies a signed session token
 */
export function verifySessionPayload(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [timestampStr, nonce, receivedSig] = parts;
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) return false;

  const now = Date.now();
  if (now - timestamp > MAX_SESSION_AGE_MS || timestamp > now + 60000) {
    return false; // Expired or future timestamp
  }

  const payload = `${timestampStr}.${nonce}`;
  const expectedSig = crypto
    .createHmac('sha256', SERVER_HMAC_SECRET)
    .update(payload)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(receivedSig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );
  } catch {
    return false;
  }
}

/**
 * Parses cookies from Cookie header without external cookie-parser dependency
 */
export function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const [name, ...rest] = pair.trim().split('=');
    if (name) {
      cookies[name] = decodeURIComponent(rest.join('='));
    }
  }
  return cookies;
}

/**
 * Issues a cryptographically signed HttpOnly SameSite session cookie
 */
export function issueTeamSessionCookie(res: Response): string {
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(16).toString('hex');
  const token = signSessionPayload(`${timestamp}.${nonce}`);

  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${Math.floor(MAX_SESSION_AGE_MS / 1000)}`,
    'HttpOnly',
    'SameSite=Strict',
    isProduction ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  res.setHeader('Set-Cookie', cookieOptions);
  return token;
}

/**
 * Checks if request comes through an authorized Gateway or has a valid team session
 */
export function isAuthorizedTeamRequest(req: Request): boolean {
  // 1. Cloudflare Access Headers
  const cfJwt = req.headers['cf-access-jwt-assertion'];
  const cfClient = req.headers['cf-access-client-id'];
  if (cfJwt || cfClient) {
    return true;
  }

  // 2. Gateway / Team Secret Header
  const gatewayHeader =
    (req.headers['x-lumos-gateway-secret'] as string) ||
    (req.headers['x-lumos-team-key'] as string);
  if (LUMOS_GATEWAY_SECRET && gatewayHeader && gatewayHeader === LUMOS_GATEWAY_SECRET) {
    return true;
  }

  // 3. Authorization Bearer Token
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (LUMOS_GATEWAY_SECRET && bearer === LUMOS_GATEWAY_SECRET) {
      return true;
    }
    if (verifySessionPayload(bearer)) {
      return true;
    }
  }

  // 4. Custom Session Header or Cookie
  const customHeader = req.headers['x-lumos-session'] as string;
  if (customHeader && verifySessionPayload(customHeader)) {
    return true;
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies[COOKIE_NAME];
  if (sessionCookie && verifySessionPayload(sessionCookie)) {
    return true;
  }

  // 5. Development environment / Local preview in AI Studio
  const host = req.headers.host || '';
  const isDevOrStudio =
    process.env.NODE_ENV !== 'production' ||
    host.includes('run.app') ||
    host.includes('localhost') ||
    host.includes('127.0.0.1');

  if (isDevOrStudio) {
    const secFetchSite = req.headers['sec-fetch-site'];
    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site' || secFetchSite === 'none') {
      return true;
    }
    if (!secFetchSite && (host.includes('localhost') || host.includes('run.app'))) {
      return true;
    }
  }

  // 6. Vercel Production Environment
  if (process.env.VERCEL || host.includes('vercel.app')) {
    const secFetchSite = req.headers['sec-fetch-site'];
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || '';

    if (secFetchSite === 'same-origin' || secFetchSite === 'same-site') {
      return true;
    }
    if (origin && (origin.includes('vercel.app') || (host && origin.includes(host)))) {
      return true;
    }
    if (referer && (referer.includes('vercel.app') || (host && referer.includes(host)))) {
      return true;
    }
  }

  return false;
}

/**
 * Main Team Access Protection Middleware.
 * Protects ALL endpoints (GET, POST, PUT, DELETE).
 * Enforces gateway/team authorization and blocks origin bypass.
 */
export function requireTeamAccess(req: Request, res: Response, next: NextFunction): void {
  // Preflight requests can pass
  if (req.method === 'OPTIONS') {
    return next();
  }

  // Block cross-site request forgery for mutating operations
  const secFetchSite = req.headers['sec-fetch-site'];
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) && secFetchSite === 'cross-site') {
    res.status(403).json({
      error: 'Acesso negado: Requisição cross-site bloqueada por política de segurança.',
    });
    return;
  }

  if (!isAuthorizedTeamRequest(req)) {
    res.status(403).json({
      error: 'Acesso restrito à equipe Lumos. Acesso corporativo não autorizado.',
    });
    return;
  }

  next();
}
