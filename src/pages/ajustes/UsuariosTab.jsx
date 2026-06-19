import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import { fmtDate } from "../../utils/format";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import Icon from "../../components/ui/Icon";

const ROLES_SHORT = [
  { value: "admin", label: "Admin" },
  { value: "editor", label: "Editor" },
  { value: "contable", label: "Contable" },
  { value: "usuario", label: "Usuario" },
];

const ROLES_LONG = [
  { value: "admin", label: "Admin — Acceso total" },
  { value: "editor", label: "Editor — Puede modificar facturas" },
  { value: "contable", label: "Contable — Solo contabilizar" },
  { value: "usuario", label: "Usuario — Solo lectura" },
];

const ROLE_COLORS = {
  admin: "bg-purple-100 text-purple-700",
  editor: "bg-blue-100 text-blue-700",
  usuario: "bg-gray-100 text-gray-600",
};

export default function UsuariosTab({ user }) {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editRol, setEditRol] = useState("");
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "usuario" });

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
    if (!form.email) return toast("Email obligatorio", "warning");
    try {
      await api.createRecord("usuarios", {
        ...form,
        empresa_id2: user?.empresa_id,
        empresa_nombre: user?.empresa_nombre,
        activo: "true",
      });
      toast("Usuario creado", "success");
      setShowAdd(false);
      setForm({ nombre: "", email: "", password: "", rol: "usuario" });
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function saveRol() {
    if (!editUser) return;
    try {
      await api.updateRecord("usuarios", { Id: editUser.Id, rol: editRol });
      toast("Rol actualizado", "success");
      setEditUser(null);
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function toggleActivo(u) {
    try {
      await api.updateRecord("usuarios", { Id: u.Id, activo: u.activo === "true" ? "false" : "true" });
      toast(u.activo === "true" ? "Usuario desactivado" : "Usuario activado", "success");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-700">Usuarios de la empresa</h3>
          <span className="text-xs text-slate-400">{users.length} usuario(s)</span>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Añadir
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando usuarios...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Email</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Rol</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Activo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Último login</th>
                <th className="px-4 py-2.5 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin usuarios. Se crean al registrarse.</td></tr>
              )}
              {users.map((u) => (
                <tr key={u.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5 text-slate-700 font-medium">{u.nombre || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{u.email}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[u.rol] || ROLE_COLORS.usuario}`}>
                      {u.rol || "usuario"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => toggleActivo(u)}
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-colors ${
                        u.activo === "true" || u.activo === true ? "bg-green-100 text-green-700" : "bg-red-50 text-red-700"
                      }`}
                    >
                      {u.activo === "true" || u.activo === true ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 text-xs">{u.ultimo_login ? fmtDate(u.ultimo_login) : "Nunca"}</td>
                  <td className="px-4 py-2.5">
                    <Button variant="secondary" size="sm" onClick={() => { setEditUser(u); setEditRol(u.rol || "usuario"); }}>
                      <Icon name="edit" size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nuevo usuario">
        <form onSubmit={handleAdd} className="space-y-1">
          <Field label="Nombre completo" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} />
          <Field label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} type="email" />
          <Field label="Contraseña" value={form.password} onChange={(v) => setForm({ ...form, password: v })} type="password" />
          <Field
            label="Rol"
            value={form.rol}
            onChange={(v) => setForm({ ...form, rol: v })}
            options={ROLES_SHORT}
          />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">Crear usuario</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!editUser} onClose={() => setEditUser(null)} title={`Editar rol — ${editUser?.nombre || editUser?.email || ""}`}>
        {editUser && (
          <div>
            <Field
              label="Rol"
              value={editRol}
              onChange={setEditRol}
              options={ROLES_LONG}
            />
            <div className="bg-slate-50 rounded-lg p-3 mb-3 text-xs text-slate-500 space-y-1">
              <div><b>Admin:</b> Acceso total incluyendo ajustes y usuarios.</div>
              <div><b>Editor:</b> Puede subir, editar y eliminar facturas.</div>
              <div><b>Contable:</b> Puede contabilizar y exportar.</div>
              <div><b>Usuario:</b> Solo puede ver facturas.</div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={() => setEditUser(null)}>Cancelar</Button>
              <Button size="sm" onClick={saveRol}>Guardar rol</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
