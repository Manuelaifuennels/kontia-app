import React from "react";
import { useAuth } from "../../hooks/useAuth";

function StatusDot({ connected }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${connected ? "bg-green-500" : "bg-gray-300"}`} />
  );
}

const WEBHOOKS = [
  "kontia-login",
  "kontia-registro",
  "procesar-factura",
  "exportar-csv",
  "exportar-a3",
  "exportar-contaplus",
  "exportar-contasol",
  "conciliacion-bancaria",
  "separar-pdf",
];

export default function ConexionesTab() {
  const { user } = useAuth();

  const services = [
    { label: "ID Empresa", value: user?.empresa_id || user?.id_empresa || "—" },
    { label: "NocoDB", connected: true },
    { label: "n8n Webhooks", connected: true },
    { label: "MinIO", connected: true },
  ];

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Estado de conexiones</h3>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {services.map((s, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="px-4 py-3 text-slate-700 font-semibold w-40">{s.label}</td>
                <td className="px-4 py-3 text-slate-600">
                  {s.value ? (
                    <span className="text-sm">{s.value}</span>
                  ) : (
                    <span className="flex items-center">
                      <StatusDot connected={s.connected} />
                      <span className={s.connected ? "text-green-700" : "text-gray-500"}>
                        {s.connected ? "Conectado" : "Desconectado"}
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            <tr className="border-b border-slate-100">
              <td className="px-4 py-3 text-slate-700 font-semibold align-top">Webhooks activos</td>
              <td className="px-4 py-3 text-slate-600 text-xs break-all">
                {WEBHOOKS.join(", ")}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
