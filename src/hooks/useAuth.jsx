import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

const USER_KEY = "kontia_user";
const TOKEN_KEY = "kontia_token";

function loadStoredUser() {
  try {
    const savedUser = localStorage.getItem(USER_KEY);
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (savedUser && savedToken) {
      return { user: JSON.parse(savedUser), token: savedToken };
    }
  } catch {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
  return { user: null, token: null };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadStoredUser().user);
  const [token, setToken] = useState(() => loadStoredUser().token);

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(TOKEN_KEY, authToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
  };

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
