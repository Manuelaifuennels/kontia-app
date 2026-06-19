import React, { useState, useEffect } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import Button from "../../components/ui/Button";
import Field from "../../components/ui/Field";

export default function EmisorTab({ emisor, onReload }) {
  const toast = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const rows = Array.isArray(emisor) ? emisor : emisor?.list || [];
  const record = rows[0] || {};

  useEffect(() => {
    setForm({ ...record });
  }, [emisor]);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.Id) {
        await api.updateRecord("emisor", form);
      } else {
        await api.createRecord("emisor", form);
      }
      toast("Datos del emisor guardados", "success");
      onReload();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Datos del emisor</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Field label="Nombre fiscal" value={form.nombre_fiscal || ""} onChange={(v) => set("nombre_fiscal", v)} />
          <Field label="CIF emisor" value={form.cif_emisor || ""} onChange={(v) => set("cif_emisor", v)} />
          <Field label="Direccion" value={form.direccion || ""} onChange={(v) => set("direccion", v)} />
          <Field label="Codigo postal" value={form.codigo_postal || ""} onChange={(v) => set("codigo_postal", v)} />
          <Field label="Ciudad" value={form.ciudad || ""} onChange={(v) => set("ciudad", v)} />
          <Field label="Provincia" value={form.provincia || ""} onChange={(v) => set("provincia", v)} />
          <Field label="Email facturacion" value={form.email_facturacion || ""} onChange={(v) => set("email_facturacion", v)} type="email" />
          <Field label="Telefono" value={form.telefono || ""} onChange={(v) => set("telefono", v)} />
          <Field label="Serie facturacion" value={form.serie_facturacion || ""} onChange={(v) => set("serie_facturacion", v)} />
          <Field label="Ultimo numero" value={form.ultimo_numero || ""} onChange={(v) => set("ultimo_numero", v)} type="number" />
          <Field label="URL logo" value={form.url_logo || ""} onChange={(v) => set("url_logo", v)} />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Opciones envio automatico</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Field label="Auto contabilidad" value={!!form.auto_contabilidad} onChange={(v) => set("auto_contabilidad", v)} checkbox />
          <Field label="Auto FACe" value={!!form.auto_face} onChange={(v) => set("auto_face", v)} checkbox />
          <Field label="Auto FACeB2B" value={!!form.auto_faceb2b} onChange={(v) => set("auto_faceb2b", v)} checkbox />
          <Field label="Auto email" value={!!form.auto_email} onChange={(v) => set("auto_email", v)} checkbox />
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Bloqueos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Field label="Bloquear FACe" value={!!form.bloq_face} onChange={(v) => set("bloq_face", v)} checkbox />
          <Field label="Bloquear FACeB2B" value={!!form.bloq_faceb2b} onChange={(v) => set("bloq_faceb2b", v)} checkbox />
          <Field label="Bloquear contabilidad" value={!!form.bloq_contabilidad} onChange={(v) => set("bloq_contabilidad", v)} checkbox />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar emisor"}
        </Button>
      </div>
    </form>
  );
}
