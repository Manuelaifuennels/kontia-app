import React, { useState } from "react";
import Collapse from "../components/ui/Collapse";

const DOC_TYPES = [
  { value: "facturas", label: "Facturas" },
  { value: "simplificadas", label: "F. Simplificadas" },
  { value: "presupuestos", label: "Presupuestos" },
  { value: "albaranes", label: "Albaranes" },
  { value: "proformas", label: "Proformas" },
];

export default function FacturaElectronica() {
  const [tipoDoc, setTipoDoc] = useState("facturas");

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-slate-800">Factura electrónica</h1>
      </div>

      <div className="mb-5">
        <div className="flex gap-2 flex-wrap">
          {DOC_TYPES.map((d) => (
            <button
              key={d.value}
              onClick={() => setTipoDoc(d.value)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                tipoDoc === d.value
                  ? "bg-teal-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Número</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Cliente</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">CIF</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Fecha</th>
              <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Importe</th>
              <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Estado</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                No hay documentos de tipo {DOC_TYPES.find((d) => d.value === tipoDoc)?.label || tipoDoc}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <Collapse title="Sobre VeriFACTu y la AEAT">
          <div className="text-sm text-slate-600 space-y-2">
            <p>
              VeriFACTu es el sistema de facturación electrónica de la Agencia Tributaria (AEAT) que permite
              la emisión y recepción de facturas en formato estructurado, garantizando su autenticidad e integridad.
            </p>
            <p>
              Las facturas electrónicas se envían directamente a la AEAT, cumpliendo con el Reglamento de
              facturación (RD 1619/2012) y las especificaciones técnicas del SII (Suministro Inmediato de Información).
            </p>
            <p>
              Desde Kontia puedes generar borradores de facturas electrónicas que posteriormente se firmarán
              y enviarán a la AEAT a través de los servicios web habilitados.
            </p>
          </div>
        </Collapse>
      </div>
    </div>
  );
}
