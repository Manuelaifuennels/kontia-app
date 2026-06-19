import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmt } from "../utils/format";

const PIE_COLORS = ["#0d9488", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function Dashboard() {
  const toast = useToast();
  const [facturas, setFacturas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listRecords("facturas", { limit: 500, sort: "-fecha_factura" })
      .then((data) => setFacturas(Array.isArray(data) ? data : data?.list || []))
      .catch((err) => toast(err.message, "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const active = useMemo(() => facturas.filter((f) => !f.eliminada), [facturas]);

  const kpis = useMemo(() => {
    const total = active.reduce((s, f) => s + (parseFloat(f.total_factura || f.total) || 0), 0);
    const contabilizadas = active.filter((f) => f.estado === "completada" || f.estado === "contabilizada").length;
    const pendientes = active.filter((f) => f.estado !== "completada" && f.estado !== "contabilizada").length;
    const errores = active.filter((f) => f.estado === "error").length;
    return { total, contabilizadas, pendientes, errores };
  }, [active]);

  const barData = useMemo(() => {
    const byMonth = {};
    active.forEach((f) => {
      const m = (f.fecha_factura || f.fecha_subida || "").substring(0, 7);
      if (m) byMonth[m] = (byMonth[m] || 0) + (parseFloat(f.total_factura || f.total) || 0);
    });
    return Object.entries(byMonth).sort().slice(-8).map(([k, v]) => ({
      mes: k.substring(5),
      total: Math.round(v),
    }));
  }, [active]);

  const pieData = useMemo(() => {
    const byTipo = {};
    active.forEach((f) => {
      const t = f.tipo_documento || "otro";
      byTipo[t] = (byTipo[t] || 0) + 1;
    });
    return Object.entries(byTipo).map(([k, v]) => ({
      name: k === "compra" ? "Compras" : k === "venta" ? "Ventas" : k,
      value: v,
    }));
  }, [active]);

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Cargando dashboard...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total facturado" value={`${fmt(kpis.total)} €`} color="bg-teal-50 text-teal-700" />
        <KpiCard label="Contabilizadas" value={kpis.contabilizadas} color="bg-green-50 text-green-700" />
        <KpiCard label="Pendientes" value={kpis.pendientes} color="bg-yellow-50 text-yellow-700" />
        <KpiCard label="Errores" value={kpis.errores} color="bg-red-50 text-red-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Evolución mensual</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <XAxis dataKey="mes" fontSize={12} />
              <YAxis fontSize={11} />
              <Tooltip formatter={(v) => `${fmt(v)} €`} />
              <Bar dataKey="total" fill="#0d9488" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Por tipo</h2>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({name, value}) => `${name}: ${value}`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, color }) {
  return (
    <div className={`rounded-xl p-5 ${color}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
