"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface User {
  id: number;
  email: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {

      const token = localStorage.getItem("access_token");

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const res = await apiFetch("/auth/me");

        if (!res.ok) {
          throw new Error("Unauthorized");
        }

        const data = await res.json();
        setUser(data);

      } catch (error) {
        console.error("Auth check failed:", error);

        localStorage.removeItem("access_token");

        document.cookie =
          "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";

        setUser(null);
      }

      setLoading(false);
    };

    fetchUser();
  }, []);

  const logout = () => {

    localStorage.removeItem("access_token");

    document.cookie =
      "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC";

    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {

  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}