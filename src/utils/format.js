const numberFmt = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmt(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return numberFmt.format(n);
}

export function fmtDate(value) {
  if (!value) return "—";
  const s = value instanceof Date ? value.toISOString() : String(value);
  return s.substring(0, 10);
}

export function fmtCurrency(value) {
  if (value == null || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return `${numberFmt.format(n)} €`;
}
