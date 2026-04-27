"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { apiFetch, getToken, removeToken, setToken, refreshAccessToken } from "@/lib/api";

export interface User {
  id: number;
  email: string;
  username?: string;
  is_active: boolean;
  role: string;
  role_id?: number;
  position?: string;
  permissions: string[];       // resolved from role_id → Role.permissions
  first_name?: string;
  last_name?: string;
  employee_id?: string;
  department?: string;
  profile_image_url?: string;
  two_factor_enabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasPermission: (perm: string) => boolean;
  hasAnyPermission: (perms: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    // getToken() reads from sessionStorage — per-tab isolated
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await apiFetch("/auth/me");
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setUser({ ...data, permissions: data.permissions ?? [] });
    } catch (e) {
      console.error("Auth error:", e);
      removeToken();   // per-tab only — does NOT affect other tabs
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const lastRefreshTimeRef = useRef<number>(Date.now());

  useEffect(() => { 
    fetchUser(); 
  }, [fetchUser]);

  useEffect(() => {
    // Silent background refresh every 13 minutes (780,000 ms)
    const interval = setInterval(async () => {
      const now = Date.now();
      
      // Guard: Do not allow another refresh if one happened in the last 10 minutes
      if (now - lastRefreshTimeRef.current < 10 * 60 * 1000) {
        return;
      }

      const token = getToken();
      if (token) {
        try {
          lastRefreshTimeRef.current = now;
          await refreshAccessToken();
        } catch (e) {
          console.error("Background token refresh failed:", e);
          removeToken();
          setUser(null);
          window.location.href = "/login";
        }
      }
    }, 13 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const login = async (token: string) => {
    setLoading(true);
    setUser(null);
    setToken(token);
    await fetchUser();
  };

  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout API error:", e);
    }
    removeToken();   // removes only this tab's token
    window.location.href = "/login";
  };

  const refreshUser = async () => { 
    setLoading(true);
    await fetchUser(); 
  };

  const hasPermission = (perm: string): boolean =>
    user?.permissions?.includes(perm) ?? false;

  const hasAnyPermission = (perms: string[]): boolean =>
    perms.some((p) => user?.permissions?.includes(p));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasPermission, hasAnyPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}