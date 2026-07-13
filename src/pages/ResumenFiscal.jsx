import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmt } from "../utils/format";

// Los 9 tramos de base del modelo de facturas (incluye exentas y no sujetas)
const BASE_KEYS = [
  "base_iva_21", "base_iva_12", "base_iva_10_5", "base_iva_10",
  "base_iva_5", "base_iva_4", "base_iva_0", "base_iva_0_no_ex", "base_iva_0_no_sujeto",
];
const CUOTA_KEYS = [
  "cuota_iva_21", "cuota_iva_12", "cuota_iva_10_5", "cuota_iva_10",
  "cuota_iva_5", "cuota_iva_4",
];

function sumFields(f, keys) {
  return keys.reduce((s, k) => s + (Number(f[k]) || 0), 0);
}

function getQuarter(dateStr) {
  if (!dateStr) return null;
  const m = parseInt(String(dateStr).substring(5, 7), 10);
  if (!m || m < 1 || m > 12) return null;
  return Math.floor((m - 1) / 3);
}

// Misma lógica de dirección que el backend (data.js): venta/emitida/exportacion → venta;
// rectificativa/intracom deciden por proveedor_id/cliente_id; resto → compra.
function esVenta(f) {
  const tipo = f.tipo_documento;
  if (["venta", "emitida", "exportacion"].includes(tipo)) return true;
  if (tipo === "rectificativa" || tipo === "intracomunitaria") {
    if (f.proveedor_id) return false;
    if (f.cliente_id) return true;
  }
  return false;
}

const Q_LABELS = ["T1", "T2", "T3", "T4"];

export default function ResumenFiscal() {
  const toast = useToast();
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [anio, setAnio] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    api.listAllRecords("facturas", { sort: "-fecha_factura" })
      .then((data) => setFacturas(data?.list || []))
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const active = useMemo(
    () => facturas.filter((f) => f.eliminada !== true && f.eliminada !== "true"),
    [facturas]
  );

  const aniosDisponibles = useMemo(() => {
    const set = new Set();
    for (const f of active) {
      const y = String(f.fecha_factura || "").substring(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    }
    const arr = [...set].sort().reverse();
    return arr.length ? arr : [String(new Date().getFullYear())];
  }, [active]);

  useEffect(() => {
    if (!aniosDisponibles.includes(anio)) setAnio(aniosDisponibles[0]);
  }, [aniosDisponibles, anio]);

  const quarters = useMemo(() => {
    const qs = [0, 1, 2, 3].map((i) => ({
      name: Q_LABELS[i],
      baseVentas: 0,
      baseCompras: 0,
      ivaRepercutido: 0,
      ivaSoportado: 0,
      retencionPracticada: 0,
      retencionSoportada: 0,
    }));

    for (const f of active) {
      if (String(f.fecha_factura || "").substring(0, 4) !== anio) continue;
      const q = getQuarter(f.fecha_factura);
      if (q === null) continue;

      const tieneDesglose = BASE_KEYS.some((k) => Number(f[k]) > 0);
      const base = tieneDesglose ? sumFields(f, BASE_KEYS) : (Number(f.base_imponible) || 0);
      const iva = tieneDesglose ? sumFields(f, CUOTA_KEYS) : (Number(f.cuota_iva) || 0);
      const retencion = Number(f.cuota_retencion) || 0;

      if (esVenta(f)) {
        qs[q].baseVentas += base;
        qs[q].ivaRepercutido += iva;
        // retención que el cliente nos practica: deducible en nuestro IRPF/IS
        qs[q].retencionSoportada += retencion;
      } else {
        qs[q].baseCompras += base;
        qs[q].ivaSoportado += iva;
        // retención practicada a profesionales: a ingresar vía modelo 111
        qs[q].retencionPracticada += retencion;
      }
    }

    for (const q of qs) {
      for (const k of ["baseVentas", "baseCompras", "ivaRepercutido", "ivaSoportado", "retencionPracticada", "retencionSoportada"]) {
        q[k] = Math.round(q[k] * 100) / 100;
      }
      q.ivaNeto = Math.round((q.ivaRepercutido - q.ivaSoportado) * 100) / 100;
    }
    return qs;
  }, [active, anio]);

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Cargando resumen fiscal...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Resumen Fiscal</h1>
        <select
          value={anio}
          onChange={(e) => setAnio(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer"
        >
          {aniosDisponibles.map((y) => (
            <option key={y} value={y}>Ejercicio {y}</option>
          ))}
        </select>
      </div>

      {/* Bar chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">IVA e IRPF por trimestre — {anio}</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={quarters}>
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v) => `${fmt(v)} €`} />
            <Bar dataKey="ivaRepercutido" fill="#3b82f6" name="IVA repercutido" radius={[4, 4, 0, 0]} />
            <Bar dataKey="ivaSoportado" fill="#0d9488" name="IVA soportado" radius={[4, 4, 0, 0]} />
            <Bar dataKey="retencionPracticada" fill="#f59e0b" name="IRPF practicado (mod. 111)" radius={[4, 4, 0, 0]} />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* KPI cards per quarter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quarters.map((q, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-base font-bold text-slate-700 mb-2">{q.name} {anio}</p>
            <div className="space-y-1 text-xs">
              <div className="text-slate-500">Base ventas: <b className="text-slate-700">{fmt(q.baseVentas)} €</b></div>
              <div className="text-slate-500">Base compras: <b className="text-slate-700">{fmt(q.baseCompras)} €</b></div>
              <div className="text-slate-500">IVA repercutido: <b className="text-blue-600">{fmt(q.ivaRepercutido)} €</b></div>
              <div className="text-slate-500">IVA soportado: <b className="text-teal-600">{fmt(q.ivaSoportado)} €</b></div>
              <div className="text-slate-500">IRPF practicado: <b className="text-amber-600">{fmt(q.retencionPracticada)} €</b></div>
              <div className="text-slate-500">IRPF soportado: <b className="text-amber-600">{fmt(q.retencionSoportada)} €</b></div>
              <div className="pt-1 border-t border-slate-100 text-slate-500">
                IVA a liquidar: <b className={q.ivaNeto >= 0 ? "text-slate-800" : "text-green-600"}>{fmt(q.ivaNeto)} €</b>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-400 mt-4">
        Orientativo: proxy del modelo 303 calculado sobre las facturas registradas. No sustituye a la liquidación oficial.
      </p>
    </div>
  );
}
