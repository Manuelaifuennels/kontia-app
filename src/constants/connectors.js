export const CONNECTORS = [
  { id: "csv", name: "CSV Genérico", description: "Exportación configurable", icon: "📄", color: "#0d9488", active: true },
  { id: "a3", name: "A3 / Wolters Kluwer", description: "Fichero .DAT", icon: "📊", color: "#7c3aed", active: true },
  { id: "contaplus", name: "Contaplus", description: "Formato Contaplus", icon: "📁", color: "#d97706", active: true },
  { id: "contasol", name: "ContaSol", description: "Local y nube", icon: "📁", color: "#2563eb", active: true },
  { id: "sage", name: "Sage 50", description: "CSV importación asientos", icon: "🔗", color: "#059669", active: true },
  { id: "sage_despachos", name: "Sage Despachos", description: "Enlace contable", icon: "🔗", color: "#059669", active: true },
  { id: "aplifisa", name: "Aplifisa", description: "CSV asientos", icon: "📁", color: "#d97706", active: true },
  { id: "glasof", name: "Glasof", description: "CSV asientos", icon: "📁", color: "#ea580c", active: true },
  { id: "goldennet", name: "Goldennet", description: "CSV asientos", icon: "📁", color: "#2563eb", active: true },
  { id: "diezsoftware", name: "Diezsoftware", description: "CSV asientos", icon: "📁", color: "#7c3aed", active: true },
  { id: "odoo", name: "Odoo", description: "API XML-RPC — requiere credenciales", icon: "🔗", color: "#7c3aed", active: false },
  { id: "bancos", name: "Bancos CSV", description: "Usa la página Conciliación", icon: "🏦", color: "#ea580c", active: false },
  { id: "windows", name: "Windows (carpeta)", description: "Monitorizar carpeta local", icon: "📂", color: "#64748b", active: false },
];

export const WEBHOOK_MAP = {
  csv: "exportar-csv",
  a3: "exportar-a3",
  contaplus: "exportar-contaplus",
  contasol: "exportar-contasol",
  sage: "exportar-sage50",
  sage_despachos: "exportar-sagedespachos",
  aplifisa: "exportar-aplifisa",
  glasof: "exportar-glasof",
  goldennet: "exportar-goldennet",
  diezsoftware: "exportar-diezsoftware",
};
