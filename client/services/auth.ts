import { api, forgetSession, setToken } from '@/lib/api';
import type { AuthUser, LoginToken, OtpRequired } from '@/types';

export interface RegisterPayload {
  phone: string;
  pseudo: string;
  password: string;
  filiere: string;
  institution?: string;
  level?: string;
  email?: string;
  member_type: 'student' | 'teacher';
  whatsapp_opt_in?: boolean;
}

/** The API prefixes this to a login refused because the account is unverified. */
export const OTP_REQUIRED_PREFIX = 'OTP_REQUIRED';

export const authService = {
  /**
   * With the WhatsApp gate on, no token comes back: the account exists but
   * stays locked until `verifyOtp`.
   */
  async register(payload: RegisterPayload): Promise<LoginToken | OtpRequired> {
    const data = await api.post<LoginToken | OtpRequired>('/auth/register', payload, {
      retryOnExpiry: false,
    });
    if ('access_token' in data) setToken(data.access_token);
    return data;
  },

  /** `identifier` is the WhatsApp number, or the email of an older account. */
  async login(identifier: string, password: string): Promise<LoginToken> {
    const data = await api.post<LoginToken>(
      '/auth/login',
      { identifier, password },
      { retryOnExpiry: false },
    );
    setToken(data.access_token);
    return data;
  },

  async verifyOtp(phone: string, code: string): Promise<LoginToken> {
    const data = await api.post<LoginToken>(
      '/auth/verify-otp',
      { phone, code },
      { retryOnExpiry: false },
    );
    setToken(data.access_token);
    return data;
  },

  /** Always answers the same, whether the number has an account or not. */
  forgotPassword: (phone: string) =>
    api.post<{ sent: boolean }>('/auth/forgot-password', { phone }, { retryOnExpiry: false }),

  resetPassword: (phone: string, code: string, newPassword: string) =>
    api.post<{ reset: boolean }>(
      '/auth/reset-password',
      { phone, code, new_password: newPassword },
      { retryOnExpiry: false },
    ),

  /** Signs out the other devices; this one gets a fresh token. */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    const data = await api.post<{ access_token: string }>('/auth/password', {
      old_password: oldPassword,
      new_password: newPassword,
    });
    setToken(data.access_token);
  },

  startPhoneChange: (password: string, phone: string) =>
    api.post<{ sent: boolean }>('/auth/phone/start', { password, phone }),
  confirmPhoneChange: (phone: string, code: string) =>
    api.post<{ phone: string }>('/auth/phone/confirm', { phone, code }),

  async deleteAccount(password: string): Promise<void> {
    await api.post('/auth/delete-account', { password });
    forgetSession();
  },

  resendOtp: (phone: string) =>
    api.post<{ sent: boolean }>('/auth/resend-otp', { phone }, { retryOnExpiry: false }),

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout', undefined, { retryOnExpiry: false });
    } finally {
      // Clear locally even if the server call fails: a stale token in
      // localStorage is worse than an orphaned Redis key.
      forgetSession();
    }
  },

  me: () => api.get<AuthUser>('/auth/me', { retryOnExpiry: false }),
};
