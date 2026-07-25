/**
 * Activity Logger — server-side only.
 * Inserts a row into `activity_logs` using the service-role client (bypasses RLS).
 * Call this from Server Actions and API Route Handlers.
 */
import { createAdminClient } from '@/lib/supabase/admin';

export type LogAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'INVITE_USER'
  | 'UPDATE_ROLE'
  | 'DELETE_USER'
  | 'DATA_ENTRY'
  | 'DATA_UPDATE'
  | 'DATA_DELETE'
  | 'PAGE_VIEW';

export interface LogPayload {
  userId?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  department?: string | null;
  action: LogAction;
  details?: string | null;
  /** Pass the raw NextRequest / Request so we can extract IP & User-Agent */
  request?: Request | { headers: Headers };
}

interface GeoInfo {
  city: string | null;
  country: string | null;
}

/** Extract client IP from common headers (works on Vercel & localhost) */
function extractIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    null
  );
}

/** Geo-locate an IP using ip-api.com (free, no key, 45 req/min) */
async function geoLocate(ip: string | null): Promise<GeoInfo> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { city: 'Localhost', country: 'Local' };
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,status`, {
      signal: AbortSignal.timeout(3000), // 3 s timeout — never block the main request
    });
    if (!res.ok) return { city: null, country: null };
    const data = await res.json();
    if (data.status === 'success') {
      return { city: data.city ?? null, country: data.country ?? null };
    }
    return { city: null, country: null };
  } catch {
    return { city: null, country: null };
  }
}

/**
 * Log an activity event.
 * This function is fire-and-forget (it does not throw).
 */
export async function logActivity(payload: LogPayload): Promise<void> {
  try {
    const admin = createAdminClient();

    let ipAddress: string | null = null;
    let userAgent: string | null = null;
    let city: string | null = null;
    let country: string | null = null;

    if (payload.request) {
      const headers = payload.request.headers;
      ipAddress = extractIp(headers);
      userAgent = headers.get('user-agent');
      const geo = await geoLocate(ipAddress);
      city = geo.city;
      country = geo.country;
    }

    await admin.from('activity_logs').insert({
      user_id:    payload.userId    ?? null,
      user_name:  payload.userName  ?? null,
      user_email: payload.userEmail ?? null,
      department: payload.department ?? null,
      action:     payload.action,
      details:    payload.details   ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
      city,
      country,
    });
  } catch (err) {
    // Never let logging break the main request
    console.error('[logActivity] Failed to insert log:', err);
  }
}
