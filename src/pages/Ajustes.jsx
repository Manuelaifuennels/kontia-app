import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import DatosTab from "./ajustes/DatosTab";
import UsuariosTab from "./ajustes/UsuariosTab";
import ActividadesTab from "./ajustes/ActividadesTab";
import EjerciciosTab from "./ajustes/EjerciciosTab";
import PuntosCargaTab from "./ajustes/PuntosCargaTab";
import MaestroTab from "./ajustes/MaestroTab";
import EmisorTab from "./ajustes/EmisorTab";
import HistorialTab from "./ajustes/HistorialTab";
import ConexionesTab from "./ajustes/ConexionesTab";

const TABS = [
  { key: "datos", label: "Datos" },
  { key: "usuarios", label: "Usuarios" },
  { key: "actividades", label: "Actividades" },
  { key: "ejercicios", label: "Ejercicios" },
  { key: "puntos", label: "Puntos de carga" },
  { key: "maestro", label: "Maestro Cuentas" },
  { key: "emisor", label: "Emisor Facturas" },
  { key: "historial", label: "Historial Correos" },
  { key: "conexiones", label: "Conexiones" },
];

export default function Ajustes() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState("datos");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState(null);
  const [ejercicios, setEjercicios] = useState([]);
  const [maestro, setMaestro] = useState([]);
  const [actividades, setActividades] = useState([]);
  const [emisor, setEmisor] = useState([]);
  const [historial, setHistorial] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgData, ejData, maData, acData, emData, hiData] = await Promise.all([
        api.listRecords("config"),
        api.listRecords("ejercicios"),
        api.listRecords("maestro"),
        api.listRecords("actividades"),
        api.listRecords("emisor"),
        api.listRecords("historial"),
      ]);
      const toList = (d) => d?.list || (Array.isArray(d) ? d : []);
      setConfig(toList(cfgData)[0] || null);
      setEjercicios(toList(ejData));
      setMaestro(toList(maData));
      setActividades(toList(acData));
      setEmisor(toList(emData)[0] || null);
      setHistorial(toList(hiData));
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleSaveConfig(data) {
    setSaving(true);
    try {
      if (data.Id) {
        await api.updateRecord("config", data);
      } else {
        await api.createRecord("config", data);
      }
      toast("Configuración guardada", "success");
      loadAll();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function renderTab() {
    if (loading) {
      return <div className="text-center py-16 text-slate-400">Cargando ajustes...</div>;
    }

    switch (tab) {
      case "datos":
        return <DatosTab config={config} onSave={handleSaveConfig} saving={saving} />;
      case "usuarios":
        return <UsuariosTab user={user} />;
      case "actividades":
        return <ActividadesTab actividades={actividades} onReload={loadAll} />;
      case "ejercicios":
        return <EjerciciosTab ejercicios={ejercicios} onReload={loadAll} />;
      case "puntos":
        return <PuntosCargaTab />;
      case "maestro":
        return <MaestroTab maestro={maestro} onReload={loadAll} />;
      case "emisor":
        return <EmisorTab emisor={emisor} onReload={loadAll} />;
      case "historial":
        return <HistorialTab historial={historial} />;
      case "conexiones":
        return <ConexionesTab />;
      default:
        return null;
    }
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Ajustes — {user?.empresa_nombre || `Empresa ${user?.empresa_id}`}</h1>
          <p className="text-sm text-slate-400 mt-0.5">Configuración de empresa</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? "bg-teal-50 text-teal-700"
                : "bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {renderTab()}
    </div>
  );
}
