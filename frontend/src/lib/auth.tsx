'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getToken, setToken, authApi, usersApi } from './api';

interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const USER_INFO_KEY = 'bpms_user_info';

function persistUserInfo(u: AuthUser) {
  try {
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(u));
  } catch {
    /* ignore */
  }
}

function readPersistedUserInfo(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_INFO_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function clearPersistedUserInfo() {
  try {
    localStorage.removeItem(USER_INFO_KEY);
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    // Decode JWT for the basics; fall back to persisted info for the display name
    let decoded: Partial<AuthUser> = {};
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      decoded = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      setToken(null);
      clearPersistedUserInfo();
      setLoading(false);
      return;
    }
    const persisted = readPersistedUserInfo();
    const initial: AuthUser = {
      userId: decoded.userId ?? '',
      email: decoded.email ?? '',
      name: persisted?.name ?? decoded.email ?? '',
      role: decoded.role ?? 'USER',
    };
    setUser(initial);
    // Refresh name/role from the API in the background (JWT may be stale)
    (async () => {
      try {
        if (initial.userId) {
          const fresh = (await usersApi.findOne(initial.userId)) as {
            id: string;
            email: string;
            name: string;
            role: string;
          };
          const next: AuthUser = {
            userId: fresh.id,
            email: fresh.email,
            name: fresh.name,
            role: fresh.role,
          };
          persistUserInfo(next);
          setUser(next);
        }
      } catch {
        // Token invalid or expired
        setToken(null);
        clearPersistedUserInfo();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    setToken(res.accessToken);
    const u: AuthUser = {
      userId: res.userId,
      email: res.email,
      name: res.name,
      role: res.role,
    };
    persistUserInfo(u);
    setUser(u);
  };

  const logout = () => {
    setToken(null);
    clearPersistedUserInfo();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
