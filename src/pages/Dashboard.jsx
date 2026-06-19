import React, { useState, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import { fmtCurrency } from "../utils/format";

const PIE_COLORS = ["#0d9488", "#7c3aed"];

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
    const total = active.reduce((s, f) => s + (Number(f.total_factura) || 0), 0);
    const contabilizadas = active.filter((f) => f.estado === "completada" || f.estado === "contabilizada").length;
    const pendientes = active.filter((f) => f.estado !== "completada" && f.estado !== "contabilizada").length;
    const errores = active.filter((f) => f.estado === "error").length;
    return { total, contabilizadas, pendientes, errores };
  }, [active]);

  const barData = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        label: d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" }),
        total: 0,
        count: 0,
      });
    }
    for (const f of active) {
      if (!f.fecha_factura) continue;
      const d = new Date(f.fecha_factura);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((mo) => mo.key === key);
      if (m) {
        m.total += Number(f.total_factura) || 0;
        m.count++;
      }
    }
    return months;
  }, [active]);

  const pieData = useMemo(() => {
    const compra = active.filter((f) => f.tipo_documento === "compra").length;
    const venta = active.filter((f) => f.tipo_documento === "venta").length;
    return [
      { name: "Compras", value: compra },
      { name: "Ventas", value: venta },
    ].filter((d) => d.value > 0);
  }, [active]);

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Cargando dashboard...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-slate-800 mb-6">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Total facturado" value={fmtCurrency(kpis.total)} color="bg-teal-50 text-teal-700" />
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v) => fmtCurrency(v)}
                contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0" }}
              />
              <Bar dataKey="total" fill="#0d9488" radius={[4, 4, 0, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-600 mb-4">Por tipo de documento</h2>
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-slate-400 text-sm">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
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
