"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { apiFetch, getToken, removeToken, setToken, refreshAccessToken } from "@/lib/api";

// ── Module-level constants ──────────────────────────────────────────────────────
/** How often the background token refresh fires (minutes). */
const TOKEN_REFRESH_INTERVAL_MINUTES = 13;
/** Minimum gap between two consecutive refresh calls (minutes). Prevents overlap. */
const MIN_REFRESH_GUARD_MINUTES = 10;

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

  /**
   * Fetches the current user's profile from /auth/me using the stored access token.
   * Populates the user state with profile data and resolved permissions.
   * Clears the token and sets user to null if the request fails (e.g. token expired).
   */
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

  /** Runs once on mount to restore the user session from the stored access token. */
  useEffect(() => { 
    fetchUser(); 
  }, [fetchUser]);

  /**
   * Silently refreshes the access token every 13 minutes via the HttpOnly
   * refresh-token cookie. A guard prevents overlapping refreshes if one
   * occurred within the last 10 minutes. Redirects to /login on failure.
   */
  useEffect(() => {
    // Silent background refresh every 13 minutes (780,000 ms)
    const interval = setInterval(async () => {
      const now = Date.now();
      
      // Guard: Do not allow another refresh if one happened in the last 10 minutes
      if (now - lastRefreshTimeRef.current < MIN_REFRESH_GUARD_MINUTES * 60 * 1000) {
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
    }, TOKEN_REFRESH_INTERVAL_MINUTES * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  /**
   * Stores the access token in sessionStorage (per-tab isolation) and
   * immediately fetches the user profile to populate the auth context.
   */
  const login = async (token: string) => {
    setLoading(true);
    setUser(null);
    setToken(token);
    await fetchUser();
  };

  /**
   * Calls the backend logout endpoint to invalidate the refresh token,
   * removes the access token from sessionStorage, and redirects to /login.
   * Only affects the current browser tab (sessionStorage is tab-scoped).
   */
  const logout = async () => {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch (e) {
      console.error("Logout API error:", e);
    }
    removeToken();   // removes only this tab's token
    window.location.href = "/login";
  };

  /**
   * Forces a re-fetch of the user profile from the backend.
   * Useful after profile updates so the UI reflects the latest data.
   */
  const refreshUser = async () => { 
    setLoading(true);
    await fetchUser(); 
  };

  /** Returns true if the current user holds the exact permission string. */
  const hasPermission = (perm: string): boolean =>
    user?.permissions?.includes(perm) ?? false;

  /** Returns true if the current user holds at least one of the given permission strings. */
  const hasAnyPermission = (perms: string[]): boolean =>
    perms.some((p) => user?.permissions?.includes(p));

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasPermission, hasAnyPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to consume the AuthContext.
 * Must be used inside an <AuthProvider> — throws a descriptive error otherwise.
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}