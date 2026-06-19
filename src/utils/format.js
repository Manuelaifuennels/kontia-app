const numberFmt = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmt(value) {
  if (value == null || value === "") return "—";
  return numberFmt.format(Number(value));
}

export function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d)) return "—";
  return d.toISOString().slice(0, 10);
}

export function fmtCurrency(value) {
  if (value == null || value === "") return "—";
  return `${numberFmt.format(Number(value))} €`;
}
