// src/utils/authSession.ts

// ---- Types ----
export type SessionKind = 'VENDOR' | 'INTERNAL';

export interface VendorSessionData {
  kind: 'VENDOR';
  email: string;
  completeName: string;
  accessToken: string;
  id: string;           // unified (was vendorId)
  vendorName: string;
}

export interface InternalSessionData {
  kind: 'INTERNAL';
  email: string;
  name: string;
  nrp: string;
  id: string;           // unified
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
          id: v.vendorId ?? v.id ?? '',              // <- map vendorId -> id
          vendorName: v.vendorName ?? '',
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
