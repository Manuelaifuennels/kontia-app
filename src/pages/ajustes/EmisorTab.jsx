import React, { useState, useEffect } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Field from "../../components/ui/Field";

export default function EmisorTab({ emisor, onReload }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nombre_fiscal: "", cif_emisor: "", direccion: "", codigo_postal: "", ciudad: "", provincia: "",
    email_facturacion: "", telefono: "", serie_facturacion: "", ultimo_numero: "", url_logo: "",
    auto_contabilidad: false, auto_face: false, auto_faceb2b: false, auto_email: false,
    bloq_face: false, bloq_faceb2b: false, bloq_contabilidad: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (emisor) setForm((p) => ({ ...p, ...emisor }));
  }, [emisor]);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = { ...form };
      delete data.nc_order;
      if (form.Id) {
        await api.updateRecord("emisor", data);
      } else {
        await api.createRecord("emisor", data);
      }
      toast("Emisor guardado", "success");
      onReload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-bold">Datos del emisor de facturas</h3>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Icon name="save" size={13} /> {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Nombre fiscal" value={form.nombre_fiscal || ""} onChange={(v) => set("nombre_fiscal", v)} />
        <Field label="CIF emisor" value={form.cif_emisor || ""} onChange={(v) => set("cif_emisor", v)} />
        <Field label="Dirección" value={form.direccion || ""} onChange={(v) => set("direccion", v)} />
        <Field label="Código postal" value={form.codigo_postal || ""} onChange={(v) => set("codigo_postal", v)} />
        <Field label="Ciudad" value={form.ciudad || ""} onChange={(v) => set("ciudad", v)} />
        <Field label="Provincia" value={form.provincia || ""} onChange={(v) => set("provincia", v)} />
        <Field label="Email facturación" value={form.email_facturacion || ""} onChange={(v) => set("email_facturacion", v)} />
        <Field label="Teléfono" value={form.telefono || ""} onChange={(v) => set("telefono", v)} />
        <Field label="Serie facturación" value={form.serie_facturacion || ""} onChange={(v) => set("serie_facturacion", v)} />
        <Field label="Último número emitido" value={form.ultimo_numero || ""} onChange={(v) => set("ultimo_numero", v)} />
        <Field label="URL Logo" value={form.url_logo || ""} onChange={(v) => set("url_logo", v)} />
      </div>

      <div className="border-t border-slate-200 mt-4 pt-4">
        <h4 className="text-xs font-semibold text-slate-500 mb-3">Opciones envío automático</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field checkbox label="Enviar facturas a contabilidad" value={!!form.auto_contabilidad} onChange={(v) => set("auto_contabilidad", v)} />
          <Field checkbox label="Envío automático a FACe" value={!!form.auto_face} onChange={(v) => set("auto_face", v)} />
          <Field checkbox label="Envío automático a FACEB2B" value={!!form.auto_faceb2b} onChange={(v) => set("auto_faceb2b", v)} />
          <Field checkbox label="Envío por email al cliente" value={!!form.auto_email} onChange={(v) => set("auto_email", v)} />
        </div>

        <h4 className="text-xs font-semibold text-slate-500 mt-3 mb-3">Bloqueos</h4>
        <div className="grid grid-cols-2 gap-2">
          <Field checkbox label="Bloquear envío a FACe" value={!!form.bloq_face} onChange={(v) => set("bloq_face", v)} />
          <Field checkbox label="Bloquear envío a FACEB2B" value={!!form.bloq_faceb2b} onChange={(v) => set("bloq_faceb2b", v)} />
          <Field checkbox label="Bloquear envío a contabilidad" value={!!form.bloq_contabilidad} onChange={(v) => set("bloq_contabilidad", v)} />
        </div>
      </div>
    </div>
  );
}
