import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/client";

const WEBHOOKS = [
  "procesar-factura",
  "separar-pdf",
  "exportar-csv",
  "exportar-a3",
  "exportar-contaplus",
  "exportar-contasol",
  "conciliacion-bancaria",
];

export default function ConexionesTab() {
  const { user } = useAuth();
  // null = comprobando, true = ok, false = caído
  const [apiOk, setApiOk] = useState(null);

  useEffect(() => {
    api.get("/status")
      .then((s) => setApiOk(s?.status === "ok"))
      .catch(() => setApiOk(false));
  }, []);

  const indicator = apiOk === null ? "⏳" : apiOk ? "🟢" : "🔴";
  const statusText = apiOk === null ? "Comprobando..." : apiOk ? "Conectado" : "Sin conexión";

  const rows = [
    ["ID Empresa", user?.empresa_id],
    ["API / Base de datos", statusText, indicator],
    ["Webhooks activos", WEBHOOKS.join(", ")],
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Estado de conexiones</h3>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value, ind], i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-700 font-semibold w-40">{label}</td>
                <td className="px-4 py-3 text-slate-600 text-xs break-all">{value}</td>
                {ind && <td className="px-4 py-3">{ind}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
