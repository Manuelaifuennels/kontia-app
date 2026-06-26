import React, { useState, useEffect, useMemo, useCallback } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmt } from "../utils/format";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Modal from "../components/ui/Modal";
import Field from "../components/ui/Field";

export default function Terceros({ tipo = "proveedores" }) {
  const toast = useToast();
  const isProv = tipo === "proveedores";

  const [records, setRecords] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ nombre: "", nif: "", cuenta: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, facs] = await Promise.all([
        api.listRecords(tipo, { limit: 200 }),
        api.listRecords("facturas", { limit: 1000 }),
      ]);
      setRecords(recs?.list || (Array.isArray(recs) ? recs : []));
      setFacturas(facs?.list || (Array.isArray(facs) ? facs : []));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [tipo, toast]);

  useEffect(() => { load(); }, [load]);

  const enriched = useMemo(() => {
    return records.map((t) => {
      const fs = facturas.filter((f) => {
        if (f.eliminada === true || f.eliminada === "true") return false;
        if (isProv) {
          return f.nombre_emisor === t.nombre_proveedor || f.nif_emisor === t.nif_proveedor;
        }
        return f.nombre_receptor === t.nombre;
      });
      return {
        ...t,
        numFacts: fs.length,
        totalGasto: fs.reduce((s, f) => s + (parseFloat(f.total_factura || f.total) || 0), 0),
      };
    });
  }, [records, facturas, isProv]);

  async function saveItem() {
    setSaving(true);
    try {
      const rec = isProv
        ? { nombre_proveedor: form.nombre, nif_proveedor: form.nif, cuenta_gasto: form.cuenta }
        : { nombre: form.nombre, cif: form.nif, cuenta_ingresos: form.cuenta };
      await api.createRecord(tipo, rec);
      toast(`${isProv ? "Proveedor" : "Cliente"} creado`, "success");
      setShowAdd(false);
      setForm({ nombre: "", nif: "", cuenta: "" });
      load();
    } catch (err) {
      toast(err.message, "error");
    }
    setSaving(false);
  }

  const title = isProv ? "Proveedores" : "Clientes";

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <Button onClick={() => { setForm({ nombre: "", nif: "", cuenta: "" }); setShowAdd(true); }}>
          <Icon name="plus" size={14} /> Nuevo
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr className="bg-slate-50">
              {[
                isProv ? "Nombre proveedor" : "Nombre cliente",
                isProv ? "CIF" : "CIF",
                isProv ? "Cuenta gastos" : "Cuenta ingresos",
                isProv ? "Cuenta proveedor" : "Cuenta cliente",
                "Facturas",
                "Total",
              ].map((h) => (
                <th key={h} className="px-3.5 py-2.5 text-left text-xs font-semibold text-slate-500 border-b border-slate-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {enriched.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400">Sin {tipo}</td></tr>
            )}
            {enriched.map((t, i) => (
              <tr key={t.Id || i} className="border-b border-slate-100">
                <td className="px-3.5 py-2.5 font-medium">{isProv ? (t.nombre_proveedor || t.nombre || "") : (t.nombre || "")}</td>
                <td className="px-3.5 py-2.5">{isProv ? (t.nif_proveedor || t.nif || t.cif || "") : (t.nif || t.cif || "")}</td>
                <td className="px-3.5 py-2.5">{isProv ? (t.cuenta_gastos || t.cuenta_gasto || t.cuenta_contable || "") : (t.cuenta_ingresos || "")}</td>
                <td className="px-3.5 py-2.5">{isProv ? (t.cuenta_proveedor || "") : (t.cuenta_cliente || "")}</td>
                <td className="px-3.5 py-2.5">{t.numFacts}</td>
                <td className="px-3.5 py-2.5 font-semibold">{fmt(t.totalGasto)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={isProv ? "Nuevo proveedor" : "Nuevo cliente"}>
        <Field label={isProv ? "Nombre proveedor" : "Nombre cliente"} value={form.nombre} onChange={(v) => setForm((p) => ({ ...p, nombre: v }))} />
        <Field label="CIF / NIF" value={form.nif} onChange={(v) => setForm((p) => ({ ...p, nif: v }))} />
        <Field label={isProv ? "Cuenta gastos" : "Cuenta ingresos"} value={form.cuenta} onChange={(v) => setForm((p) => ({ ...p, cuenta: v }))} />
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancelar</Button>
          <Button onClick={saveItem} disabled={saving}>{saving ? "Guardando..." : "Crear"}</Button>
        </div>
      </Modal>
    </div>
  );
}
