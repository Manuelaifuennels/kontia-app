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
  const { user, logout } = useAuth();
  const [currentPage, setCurrentPage] = useState("contabilidad");
  const [facturas, setFacturas] = useState([]);

  const loadFacturas = useCallback(async () => {
    try {
      const data = await api.listRecords("facturas", { limit: 500, sort: "-fecha_factura" });
      setFacturas(data?.list || (Array.isArray(data) ? data : []));
    } catch {}
  }, []);

  useEffect(() => {
    if (currentPage === "papelera") loadFacturas();
  }, [currentPage, loadFacturas]);

  const facPapelera = useMemo(() => facturas.filter((f) => f.eliminada), [facturas]);

  const PAGES = {
    contabilidad: () => <Contabilidad />,
    dashboard: () => <Dashboard />,
    proveedores: () => <Terceros tipo="proveedores" />,
    clientes: () => <Terceros tipo="clientes" />,
    resumen: () => <ResumenFiscal />,
    conectores: () => <Conectores />,
    verifactu: () => <FacturaElectronica />,
    conciliacion: () => <Conciliacion />,
    ajustes: () => <Ajustes />,
    papelera: () => <Papelera facturas={facPapelera} onReload={loadFacturas} />,
  };

  const renderPage = PAGES[currentPage] || PAGES.contabilidad;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        user={user}
        onLogout={logout}
      />
      <main className="flex-1 overflow-auto">{renderPage()}</main>
    </div>
  );
}
