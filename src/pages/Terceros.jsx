import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmtCurrency } from "../utils/format";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Modal from "../components/ui/Modal";
import Field from "../components/ui/Field";

const FIELD_MAP = {
  proveedores: {
    nombre: "nombre_proveedor",
    nif: "nif_proveedor",
    cuenta: "cuenta_gasto",
    cuentaTercero: "cuenta_proveedor",
    nifLabel: "NIF",
    cuentaLabel: "Cuenta de gasto",
  },
  clientes: {
    nombre: "nombre",
    nif: "cif",
    cuenta: "cuenta_ingresos",
    cuentaTercero: "cuenta_cliente",
    nifLabel: "CIF",
    cuentaLabel: "Cuenta de ingresos",
  },
};

export default function Terceros({ tipo = "proveedores" }) {
  const toast = useToast();
  const fields = FIELD_MAP[tipo];

  const [records, setRecords] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nombre: "", nif: "", cuenta: "", cuentaTercero: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, facs] = await Promise.all([
        api.listRecords(tipo),
        api.listRecords("facturas", { limit: 1000 }),
      ]);
      setRecords(Array.isArray(recs) ? recs : recs?.list || []);
      setFacturas(Array.isArray(facs) ? facs : facs?.list || []);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [tipo, toast]);

  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => {
    const map = {};
    for (const r of records) {
      const name = r[fields.nombre] || "";
      map[r.Id] = { count: 0, total: 0, name };
    }
    for (const f of facturas) {
      if (f.eliminada) continue;
      const matchField = tipo === "proveedores" ? "nif_proveedor" : "cif_cliente";
      const matchNif = f[matchField] || f.nif_emisor;
      const rec = records.find((r) => r[fields.nif] === matchNif);
      if (rec && map[rec.Id]) {
        map[rec.Id].count++;
        map[rec.Id].total += Number(f.total_factura) || 0;
      }
    }
    return map;
  }, [records, facturas, tipo, fields]);

  async function handleSave() {
    if (!form.nombre.trim()) {
      toast("El nombre es obligatorio", "warning");
      return;
    }
    try {
      const data = {
        [fields.nombre]: form.nombre,
        [fields.nif]: form.nif,
        [fields.cuenta]: form.cuenta,
      };
      if (form.cuentaTercero) data[fields.cuentaTercero] = form.cuentaTercero;

      await api.createRecord(tipo, data);
      toast(`${tipo === "proveedores" ? "Proveedor" : "Cliente"} creado`, "success");
      setShowAdd(false);
      setForm({ nombre: "", nif: "", cuenta: "", cuentaTercero: "" });
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  const title = tipo === "proveedores" ? "Proveedores" : "Clientes";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">{title}</h1>
        <Button onClick={() => setShowAdd(true)}>
          <Icon name="plus" size={16} /> Nuevo
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Cargando...</div>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No hay {tipo} registrados</div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Nombre</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{fields.nifLabel}</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{fields.cuentaLabel}</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cuenta tercero</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Facturas</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Total</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const s = stats[r.Id] || { count: 0, total: 0 };
                return (
                  <tr key={r.Id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-2.5 text-slate-700 font-medium">{r[fields.nombre] || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r[fields.nif] || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r[fields.cuenta] || "—"}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r[fields.cuentaTercero] || "—"}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{s.count}</td>
                    <td className="px-4 py-2.5 text-right text-slate-700 font-medium">{fmtCurrency(s.total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={`Nuevo ${tipo === "proveedores" ? "proveedor" : "cliente"}`}>
        <Field label="Nombre" value={form.nombre} onChange={(v) => setForm({ ...form, nombre: v })} placeholder="Nombre o razón social" />
        <Field label={fields.nifLabel} value={form.nif} onChange={(v) => setForm({ ...form, nif: v })} placeholder="Identificación fiscal" />
        <Field label={fields.cuentaLabel} value={form.cuenta} onChange={(v) => setForm({ ...form, cuenta: v })} placeholder="Ej: 6000001" />
        <Field label="Cuenta de tercero" value={form.cuentaTercero} onChange={(v) => setForm({ ...form, cuentaTercero: v })} placeholder="Ej: 4000001" />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancelar</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </div>
      </Modal>
    </div>
  );
}
