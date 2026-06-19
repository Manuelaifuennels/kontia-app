import React from "react";

const STATUS_MAP = {
  contabilizada: { label: "Contabilizada", classes: "bg-green-100 text-green-700" },
  completada: { label: "Contabilizada", classes: "bg-green-100 text-green-700" },
  pendiente: { label: "Pendiente", classes: "bg-yellow-100 text-yellow-700" },
  revision: { label: "Revisión", classes: "bg-yellow-100 text-yellow-700" },
  error: { label: "Error", classes: "bg-red-100 text-red-700" },
  en_proceso: { label: "Procesando", classes: "bg-purple-100 text-purple-700" },
  procesando: { label: "Procesando", classes: "bg-purple-100 text-purple-700" },
  contabilizando: { label: "Contabilizando", classes: "bg-blue-100 text-blue-700" },
};

const DEFAULT = { label: "", classes: "bg-gray-100 text-gray-600" };

export default function StatusBadge({ status }) {
  const { label, classes } = STATUS_MAP[status] || { ...DEFAULT, label: status || "—" };

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}
