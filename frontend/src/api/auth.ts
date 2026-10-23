import { request } from './client';
import type { AuthResponse, RegisterRequest } from './types';

export const authApi = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),

  register: (req: RegisterRequest) => request<AuthResponse>('/api/auth/register', { method: 'POST', body: req }),

  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<void>('/api/auth/forgot-password', { method: 'POST', body: { email } }),

  resetPassword: (token: string, newPassword: string) =>
    request<void>('/api/auth/reset-password', { method: 'POST', body: { token, newPassword } }),
};
