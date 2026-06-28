import React, { useState } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", nombre: "", empresa_nombre: "", nif_empresa: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password }
          : { email: form.email, password: form.password, nombre: form.nombre, empresa_nombre: form.empresa_nombre, nif_empresa: form.nif_empresa };

      const data = await api.post(endpoint, payload);
      login(data.user, data.token, data.empresas || []);
    } catch (err) {
      setError(err.message || "Error de conexión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "linear-gradient(135deg, #1e1b4b, #1a1647, #0f172a)" }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-wide">
            Kon<span className="text-teal-400">t</span>ia
          </h1>
          <p className="text-sm text-indigo-300/60 mt-1">Contabilidad inteligente con IA</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6">
          {/* Tabs */}
          <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
            {["login", "registro"].map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(""); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors capitalize cursor-pointer
                  ${mode === tab ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                {tab === "login" ? "Iniciar sesión" : "Registrarse"}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "registro" && (
              <>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={form.nombre}
                  onChange={set("nombre")}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                />
                <input
                  type="text"
                  placeholder="Nombre de empresa"
                  value={form.empresa_nombre}
                  onChange={set("empresa_nombre")}
                  required
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                />
                <input
                  type="text"
                  placeholder="CIF / NIF de la empresa"
                  value={form.nif_empresa}
                  onChange={set("nif_empresa")}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
                />
              </>
            )}

            <input
              type="email"
              placeholder="tu@email.com"
              value={form.email}
              onChange={set("email")}
              required
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />
            <input
              type="password"
              placeholder="Contraseña"
              value={form.password}
              onChange={set("password")}
              required
              minLength={8}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-teal-500 text-white text-sm font-medium rounded-lg hover:bg-teal-600 active:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
