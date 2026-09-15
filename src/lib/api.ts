import { supabase } from './supabase';

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);

  if (session?.access_token) {
    headers.set('Authorization', `Bearer ${session.access_token}`);
  }

  return fetch(input, { ...init, headers });
}

export async function verifyAdminAccess(accessToken?: string) {
  const headers = new Headers();

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = accessToken
    ? await fetch('/api/admin/me', { headers })
    : await apiFetch('/api/admin/me');

  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    return false;
  }

  const body = await response.json().catch(() => null);
  return body?.authorized === true && typeof body?.email === 'string';
}
