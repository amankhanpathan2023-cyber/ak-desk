export const COOKIE = 'dex_session';

export async function sessionToken() {
  const data = new TextEncoder().encode(`dex:${process.env.APP_PASSWORD || ''}:${process.env.CRON_SECRET || ''}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
