import React, { useState, useEffect, useCallback } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";

const TIPO_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "carpeta", label: "Carpeta local" },
  { value: "api", label: "API" },
  { value: "ftp", label: "FTP" },
];

const TIPO_COLORS = {
  email: "bg-blue-100 text-blue-700",
  carpeta: "bg-yellow-100 text-yellow-700",
  api: "bg-purple-100 text-purple-700",
  ftp: "bg-gray-100 text-gray-600",
};

export default function PuntosCargaTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ tipo: "email", punto: "", email_asociado: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.listRecords("conectores");
      setRows(Array.isArray(data) ? data : data?.list || []);
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
      await api.createRecord("conectores", form);
      toast("Punto de carga creado", "success");
      setShowAdd(false);
      setForm({ tipo: "email", punto: "", email_asociado: "" });
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Puntos de carga</h3>
          <p className="text-xs text-slate-400 mt-0.5">Orígenes de documentos (email, carpeta, API)</p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Nuevo punto
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Cargando...</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Punto de carga</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Email asociado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TIPO_COLORS[r.tipo] || TIPO_COLORS.ftp}`}>
                      {r.tipo || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{r.punto || "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.email_asociado || r.email || ""}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-400">Sin puntos de carga</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Nuevo punto de carga">
        <form onSubmit={handleAdd} className="space-y-1">
          <Field label="Tipo" value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v })} options={TIPO_OPTIONS} />
          <Field label="Punto de carga" value={form.punto} onChange={(v) => setForm({ ...form, punto: v })} placeholder={form.tipo === "email" ? "facturas@miempresa.com" : "/ruta/carpeta"} />
          <Field label="Email asociado" value={form.email_asociado} onChange={(v) => setForm({ ...form, email_asociado: v })} type="email" placeholder="notificaciones@miempresa.com" />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
