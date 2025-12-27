"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import type { User } from "@shared/schema";

type AuthContextType = {
  user: User | null;
  isAuthenticated: boolean;
  activeRole: "passenger" | "driver";
  login: (user: User) => void;
  logout: () => void;
  switchRole: () => void;
  setActiveRole: (role: "passenger" | "driver") => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<"passenger" | "driver">("passenger");

  useEffect(() => {
    try {
      const storedUser = localStorage.getItem("unipool_user");
      if (storedUser) setUser(JSON.parse(storedUser));
      const storedRole = localStorage.getItem("unipool_active_role");
      if (storedRole === "driver" || storedRole === "passenger") {
        setActiveRole(storedRole);
      }
    } catch (e) {
      // ignore JSON parse errors
    }
  }, []);

  const login = useCallback((userData: User) => {
    setUser(userData);
    if (typeof window !== 'undefined') {
      localStorage.setItem("unipool_user", JSON.stringify(userData));
      const defaultRole = userData.role === "driver" ? "driver" : "passenger";
      setActiveRole(defaultRole);
      localStorage.setItem("unipool_active_role", defaultRole);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem("unipool_user");
      localStorage.removeItem("unipool_active_role");
    }
  }, []);

  const switchRole = useCallback(() => {
    const newRole = activeRole === "passenger" ? "driver" : "passenger";
    setActiveRole(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem("unipool_active_role", newRole);
    }
  }, [activeRole]);

  const handleSetActiveRole = useCallback((role: "passenger" | "driver") => {
    setActiveRole(role);
    if (typeof window !== 'undefined') {
      localStorage.setItem("unipool_active_role", role);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        activeRole,
        login,
        logout,
        switchRole,
        setActiveRole: handleSetActiveRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}