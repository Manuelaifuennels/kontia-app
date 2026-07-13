import crypto from 'crypto';

// Cálculo de huella según Orden HAC/1177/2024 (anexo, apartado de huella o hash):
// cadena de campos "Campo=valor" unidos por "&", SHA-256, hexadecimal en mayúsculas.
// IMPORTANTE: antes de operar en modo VeriFactu real contra la AEAT, validar las
// huellas generadas con el servicio de validación de la Agencia Tributaria.

const QR_BASE = 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR';

function sha256Upper(cadena) {
  return crypto.createHash('sha256').update(cadena, 'utf8').digest('hex').toUpperCase();
}

// dd-mm-yyyy exigido por la especificación para FechaExpedicionFactura
export function fechaAeat(isoDate) {
  const s = String(isoDate).substring(0, 10);
  const [y, m, d] = s.split('-');
  return `${d}-${m}-${y}`;
}

function importeAeat(n) {
  return (Number(n) || 0).toFixed(2);
}

export function huellaAlta({ nifEmisor, numSerie, fechaExpedicion, tipoFactura, cuotaTotal, importeTotal, huellaAnterior, fechaHoraGen }) {
  const cadena =
    `IDEmisorFactura=${nifEmisor}` +
    `&NumSerieFactura=${numSerie}` +
    `&FechaExpedicionFactura=${fechaAeat(fechaExpedicion)}` +
    `&TipoFactura=${tipoFactura}` +
    `&CuotaTotal=${importeAeat(cuotaTotal)}` +
    `&ImporteTotal=${importeAeat(importeTotal)}` +
    `&Huella=${huellaAnterior || ''}` +
    `&FechaHoraHusoGenRegistro=${fechaHoraGen}`;
  return sha256Upper(cadena);
}

export function huellaAnulacion({ nifEmisor, numSerie, fechaExpedicion, huellaAnterior, fechaHoraGen }) {
  const cadena =
    `IDEmisorFacturaAnulada=${nifEmisor}` +
    `&NumSerieFacturaAnulada=${numSerie}` +
    `&FechaExpedicionFacturaAnulada=${fechaAeat(fechaExpedicion)}` +
    `&Huella=${huellaAnterior || ''}` +
    `&FechaHoraHusoGenRegistro=${fechaHoraGen}`;
  return sha256Upper(cadena);
}

// URL de cotejo del QR tributario (art. 21 RD 1007/2023)
export function qrUrl({ nifEmisor, numSerie, fechaExpedicion, importeTotal }) {
  const params = new URLSearchParams({
    nif: nifEmisor,
    numserie: numSerie,
    fecha: fechaAeat(fechaExpedicion),
    importe: importeAeat(importeTotal),
  });
  return `${QR_BASE}?${params.toString()}`;
}

// Fecha-hora con huso horario (ISO 8601 con offset, ej. 2026-07-03T12:34:56+02:00).
// Anclada a Europe/Madrid con independencia del TZ del contenedor: la cadena
// generada aquí es la que entra en la huella y la que se persiste tal cual —
// si dependiera del TZ del host, las huellas dejarían de ser re-verificables.
export function fechaHoraHuso(date = new Date()) {
  const fecha = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(date); // "2026-07-03 12:34:56"
  const tzPart = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    timeZoneName: 'longOffset',
  }).formatToParts(date).find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
  const offset = tzPart.replace('GMT', '') || '+00:00';
  return `${fecha.replace(' ', 'T')}${offset}`;
}
