import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmt } from "../utils/format";

const BASE_KEYS = ["base_iva_21", "base_iva_10", "base_iva_4", "base_iva_5", "base_iva_12"];
const CUOTA_KEYS = ["cuota_iva_21", "cuota_iva_10", "cuota_iva_4", "cuota_iva_5", "cuota_iva_12"];

function sumFields(f, keys) {
  return keys.reduce((s, k) => s + (Number(f[k]) || 0), 0);
}

function getQuarter(dateStr) {
  if (!dateStr) return null;
  const m = new Date(dateStr).getMonth();
  if (m < 3) return 0;
  if (m < 6) return 1;
  if (m < 9) return 2;
  return 3;
}

const Q_LABELS = ["T1", "T2", "T3", "T4"];

export default function ResumenFiscal() {
  const toast = useToast();
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listRecords("facturas", { limit: 1000, sort: "-fecha_factura" })
      .then((data) => setFacturas(Array.isArray(data) ? data : data?.list || []))
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const active = useMemo(() => facturas.filter((f) => !f.eliminada), [facturas]);

  const quarters = useMemo(() => {
    const qs = [0, 1, 2, 3].map((i) => ({
      name: Q_LABELS[i],
      base: 0,
      iva: 0,
      retencion: 0,
    }));

    for (const f of active) {
      const q = getQuarter(f.fecha_factura);
      if (q === null) continue;
      qs[q].base += sumFields(f, BASE_KEYS);
      qs[q].iva += sumFields(f, CUOTA_KEYS);
      qs[q].retencion += parseFloat(f.retencion || f.cuota_retencion) || 0;
    }
    return qs;
  }, [active]);

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Cargando resumen fiscal...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Resumen Fiscal</h1>

      {/* KPI cards per quarter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quarters.map((q, i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-slate-500 mb-3">{q.name}</p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Base imponible</span>
                <span className="font-medium text-slate-700">{fmt(q.base)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">IVA</span>
                <span className="font-medium text-blue-700">{fmt(q.iva)} €</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Retención</span>
                <span className="font-medium text-amber-600">{fmt(q.retencion)} €</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-600 mb-4">IVA e IRPF por trimestre</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={quarters}>
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={11} />
            <Tooltip formatter={(v) => `${fmt(v)} €`} />
            <Bar dataKey="base" fill="#0d9488" name="Base" radius={[4, 4, 0, 0]} />
            <Bar dataKey="iva" fill="#3b82f6" name="IVA" radius={[4, 4, 0, 0]} />
            <Bar dataKey="retencion" fill="#f59e0b" name="Retención" radius={[4, 4, 0, 0]} />
            <Legend />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
