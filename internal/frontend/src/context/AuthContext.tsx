import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { ApiError } from '../api/apiClient';
import { tokens, refreshAccessToken } from '../api/apiClient';
import { authApi, type RegisterPayload } from '../api/auth';

/* ── Shape ─────────────────────────────────────── */

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login:          (username: string, password: string) => Promise<{ ok: boolean; role?: string; error?: string }>;
  register:       (payload: RegisterPayload) => Promise<{ ok: boolean; errors?: Record<string, string | string[]> }>;
  logout:         () => Promise<void>;
  updateSettings: (payload: { message_permission?: string; theme_color?: string; font_style?: string }) => Promise<void>;
  refreshUser:    () => Promise<void>;
}

/* ── Helpers ────────────────────────────────────── */

function buildUser(payload: Record<string, unknown>): User {
  return {
    id:                   payload.user_id as number,
    username:             payload.username as string,
    email:                payload.email as string,
    first_name:           payload.first_name as string,
    last_name:            payload.last_name as string,
    role:                 payload.role as string,
    is_approved:          payload.is_approved as boolean,
    has_internal_access:  payload.has_internal_access as boolean,
    onboarding_complete:  payload.onboarding_complete as boolean,
    message_permission:   payload.message_permission as string,
    theme_color:          payload.theme_color as string,
    font_style:           payload.font_style as string,
    profile_picture:      null,
  };
}

/* ── Context ───────────────────────────────────── */

const AuthContext = createContext<AuthContextValue | null>(null);

/* ── Provider ──────────────────────────────────── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session from localStorage on mount — no network call needed
  useEffect(() => {
    const access = tokens.getAccess();
    if (!access) { setIsLoading(false); return; }

    const payload = tokens.decode(access);
    if (!payload) { tokens.clear(); setIsLoading(false); return; }

    if (!tokens.isExpired(access)) {
      // Token still valid — restore user instantly
      setUser(buildUser(payload));
      setIsLoading(false);
    } else {
      // Access token expired — try silent refresh
      refreshAccessToken()
        .then(newAccess => {
          const newPayload = tokens.decode(newAccess);
          if (newPayload) setUser(buildUser(newPayload));
        })
        .catch(() => tokens.clear())
        .finally(() => setIsLoading(false));
    }
  }, []);

  const login = async (
    username: string,
    password: string,
  ): Promise<{ ok: boolean; role?: string; error?: string }> => {
    try {
      const u = await authApi.login({ username, password });
      setUser(u);
      return { ok: true, role: u.role };
    } catch (err) {
      if (err instanceof ApiError) {
        const msg =
          (err.data as Record<string, string[]>)?.non_field_errors?.[0] ??
          (err.data as Record<string, string>)?.detail ??
          'Invalid username or password.';
        return { ok: false, error: msg };
      }
      return { ok: false, error: 'Server error. Please try again.' };
    }
  };

  const register = async (
    payload: RegisterPayload,
  ): Promise<{ ok: boolean; errors?: Record<string, string | string[]> }> => {
    try {
      const u = await authApi.register(payload);
      setUser(u);
      return { ok: true };
    } catch (err) {
      if (err instanceof ApiError) {
        return { ok: false, errors: err.data as Record<string, string | string[]> };
      }
      return { ok: false, errors: { non_field_errors: 'Server error. Please try again.' } };
    }
  };

  const logout = async () => {
    try { await authApi.logout(); }
    finally { setUser(null); }
  };

  const updateSettings = async (payload: { message_permission?: string; theme_color?: string; font_style?: string }) => {
    const updated = await authApi.updateSettings(payload);
    setUser(updated);
  };

  const refreshUser = async () => {
    try {
      const u = await authApi.me();
      setUser(u);
    } catch { /* ignore */ }
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, register, logout, updateSettings, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ──────────────────────────────────────── */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
