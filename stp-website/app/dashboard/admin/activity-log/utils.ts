export function formatDate(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' }),
  };
}

export function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown';
  if (/mobile/i.test(ua)) {
    if (/android/i.test(ua)) return '📱 Android';
    if (/iphone|ipad/i.test(ua)) return '📱 iOS';
    return '📱 Mobile';
  }
  if (/windows/i.test(ua)) return '🖥️ Windows';
  if (/mac/i.test(ua)) return '🖥️ macOS';
  if (/linux/i.test(ua)) return '🖥️ Linux';
  return '🖥️ Desktop';
}

export function parseBrowser(ua: string | null): string {
  if (!ua) return '';
  if (/edg\//i.test(ua)) return 'Edge';
  if (/chrome/i.test(ua) && !/chromium/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua) && !/chrome/i.test(ua)) return 'Safari';
  if (/opr\//i.test(ua)) return 'Opera';
  return 'Browser';
}
