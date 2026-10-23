import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { restoreSessionOnce, setAccessToken, setAuthListener } from '../api/client';
import type { AuthResponse, RegisterRequest, User } from '../api/types';

interface AuthContextValue {
  user: User | null;
  /** false khi đang khôi phục phiên lúc mở app */
  ready: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (req: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Mỗi lần refresh token (kể cả tự động khi gặp 401) đều cập nhật user
    setAuthListener((auth) => setUser(auth ? auth.user : null));
    let cancelled = false;
    restoreSessionOnce().then((auth) => {
      if (cancelled) return;
      setUser(auth ? auth.user : null);
      setReady(true);
    });
    return () => {
      cancelled = true;
      setAuthListener(null);
    };
  }, []);

  const applyAuth = useCallback((auth: AuthResponse) => {
    setAccessToken(auth.accessToken);
    setUser(auth.user);
    return auth.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => applyAuth(await authApi.login(email, password)),
    [applyAuth],
  );

  const register = useCallback(async (req: RegisterRequest) => applyAuth(await authApi.register(req)), [applyAuth]);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // vẫn xóa phiên phía client
    }
    setAccessToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      isStaff: user?.role === 'STAFF' || user?.role === 'ADMIN',
      isAdmin: user?.role === 'ADMIN',
      login,
      register,
      logout,
      updateUser: setUser,
    }),
    [user, ready, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}
