import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import api from "../../api/client";
import Sidebar from "./Sidebar";
import Contabilidad from "../../pages/Contabilidad";
import Dashboard from "../../pages/Dashboard";
import Terceros from "../../pages/Terceros";
import ResumenFiscal from "../../pages/ResumenFiscal";
import Conectores from "../../pages/Conectores";
import FacturaElectronica from "../../pages/FacturaElectronica";
import Conciliacion from "../../pages/Conciliacion";
import Ajustes from "../../pages/Ajustes";
import Papelera from "../../pages/Papelera";

export default function AppLayout() {
  const { user, logout, empresas, switchEmpresa, addEmpresa } = useAuth();
  const [currentPage, setCurrentPage] = useState("contabilidad");
  const [facturas, setFacturas] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadFacturas = useCallback(async () => {
    try {
      const data = await api.listRecords("facturas", { limit: 500, sort: "-fecha_factura" });
      setFacturas(data?.list || (Array.isArray(data) ? data : []));
    } catch {}
  }, []);

  useEffect(() => {
    if (currentPage === "papelera") loadFacturas();
  }, [currentPage, loadFacturas]);

  const facPapelera = useMemo(() => facturas.filter((f) => f.eliminada === true || f.eliminada === "true"), [facturas]);

  async function handleSwitchEmpresa(empresaId) {
    try {
      await switchEmpresa(empresaId);
      setRefreshKey((k) => k + 1);
      setCurrentPage("contabilidad");
    } catch (err) {
      alert(err.message || "Error al cambiar empresa");
    }
  }

  async function handleAddEmpresa(nombre, nif) {
    return addEmpresa(nombre, nif);
  }

  const PAGES = {
    contabilidad: () => <Contabilidad key={refreshKey} />,
    dashboard: () => <Dashboard key={refreshKey} />,
    proveedores: () => <Terceros tipo="proveedores" key={refreshKey} />,
    clientes: () => <Terceros tipo="clientes" key={refreshKey} />,
    resumen: () => <ResumenFiscal key={refreshKey} />,
    conectores: () => <Conectores />,
    verifactu: () => <FacturaElectronica />,
    conciliacion: () => <Conciliacion key={refreshKey} />,
    ajustes: () => <Ajustes key={refreshKey} />,
    papelera: () => <Papelera facturas={facPapelera} onReload={loadFacturas} key={refreshKey} />,
  };

  const renderPage = PAGES[currentPage] || PAGES.contabilidad;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={user}
        onLogout={logout}
        empresas={empresas}
        onSwitchEmpresa={handleSwitchEmpresa}
        onAddEmpresa={handleAddEmpresa}
      />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  );
}
