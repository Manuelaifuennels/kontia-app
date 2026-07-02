import React, { useState } from "react";
import Icon from "../ui/Icon";
import { can } from "../../constants/permissions";

const NAV_ITEMS = [
  { key: "contabilidad", label: "Contabilidad", icon: "file" },
  { key: "dashboard", label: "Dashboard", icon: "chart" },
  { key: "proveedores", label: "Proveedores", icon: "users" },
  { key: "clientes", label: "Clientes", icon: "users" },
  { key: "resumen", label: "Resumen Fiscal", icon: "receipt" },
  { key: "conectores", label: "Conectores", icon: "link", perm: "export" },
  { key: "verifactu", label: "VeriFactu", icon: "zap" },
  { key: "conciliacion", label: "Conciliación", icon: "bank" },
  { key: "ajustes", label: "Ajustes", icon: "gear", perm: "ajustes" },
  { key: "papelera", label: "Papelera", icon: "trash", perm: "delete" },
];

export default function Sidebar({ currentPage, onNavigate, user, onLogout, empresas, onSwitchEmpresa, onAddEmpresa }) {
  const [showEmpresas, setShowEmpresas] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newNombre, setNewNombre] = useState("");
  const [newNif, setNewNif] = useState("");
  const [creating, setCreating] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.perm || can(user, item.perm)
  );

  const hasMultiple = empresas && empresas.length > 1;

  async function handleCreate(e) {
    e.preventDefault();
    if (!newNombre.trim()) return;
    setCreating(true);
    try {
      await onAddEmpresa(newNombre.trim(), newNif.trim());
      setNewNombre("");
      setNewNif("");
      setShowNewForm(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <aside
      className="flex flex-col h-screen shrink-0"
      style={{ width: 220, background: "linear-gradient(180deg, #1e1b4b, #1a1647)" }}
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold text-white tracking-wide">
          Kon<span className="text-teal-400">t</span>ia
        </h1>
        <p className="text-[11px] text-indigo-300/70 mt-0.5">
          contabilidad inteligente
        </p>
      </div>

      {/* Empresa selector */}
      <div className="px-3 pb-3">
        <button
          onClick={() => setShowEmpresas(!showEmpresas)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer"
        >
          <div className="text-left min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user?.empresa_nombre || "Empresa"}
            </p>
            {user?.empresa_id && (
              <p className="text-[10px] text-indigo-300/50">
                {empresas?.find(e => e.empresa_id === user.empresa_id)?.nif || `ID: ${user.empresa_id}`}
              </p>
            )}
          </div>
          <Icon name="chevronDown" size={12} className={`text-indigo-300/50 transition-transform ${showEmpresas ? "rotate-180" : ""}`} />
        </button>

        {showEmpresas && (
          <div className="mt-1 bg-white/5 rounded-lg overflow-hidden">
            {empresas?.map((emp) => (
              <button
                key={emp.empresa_id}
                onClick={() => {
                  if (emp.empresa_id !== user.empresa_id) {
                    onSwitchEmpresa(emp.empresa_id);
                  }
                  setShowEmpresas(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs transition-colors cursor-pointer
                  ${emp.empresa_id === user.empresa_id
                    ? "bg-teal-500/20 text-teal-300"
                    : "text-indigo-200/70 hover:bg-white/5 hover:text-white"
                  }`}
              >
                <p className="font-medium truncate">{emp.empresa_nombre}</p>
                <p className="text-[10px] opacity-60">{emp.nif || "Sin NIF"} — {emp.rol}</p>
              </button>
            ))}

            {!showNewForm ? (
              <button
                onClick={() => setShowNewForm(true)}
                className="w-full text-left px-3 py-2 text-xs text-teal-400/70 hover:text-teal-300 hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Icon name="plus" size={12} /> Añadir empresa
              </button>
            ) : (
              <form onSubmit={handleCreate} className="px-3 py-2 space-y-1.5">
                <input
                  type="text"
                  placeholder="Nombre empresa"
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  className="w-full px-2 py-1 bg-white/10 text-white text-xs rounded border border-white/10 focus:outline-none focus:border-teal-400/50 placeholder-indigo-300/30"
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="CIF/NIF (opcional)"
                  value={newNif}
                  onChange={(e) => setNewNif(e.target.value)}
                  className="w-full px-2 py-1 bg-white/10 text-white text-xs rounded border border-white/10 focus:outline-none focus:border-teal-400/50 placeholder-indigo-300/30"
                />
                <div className="flex gap-1">
                  <button
                    type="submit"
                    disabled={creating || !newNombre.trim()}
                    className="flex-1 py-1 bg-teal-500/30 text-teal-300 text-[10px] rounded hover:bg-teal-500/40 disabled:opacity-40 cursor-pointer"
                  >
                    {creating ? "..." : "Crear"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewForm(false); setNewNombre(""); setNewNif(""); }}
                    className="px-2 py-1 text-[10px] text-indigo-300/50 hover:text-white cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 space-y-0.5">
        {visibleItems.map((item) => {
          const active = currentPage === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer
                ${active
                  ? "bg-teal-500/20 text-teal-300"
                  : "text-indigo-200/80 hover:bg-white/5 hover:text-white"
                }`}
            >
              <Icon name={item.icon} size={16} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User info */}
      {user && (
        <div className="px-4 py-4 border-t border-white/10">
          <p className="text-sm text-white/70 font-medium truncate">{user.nombre || user.email}</p>
          <p className="text-[10px] text-indigo-300/35 mt-0.5">{user.rol || "admin"}</p>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 mt-3 text-xs text-indigo-300/60 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Icon name="logout" size={14} />
            Cerrar sesión
          </button>
        </div>
      )}
    </aside>
  );
}
