import React, { useState } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";

export default function ActividadesTab({ actividades, onReload }) {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nombre_actividad: "", codigo_csv: "", epigrafe_iae: "" });

  const rows = Array.isArray(actividades) ? actividades : actividades?.list || [];

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.createRecord("actividades", form);
      toast("Actividad creada", "success");
      setShowAdd(false);
      setForm({ nombre_actividad: "", codigo_csv: "", epigrafe_iae: "" });
      onReload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Actividades</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Nueva actividad
        </Button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Actividad</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Codigo CSV</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Epigrafe IAE</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Activo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-700">{a.nombre_actividad || "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.codigo_csv || "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{a.epigrafe_iae || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    a.activo !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {a.activo !== false ? "Activo" : "Inactivo"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin actividades</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nueva actividad">
        <form onSubmit={handleAdd} className="space-y-1">
          <Field label="Nombre actividad" value={form.nombre_actividad} onChange={(v) => setForm({ ...form, nombre_actividad: v })} />
          <Field label="Codigo CSV" value={form.codigo_csv} onChange={(v) => setForm({ ...form, codigo_csv: v })} />
          <Field label="Epigrafe IAE" value={form.epigrafe_iae} onChange={(v) => setForm({ ...form, epigrafe_iae: v })} />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
