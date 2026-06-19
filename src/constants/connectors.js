export const CONNECTORS = [
  { id: "csv", name: "CSV Genérico", description: "Exportación configurable", icon: "📄", color: "#0d9488", active: true },
  { id: "a3", name: "A3 / Wolters Kluwer", description: "Fichero .DAT", icon: "📊", color: "#7c3aed", active: true },
  { id: "contaplus", name: "Contaplus", description: "Formato Contaplus", icon: "📁", color: "#d97706", active: true },
  { id: "contasol", name: "ContaSol", description: "Local y nube", icon: "📁", color: "#2563eb", active: true },
  { id: "sage", name: "Sage 50", description: "Conexión BD", icon: "🔗", color: "#059669", active: false },
  { id: "sage_despachos", name: "Sage Despachos", description: "Formato Sage Despachos", icon: "🔗", color: "#059669", active: false },
  { id: "odoo", name: "Odoo", description: "API XML-RPC", icon: "🔗", color: "#7c3aed", active: false },
  { id: "aplifisa", name: "Aplifisa", description: "Formato Aplifisa", icon: "📁", color: "#d97706", active: false },
  { id: "glasof", name: "Glasof", description: "Formato Glasof", icon: "📁", color: "#ea580c", active: false },
  { id: "goldennet", name: "Goldennet", description: "Formato Goldennet", icon: "📁", color: "#2563eb", active: false },
  { id: "diezsoftware", name: "Diezsoftware", description: "Formato Diezsoftware", icon: "📁", color: "#7c3aed", active: false },
  { id: "bancos", name: "Bancos CSV", description: "Importar extracto", icon: "🏦", color: "#ea580c", active: false },
  { id: "windows", name: "Windows (carpeta)", description: "Monitorizar carpeta local", icon: "📂", color: "#64748b", active: false },
];

export const WEBHOOK_MAP = {
  csv: "exportar-csv",
  a3: "exportar-a3",
  contaplus: "exportar-contaplus",
  contasol: "exportar-contasol",
};
