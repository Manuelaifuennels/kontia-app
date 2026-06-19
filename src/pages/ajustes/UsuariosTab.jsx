import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";

const ROLES = [
  { value: "admin", label: "Admin", desc: "Acceso completo a todas las funciones" },
  { value: "editor", label: "Editor", desc: "Puede subir, editar y eliminar facturas" },
  { value: "contable", label: "Contable", desc: "Puede contabilizar y exportar" },
  { value: "usuario", label: "Usuario", desc: "Solo lectura" },
];

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-700",
  editor: "bg-blue-100 text-blue-700",
  contable: "bg-green-100 text-green-700",
  usuario: "bg-gray-100 text-gray-600",
};

export default function UsuariosTab() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", role: "usuario" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRecords("usuarios");
      setUsers(Array.isArray(data) ? data : data?.list || []);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.createRecord("usuarios", form);
      toast("Usuario creado", "success");
      setShowAdd(false);
      setForm({ nombre: "", email: "", password: "", role: "usuario" });
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleRoleUpdate(e) {
    e.preventDefault();
    try {
      await api.updateRecord("usuarios", { Id: editUser.Id, role: editUser.role });
      toast("Rol actualizado", "success");
      setEditUser(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function toggleActive(user) {
    try {
      await api.updateRecord("usuarios", { Id: user.Id, activo: !user.activo });
      toast(user.activo ? "Usuario desactivado" : "Usuario activado", "success");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Usuarios</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Nuevo usuario
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Activo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Ultimo login</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-700">{u.nombre || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.role] || ROLE_COLORS.usuario}`}>
                      {u.role || "usuario"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                        u.activo !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.activo !== false ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{u.ultimo_login || "—"}</td>
                  <td className="px-4 py-2.5">
                    <Button variant="ghost" size="sm" onClick={() => setEditUser({ ...u })}>
                      <Icon name="edit" size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add user modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nuevo usuario">
        <form onSubmit={handleAdd} className="space-y-1">
          <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Contrasena" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
          <Field
            label="Rol"
            value={form.role}
            onChange={(v) => setForm({ ...form, role: v })}
            options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
          />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Edit role modal */}
      <Modal open={!!editUser} onClose={() => setEditUser(null)} title="Editar rol de usuario">
        {editUser && (
          <form onSubmit={handleRoleUpdate} className="space-y-1">
            <p className="text-sm text-slate-600 mb-3">{editUser.nombre} ({editUser.email})</p>
            <Field
              label="Rol"
              value={editUser.role || "usuario"}
              onChange={(v) => setEditUser({ ...editUser, role: v })}
              options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
            />
            <div className="bg-slate-50 rounded-lg p-3 mb-3">
              {ROLES.map((r) => (
                <div key={r.value} className="flex items-start gap-2 mb-1.5 last:mb-0">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium mt-0.5 ${ROLE_COLORS[r.value]}`}>{r.label}</span>
                  <span className="text-xs text-slate-500">{r.desc}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setEditUser(null)} type="button">Cancelar</Button>
              <Button size="sm" type="submit">Guardar</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
