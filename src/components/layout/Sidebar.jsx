import React from "react";
import Icon from "../ui/Icon";
import { can } from "../../constants/permissions";

const NAV_ITEMS = [
  { key: "contabilidad", label: "Contabilidad", icon: "file" },
  { key: "dashboard", label: "Dashboard", icon: "chart" },
  { key: "proveedores", label: "Proveedores", icon: "users" },
  { key: "clientes", label: "Clientes", icon: "users" },
  { key: "resumen", label: "Resumen Fiscal", icon: "receipt" },
  { key: "conectores", label: "Conectores", icon: "link", perm: "export" },
  { key: "verifactu", label: "F. Electronica", icon: "zap" },
  { key: "conciliacion", label: "Conciliacion", icon: "bank" },
  { key: "ajustes", label: "Ajustes", icon: "gear", perm: "ajustes" },
  { key: "papelera", label: "Papelera", icon: "trash", perm: "delete" },
];

export default function Sidebar({ currentPage, onNavigate, user, onLogout }) {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.perm || can(user, item.perm)
  );

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
          <p className="text-sm text-white font-medium truncate">{user.nombre}</p>
          <p className="text-[11px] text-indigo-300/60 truncate">{user.empresa_nombre}</p>
          {user.empresa_id && (
            <p className="text-[10px] text-indigo-300/40 mt-0.5">
              ID: {user.empresa_id}
            </p>
          )}
          <p className="text-[10px] text-indigo-300/40 capitalize">{user.rol}</p>
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 mt-3 text-xs text-indigo-300/60 hover:text-red-400 transition-colors cursor-pointer"
          >
            <Icon name="logout" size={14} />
            Cerrar sesion
          </button>
        </div>
      )}
    </aside>
  );
}
