export const CONNECTORS = [
  { id: "csv", name: "CSV Genérico", description: "Exportación configurable", icon: "📄", color: "#0d9488", active: true },
  { id: "a3", name: "A3 / Wolters Kluwer", description: "Fichero .DAT", icon: "📊", color: "#7c3aed", active: true },
  { id: "contaplus", name: "Contaplus", description: "Formato Contaplus", icon: "📁", color: "#d97706", active: true },
  { id: "contasol", name: "ContaSol", description: "Local y nube", icon: "📁", color: "#2563eb", active: true },
  { id: "sage", name: "Sage", description: "Sage 50 / 200", icon: "📁", color: "#059669", active: false },
  { id: "sage_despachos", name: "Sage Despachos", description: "Sage Despachos Connected", icon: "📁", color: "#047857", active: false },
  { id: "odoo", name: "Odoo", description: "ERP Odoo", icon: "📁", color: "#8b5cf6", active: false },
  { id: "aplifisa", name: "Aplifisa", description: "Software fiscal Aplifisa", icon: "📁", color: "#6366f1", active: false },
  { id: "glasof", name: "Glasof", description: "Gestión contable Glasof", icon: "📁", color: "#3b82f6", active: false },
  { id: "goldennet", name: "Golden Soft", description: "GoldenNet contabilidad", icon: "📁", color: "#eab308", active: false },
  { id: "diezsoftware", name: "Diez Software", description: "Soluciones Diez", icon: "📁", color: "#f97316", active: false },
  { id: "bancos", name: "Bancos", description: "Extractos bancarios", icon: "🏦", color: "#0ea5e9", active: false },
  { id: "windows", name: "Windows", description: "Exportación escritorio", icon: "🖥️", color: "#64748b", active: false },
];

export const WEBHOOK_MAP = {
  csv: "exportar-csv",
  a3: "exportar-a3",
  contaplus: "exportar-contaplus",
  contasol: "exportar-contasol",
};
