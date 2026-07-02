import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import { can } from "../constants/permissions";
import { fmt, fmtDate } from "../utils/format";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";

const ESTADO_ENVIO_COLORS = {
  pendiente: "bg-amber-100 text-amber-700",
  enviado: "bg-blue-100 text-blue-700",
  aceptado: "bg-green-100 text-green-700",
  rechazado: "bg-red-100 text-red-700",
};

export default function FacturaElectronica() {
  const { user } = useAuth();
  const toast = useToast();

  const [estado, setEstado] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(null);

  const esAdmin = user?.rol === "admin";
  const puedeGenerar = can(user, "contabilizar");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [est, regs, pend] = await Promise.all([
        api.get("/verifactu/estado"),
        api.get("/verifactu/registros", { limit: 200 }),
        api.get("/verifactu/pendientes"),
      ]);
      setEstado(est);
      setRegistros(regs?.list || []);
      setPendientes(pend?.list || []);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  async function toggleActivo() {
    try {
      const r = await api.patch("/verifactu/config", { activo: !estado?.activo });
      setEstado((p) => ({ ...p, activo: r.activo }));
      toast(r.activo ? "VeriFactu activado" : "VeriFactu desactivado", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function generarAlta(facturaId) {
    setGenerando(facturaId);
    try {
      await api.post(`/verifactu/facturas/${facturaId}/alta`);
      toast("Registro de facturación generado", "success");
      load();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setGenerando(null);
    }
  }

  async function generarTodas() {
    setGenerando("all");
    let ok = 0, fail = 0;
    for (const f of pendientes) {
      try {
        await api.post(`/verifactu/facturas/${f.id}/alta`);
        ok++;
      } catch {
        fail++;
      }
    }
    toast(`${ok} registros generados${fail ? `, ${fail} con error` : ""}`, fail === 0 ? "success" : "warning");
    setGenerando(null);
    load();
  }

  if (loading) {
    return <div className="p-6 text-center text-slate-400">Cargando VeriFactu...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Veri*Factu</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Registros de facturación con encadenamiento de huellas (RD 1007/2023)
          </p>
        </div>
        {esAdmin && (
          <Button variant={estado?.activo ? "secondary" : "primary"} onClick={toggleActivo}>
            {estado?.activo ? "Desactivar" : "Activar VeriFactu"}
          </Button>
        )}
      </div>

      {/* Estado */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className={`rounded-xl p-4 ${estado?.activo ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-500"}`}>
          <p className="text-xs font-medium opacity-70 mb-1">Estado</p>
          <p className="text-lg font-bold">{estado?.activo ? "Activo" : "Inactivo"}</p>
        </div>
        <div className="rounded-xl p-4 bg-teal-50 text-teal-700">
          <p className="text-xs font-medium opacity-70 mb-1">Registros generados</p>
          <p className="text-lg font-bold">{estado?.totalRegistros ?? 0}</p>
        </div>
        <div className="rounded-xl p-4 bg-amber-50 text-amber-700">
          <p className="text-xs font-medium opacity-70 mb-1">Facturas sin registro</p>
          <p className="text-lg font-bold">{pendientes.length}</p>
        </div>
        <div className="rounded-xl p-4 bg-indigo-50 text-indigo-700">
          <p className="text-xs font-medium opacity-70 mb-1">NIF emisor</p>
          <p className="text-lg font-bold">{estado?.nifEmisor || "Sin configurar"}</p>
        </div>
      </div>

      {/* Pendientes */}
      {pendientes.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-6">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">
              Facturas emitidas sin registro de alta
            </h2>
            {puedeGenerar && (
              <Button size="sm" onClick={generarTodas} disabled={generando !== null}>
                {generando === "all" ? "Generando..." : `Generar todas (${pendientes.length})`}
              </Button>
            )}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Nº Factura", "Fecha", "Cliente", "Total", ""].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendientes.map((f) => (
                <tr key={f.id} className="border-b border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-700">{f.numero_factura}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(f.fecha_factura)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{f.nombre_receptor || "—"}</td>
                  <td className="px-4 py-2.5 font-semibold">{fmt(f.total_factura)} €</td>
                  <td className="px-4 py-2.5 text-right">
                    {puedeGenerar && (
                      <Button variant="secondary" size="sm" onClick={() => generarAlta(f.id)} disabled={generando !== null}>
                        {generando === f.id ? "..." : "Generar registro"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Registros */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">Registros de facturación</h2>
        </div>
        {registros.length === 0 ? (
          <div className="px-4 py-10 text-center text-slate-400 text-sm">
            Sin registros. Contabiliza una factura emitida y genera su registro de alta.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {["Tipo", "Nº Serie", "Fecha exp.", "Importe", "Huella (SHA-256)", "Encadenada", "Envío AEAT", "QR"].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registros.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${r.tipo === "alta" ? "bg-teal-100 text-teal-700" : "bg-red-100 text-red-700"}`}>
                        {r.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-700">{r.num_serie_factura}</td>
                    <td className="px-3 py-2 text-slate-600">{fmtDate(r.fecha_expedicion)}</td>
                    <td className="px-3 py-2 font-semibold">{fmt(r.importe_total)} €</td>
                    <td className="px-3 py-2 font-mono text-slate-500" title={r.huella}>
                      {(r.huella || "").substring(0, 16)}…
                    </td>
                    <td className="px-3 py-2">
                      {r.huella_anterior ? (
                        <span className="text-green-600" title={`Anterior: ${r.huella_anterior}`}>✓</span>
                      ) : (
                        <span className="text-slate-400" title="Primer registro de la cadena">inicio</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${ESTADO_ENVIO_COLORS[r.estado_envio] || ESTADO_ENVIO_COLORS.pendiente}`}>
                        {r.estado_envio}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {r.qr_url && (
                        <a href={r.qr_url} target="_blank" rel="noreferrer" className="text-teal-600 hover:underline">
                          Cotejo AEAT
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
        <b>Nota legal:</b> los registros se generan con encadenamiento de huellas SHA-256 conforme a la
        Orden HAC/1177/2024 y el QR de cotejo del RD 1007/2023. El <b>envío telemático a la AEAT</b> requiere
        certificado digital de la empresa y se activará en una fase posterior — mientras tanto los registros
        quedan en estado «pendiente» y la trazabilidad local está garantizada.
      </div>
    </div>
  );
}
