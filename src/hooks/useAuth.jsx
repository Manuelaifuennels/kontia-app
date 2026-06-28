import React, { createContext, useContext, useState } from "react";
import api from "../api/client";

const AuthContext = createContext(null);

const USER_KEY = "kontia_user";
const TOKEN_KEY = "kontia_token";
const EMPRESAS_KEY = "kontia_empresas";

function loadStoredUser() {
  try {
    const savedUser = localStorage.getItem(USER_KEY);
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedEmpresas = localStorage.getItem(EMPRESAS_KEY);
    if (savedUser && savedToken) {
      return {
        user: JSON.parse(savedUser),
        token: savedToken,
        empresas: savedEmpresas ? JSON.parse(savedEmpresas) : [],
      };
    }
  } catch {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMPRESAS_KEY);
  }
  return { user: null, token: null, empresas: [] };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => loadStoredUser().user);
  const [token, setToken] = useState(() => loadStoredUser().token);
  const [empresas, setEmpresas] = useState(() => loadStoredUser().empresas);

  const login = (userData, authToken, empresasList) => {
    setUser(userData);
    setToken(authToken);
    setEmpresas(empresasList || []);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(EMPRESAS_KEY, JSON.stringify(empresasList || []));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setEmpresas([]);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMPRESAS_KEY);
  };

  const switchEmpresa = async (empresaId) => {
    const data = await api.post("/auth/switch-empresa", { empresa_id: empresaId });
    setUser(data.user);
    setToken(data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    localStorage.setItem(TOKEN_KEY, data.token);
    return data;
  };

  const addEmpresa = async (nombre, nif) => {
    const data = await api.post("/auth/create-empresa", { nombre, nif });
    setEmpresas(data.empresas);
    localStorage.setItem(EMPRESAS_KEY, JSON.stringify(data.empresas));
    return data;
  };

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider value={{ user, token, empresas, login, logout, switchEmpresa, addEmpresa, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
