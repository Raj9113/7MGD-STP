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
  request?: Request | { headers: Headers };
}

interface GeoInfo {
  city: string | null;
  country: string | null;
}

function extractIp(headers: Headers): string | null {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') || // Cloudflare
    null
  );
}

async function geoLocate(ip: string | null): Promise<GeoInfo> {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { city: 'Localhost', country: 'Local' };
  }
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=city,country,status`, {
      signal: AbortSignal.timeout(3000),
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
    console.error('[logActivity] Failed to insert log:', err);
  }
}
