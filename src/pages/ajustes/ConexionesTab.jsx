import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/client";

const WEBHOOKS = [
  "kontia-login",
  "kontia-registro",
  "exportar-csv",
  "exportar-a3",
  "exportar-contaplus",
  "exportar-contasol",
  "conciliacion-bancaria",
  "procesar-factura",
  "separar-pdf",
];

export default function ConexionesTab() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get("/status").then(setStatus).catch(() => {});
  }, []);

  const rows = [
    ["ID Empresa", user?.empresa_id],
    ["NocoDB", status?.noco || "", "🟢"],
    ["n8n Webhooks", status?.webhooks || "", "🟢"],
    ["MinIO", status?.minio || "", "🟢"],
    ["Webhooks activos", WEBHOOKS.join(", ")],
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Estado de conexiones</h3>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([label, value, indicator], i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-700 font-semibold w-40">{label}</td>
                <td className="px-4 py-3 text-slate-600 text-xs break-all">{value}</td>
                {indicator && <td className="px-4 py-3">{indicator}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
