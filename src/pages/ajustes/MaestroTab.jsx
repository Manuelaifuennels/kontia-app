import React, { useState } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";

const TIPO_OPTIONS = [
  { value: "gasto", label: "Gasto" },
  { value: "ingreso", label: "Ingreso" },
  { value: "iva", label: "IVA" },
  { value: "tercero", label: "Tercero" },
];

const TIPO_COLORS = {
  gasto: "bg-indigo-100 text-indigo-700",
  ingreso: "bg-green-100 text-green-700",
  iva: "bg-yellow-100 text-yellow-700",
  tercero: "bg-gray-100 text-gray-600",
};

export default function MaestroTab({ maestro, onReload }) {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ subcuenta: "", descripcion: "", tipo: "gasto" });

  const rows = Array.isArray(maestro) ? maestro : maestro?.list || [];

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.createRecord("maestro", form);
      toast("Cuenta creada", "success");
      setShowAdd(false);
      setForm({ subcuenta: "", descripcion: "", tipo: "gasto" });
      onReload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Maestro de cuentas</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Nueva cuenta
        </Button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Subcuenta</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Descripcion</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 font-mono text-slate-700">{m.subcuenta}</td>
                <td className="px-4 py-2.5 text-slate-600">{m.descripcion || "—"}</td>
                <td className="px-4 py-2.5">
                  <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_COLORS[m.tipo] || TIPO_COLORS.tercero}`}>
                    {m.tipo || "—"}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400">Sin cuentas</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nueva cuenta">
        <form onSubmit={handleAdd} className="space-y-1">
          <Field label="Subcuenta" value={form.subcuenta} onChange={(v) => setForm({ ...form, subcuenta: v })} />
          <Field label="Descripcion" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} />
          <Field label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} options={TIPO_OPTIONS} />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
