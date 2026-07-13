import React, { useState } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import { fmtDate } from "../../utils/format";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";
import ConfirmDialog from "../../components/ui/ConfirmDialog";

export default function EjerciciosTab({ ejercicios, onReload }) {
  const toast = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cerrarTarget, setCerrarTarget] = useState(null);
  const [form, setForm] = useState({ anio: "", fecha_inicio: "", fecha_fin: "" });
  const [busy, setBusy] = useState(false);

  const rows = Array.isArray(ejercicios) ? ejercicios : ejercicios?.list || [];

  async function handleAdd(e) {
    e.preventDefault();
    const anioNum = parseInt(form.anio, 10);
    if (!anioNum || anioNum < 2000 || anioNum > 2100) {
      return toast("Introduce un año válido (2000-2100)", "warning");
    }
    try {
      await api.createRecord("ejercicios", {
        anio: anioNum,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        estado: "abierto",
      });
      toast("Ejercicio creado", "success");
      setShowAdd(false);
      setForm({ anio: "", fecha_inicio: "", fecha_fin: "" });
      onReload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleCerrar() {
    if (!cerrarTarget) return;
    try {
      await api.updateRecord("ejercicios", { Id: cerrarTarget.Id, estado: "cerrado" });
      toast(`Ejercicio ${cerrarTarget.anio} cerrado`, "success");
      onReload();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleReabrir(ej) {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateRecord("ejercicios", { Id: ej.Id, estado: "abierto", bloqueado: false, fecha_cierre: null });
      toast(`Ejercicio ${ej.anio} reabierto`, "success");
      onReload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleBloqueo(ej) {
    if (busy) return;
    setBusy(true);
    const bloquear = !ej.bloqueado;
    try {
      await api.updateRecord("ejercicios", { Id: ej.Id, bloqueado: bloquear });
      toast(bloquear ? `Ejercicio ${ej.anio} bloqueado` : `Ejercicio ${ej.anio} desbloqueado`, "success");
      onReload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
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

  function estadoBadge(ej) {
    if (ej.estado === "cerrado") {
      return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-slate-200 text-slate-600">Cerrado</span>;
    }
    if (ej.bloqueado) {
      return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700">Bloqueado</span>;
    }
    return <span className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-green-100 text-green-700">Abierto</span>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-slate-700">Ejercicios contables</h3>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Añadir ejercicio
        </Button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Año</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Fecha inicio</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Fecha fin</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Estado</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Fecha cierre</th>
              <th className="px-4 py-2.5 w-44"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((ej) => (
              <tr key={ej.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2.5 text-slate-700 font-medium">{ej.anio}</td>
                <td className="px-4 py-2.5 text-slate-600">{ej.fecha_inicio ? fmtDate(ej.fecha_inicio) : "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{ej.fecha_fin ? fmtDate(ej.fecha_fin) : "—"}</td>
                <td className="px-4 py-2.5">{estadoBadge(ej)}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{ej.fecha_cierre ? fmtDate(ej.fecha_cierre) : "—"}</td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1 justify-end">
                    {ej.estado === "cerrado" ? (
                      <Button variant="secondary" size="sm" onClick={() => handleReabrir(ej)} disabled={busy} title="Reabrir ejercicio">
                        <Icon name="undo" size={13} /> Reabrir
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => handleBloqueo(ej)} disabled={busy} title={ej.bloqueado ? "Desbloquear" : "Bloquear temporalmente"}>
                          {ej.bloqueado ? "Desbloquear" : "Bloquear"}
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => setCerrarTarget(ej)} disabled={busy} title="Cerrar ejercicio (valida el cuadre de todos los asientos)">
                          Cerrar
                        </Button>
                      </>
                    )}
                    <Button variant="danger" size="sm" onClick={() => setDeleteTarget(ej)}>
                      <Icon name="trash" size={14} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">Sin ejercicios. Añade uno.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nuevo ejercicio">
        <form onSubmit={handleAdd} className="space-y-1">
          <Field label="Año" value={form.anio} onChange={(v) => setForm({ ...form, anio: v })} type="number" />
          <Field label="Fecha inicio" type="date" value={form.fecha_inicio} onChange={(v) => setForm({ ...form, fecha_inicio: v })} />
          <Field label="Fecha fin" type="date" value={form.fecha_fin} onChange={(v) => setForm({ ...form, fecha_fin: v })} />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">Crear</Button>
          </div>
        </form>
      </Modal>

      {/* Cerrar confirm */}
      <ConfirmDialog
        open={!!cerrarTarget}
        onClose={() => setCerrarTarget(null)}
        onConfirm={handleCerrar}
        title="Cerrar ejercicio"
        message={`Se cerrará el ejercicio ${cerrarTarget?.anio}. No se podrán añadir ni modificar asientos. El sistema comprobará antes que todos los asientos estén cuadrados.`}
        confirmText="Cerrar ejercicio"
        variant="danger"
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar ejercicio"
        message={`Se eliminará el ejercicio ${deleteTarget?.anio}. Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
      />
    </div>
  );
}
