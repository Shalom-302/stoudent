'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getToken, mayHaveSession, refreshAccessToken, setToken } from '@/lib/api';
import { authService, type RegisterPayload } from '@/services/auth';
import type { AuthUser, OtpRequired } from '@/types';

interface AuthContextValue {
  user: AuthUser | null;
  /** True until the stored token has been checked against the API. */
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  /** Resolves to the OTP challenge when the WhatsApp code gate is on. */
  register: (payload: RegisterPayload) => Promise<OtpRequired | null>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate on mount: a stored token means nothing until the API confirms
  // it, so the session is always validated rather than assumed.
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      // No access token kept (expired, other tab cleared it, browser restarted):
      // the httpOnly refresh cookie may still hold a session. Opening any
      // STOUDENT link then signs the member back in without a password.
      if (!getToken() && !(mayHaveSession() && (await refreshAccessToken()))) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const me = await authService.me().catch(async (error) => {
          if (!(await refreshAccessToken())) throw error;
          return authService.me();
        });
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await authService.login(identifier, password);
    setUser(data.user);
  }, []);

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await authService.register(payload);
    if ('otp_required' in data) return data;
    setUser(data.user);
    return null;
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    const data = await authService.verifyOtp(phone, code);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    router.replace('/login');
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, verifyOtp, logout }),
    [user, loading, login, register, verifyOtp, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
