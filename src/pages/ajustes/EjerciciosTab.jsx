import React, { useState } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import { fmtDate } from "../../utils/format";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

export default function EjerciciosTab({ ejercicios, onReload }) {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ anio: "", fecha_inicio: "", fecha_fin: "", codigo_csv: "" });

  const rows = Array.isArray(ejercicios) ? ejercicios : ejercicios?.list || [];

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.createRecord("ejercicios", form);
      toast("Ejercicio creado", "success");
      setShowAdd(false);
      setForm({ anio: "", fecha_inicio: "", fecha_fin: "", codigo_csv: "" });
      onReload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.deleteRecord("ejercicios", deleteTarget.Id);
      toast("Ejercicio eliminado", "success");
      onReload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Ejercicios contables</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Nuevo ejercicio
        </Button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Ano</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha inicio</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha fin</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Codigo CSV</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Activo</th>
              <th className="px-4 py-2.5 w-16"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ej) => (
              <tr key={ej.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-700 font-medium">{ej.anio}</td>
                <td className="px-4 py-2.5 text-slate-600">{fmtDate(ej.fecha_inicio)}</td>
                <td className="px-4 py-2.5 text-slate-600">{fmtDate(ej.fecha_fin)}</td>
                <td className="px-4 py-2.5 text-slate-600">{ej.codigo_csv || "—"}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={ej.activo ? "completada" : "pendiente"} />
                </td>
                <td className="px-4 py-2.5">
                  <Button variant="danger" size="sm" onClick={() => setDeleteTarget(ej)}>
                    <Icon name="trash" size={14} />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin ejercicios</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nuevo ejercicio">
        <form onSubmit={handleAdd} className="space-y-1">
          <Field label="Ano" value={form.anio} onChange={(v) => setForm({ ...form, anio: v })} type="number" />
          <Field label="Fecha inicio" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} type="date" />
          <Field label="Fecha fin" value={form.fecha_fin} onChange={(v) => setForm({ ...form, fecha_fin: v })} type="date" />
          <Field label="Codigo CSV" value={form.codigo_csv} onChange={(v) => setForm({ ...form, codigo_csv: v })} />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar ejercicio"
        message={`Se eliminara el ejercicio ${deleteTarget?.anio}. Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
      />
    </div>
  );
}
