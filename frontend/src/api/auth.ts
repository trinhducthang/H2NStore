import { request } from './client';
import type { AuthConfig, AuthResponse, RegisterRequest } from './types';

export const authApi = {
  config: () => request<AuthConfig>('/api/public/auth/config'),

  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),

  /** credential: ID token nút Google trả về */
  loginWithGoogle: (credential: string) =>
    request<AuthResponse>('/api/auth/google', { method: 'POST', body: { credential } }),

  register: (req: RegisterRequest) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: req }),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<void>('/api/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token: string, newPassword: string) =>
    request<void>('/api/auth/reset-password', { method: 'POST', body: { token, newPassword } }),
};
