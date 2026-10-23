import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole, PendingTotpChallenge, AuthResponse } from '../types';
import { authApi } from '../api/endpoints';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Non-null when the server returned a TOTP challenge instead of tokens */
  pendingTotp: PendingTotpChallenge | null;
  login: (email: string, pass: string) => Promise<{ requiresTotp?: boolean; requiresTotpSetup?: boolean }>;
  logout: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  clearMustChangePassword: (authData?: any) => void;
  /** Called after a successful 2FA verify/confirm to store tokens */
  setAuthFromResponse: (res: AuthResponse) => void;
  /** Clears a pending TOTP challenge (e.g., user goes back to login) */
  clearPendingTotp: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  // Held in memory only (not localStorage) — does NOT persist across page reloads intentionally
  const [pendingTotp, setPendingTotp] = useState<PendingTotpChallenge | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('erp_access_token');
    const storedUser = localStorage.getItem('erp_user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  /**
   * Login step 1: submit email + password.
   * - On success (no 2FA): stores tokens, sets user
   * - On 2FA required: stores challenge in pendingTotp, returns flags
   * - On failure: throws (caller handles error display)
   */
  const login = async (email: string, pass: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login({ email, password: pass });

      // Type guard: 2FA challenge response has challengeId but no accessToken
      if ('challengeId' in res && res.challengeId) {
        setPendingTotp({
          challengeId: res.challengeId,
          requiresSetup: res.requiresTotpSetup ?? false,
        });
        return {
          requiresTotp: res.requiresTotp ?? false,
          requiresTotpSetup: res.requiresTotpSetup ?? false,
        };
      }

      // Normal auth response — store tokens
      const authRes = res as AuthResponse;
      setAuthFromResponse(authRes);
      return {};
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Called after successful 2FA verify or confirm to complete the login.
   * Also used by change-password and keep-password flows.
   */
  const setAuthFromResponse = (res: AuthResponse) => {
    localStorage.setItem('erp_access_token', res.accessToken);
    localStorage.setItem('erp_refresh_token', res.refreshToken);
    localStorage.setItem('erp_user', JSON.stringify(res.user));
    setUser(res.user);
    setPendingTotp(null);
  };

  const clearPendingTotp = () => setPendingTotp(null);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network failures on logout
    } finally {
      localStorage.clear();
      setUser(null);
      setPendingTotp(null);
      window.location.href = '/login';
    }
  };

  const hasRole = (roles: UserRole | UserRole[]) => {
    if (!user) return false;
    const required = Array.isArray(roles) ? roles : [roles];
    return required.some((r) => user.roles.includes(r));
  };

  const clearMustChangePassword = (authData?: any) => {
    if (authData && authData.accessToken) {
      setAuthFromResponse(authData);
    } else if (user) {
      const updated = { ...user, mustChangePassword: false };
      setUser(updated);
      localStorage.setItem('erp_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        pendingTotp,
        login,
        logout,
        hasRole,
        clearMustChangePassword,
        setAuthFromResponse,
        clearPendingTotp,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
