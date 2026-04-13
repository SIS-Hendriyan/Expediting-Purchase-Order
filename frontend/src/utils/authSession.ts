// src/utils/authSession.ts

// ---- Types ----
export type SessionKind = 'VENDOR' | 'INTERNAL';

export interface VendorSessionData {
  kind: 'VENDOR';
  email: string;
  completeName: string;
  accessToken: string;
  id: string;
  vendorName: string;
  vendorCode: string;
}

export interface InternalSessionData {
  kind: 'INTERNAL';
  email: string;
  name: string;
  nrp: string;
  id: string;
  role: string;
  department: string;
  jobsite: string;
  accessToken: string;
  refreshToken?: string;
}

export type AuthSession = VendorSessionData | InternalSessionData;

// ---- Storage key ----
const KEY = 'authSession';

function safeSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

// ---- Public API ----
export function saveAuthSession(session: AuthSession): void {
  const ss = safeSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(KEY, JSON.stringify(session));
  } catch (e) {
    console.error('saveAuthSession failed:', e);
  }
}

export function getAuthSession(): AuthSession | null {
  const ss = safeSessionStorage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(KEY);
    if (!raw) return migrateFromLegacy();
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.kind === 'VENDOR' || parsed.kind === 'INTERNAL')) {
      return parsed as AuthSession;
    }
    return null;
  } catch (e) {
    console.error('getAuthSession failed:', e);
    return null;
  }
}

export function clearAuthSession(): void {
  const ss = safeSessionStorage();
  if (!ss) return;
  try {
    ss.removeItem(KEY);
  } catch (e) {
    console.error('clearAuthSession failed:', e);
  }
}

// Helpers
export function getAccessToken(): string | null {
  const s = getAuthSession();
  return s ? s.accessToken : null;
}

export function isAuthenticated(): boolean {
  const s = getAuthSession();
  return Boolean(s && s.accessToken);
}

export function isVendorSession(s?: AuthSession | null): s is VendorSessionData {
  const x = s ?? getAuthSession();
  return Boolean(x && x.kind === 'VENDOR');
}

export function isInternalSession(s?: AuthSession | null): s is InternalSessionData {
  const x = s ?? getAuthSession();
  return Boolean(x && x.kind === 'INTERNAL');
}

/**
 * Hapus semua cookie yang bisa dihapus dari JavaScript.
 * Catatan: cookie HttpOnly TIDAK bisa dihapus dari frontend.
 */
export function clearBrowserCookies(): void {
  if (typeof document === 'undefined') return;

  try {
    const cookies = document.cookie ? document.cookie.split(';') : [];

    for (const cookie of cookies) {
      const eqPos = cookie.indexOf('=');
      const rawName = eqPos > -1 ? cookie.slice(0, eqPos) : cookie;
      const name = rawName.trim();

      if (!name) continue;

      // hapus untuk path default
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;

      // beberapa variasi umum
      document.cookie = `${name}=; Max-Age=0; path=/`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;

      // kalau app pakai secure cookie di https
      if (window.location.protocol === 'https:') {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; Secure; SameSite=None`;
      }
    }
  } catch (e) {
    console.error('clearBrowserCookies failed:', e);
  }
}

/**
 * Bersihkan semua auth data di browser
 */
export function clearAllAuthData(): void {
  try {
    clearAuthSession();

    const ss = safeSessionStorage();
    const ls = safeLocalStorage();

    ss?.removeItem('vendorSession');
    ss?.removeItem('internalSession');
    ss?.removeItem('accessToken');
    ss?.removeItem('refreshToken');

    ls?.removeItem('vendorSession');
    ls?.removeItem('internalSession');
    ls?.removeItem('accessToken');
    ls?.removeItem('refreshToken');
    ls?.removeItem(KEY);

    clearBrowserCookies();
  } catch (e) {
    console.error('clearAllAuthData failed:', e);
  }
}

/**
 * Redirect ke login dengan error expired
 */
export function redirectToLoginExpired(): void {
  if (typeof window === 'undefined') return;

  clearAllAuthData();

  const loginUrl = `/login?err=${encodeURIComponent('Expired')}`;
  window.location.replace(loginUrl);
}

// ---- Legacy migration (maps vendorId -> id) ----
function migrateFromLegacy(): AuthSession | null {
  const ss = safeSessionStorage();
  if (!ss) return null;
  try {
    const legacyVendor = ss.getItem('vendorSession');
    if (legacyVendor) {
      const v = JSON.parse(legacyVendor);
      if (v && (v.email || v.accessToken)) {
        const migrated: VendorSessionData = {
          kind: 'VENDOR',
          email: v.email ?? '',
          completeName: v.completeName ?? '',
          accessToken: v.accessToken ?? '',
          id: v.vendorId ?? v.id ?? '',
          vendorName: v.vendorName ?? '',
          vendorCode: v.vendorCode ?? '',
        };
        saveAuthSession(migrated);
        ss.removeItem('vendorSession');
        return migrated;
      }
    }

    const legacyInternal = ss.getItem('internalSession');
    if (legacyInternal) {
      const i = JSON.parse(legacyInternal);
      if (i && (i.email || i.accessToken)) {
        const migrated: InternalSessionData = {
          kind: 'INTERNAL',
          email: i.email ?? '',
          name: i.name ?? '',
          nrp: i.nrp ?? '',
          id: i.id ?? '',
          role: i.role ?? '',
          department: i.department ?? '',
          jobsite: i.jobsite ?? '',
          accessToken: i.accessToken ?? '',
          refreshToken: i.refreshToken ?? '',
        };
        saveAuthSession(migrated);
        ss.removeItem('internalSession');
        return migrated;
      }
    }
  } catch (e) {
    console.error('migrateFromLegacy failed:', e);
  }
  return null;
}