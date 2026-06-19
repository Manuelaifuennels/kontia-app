import React, { useState, useEffect } from "react";
import Field from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Collapse from "../../components/ui/Collapse";

const CONECTOR_OPTIONS = [
  "A3", "Sage", "Contaplus", "Holded", "Anfix", "Billin", "Contasol",
  "Debitoor", "Factorial", "Quipu", "Reviso", "Sap", "Otro",
];

const IMPUESTO_OPTIONS = [
  { value: "IVA", label: "IVA" },
  { value: "IGIC", label: "IGIC" },
  { value: "IVA+IGIC", label: "IVA + IGIC" },
];

export default function DatosTab({ config, onSave, saving }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (config) setForm({ ...config });
  }, [config]);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="space-y-6"
    >
      {/* Two-column cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Datos generales</h3>
          <Field label="CIF empresa" value={form.cif_empresa || ""} onChange={(v) => set("cif_empresa", v)} />
          <Field label="Nombre empresa" value={form.nombre_empresa || ""} onChange={(v) => set("nombre_empresa", v)} />
          <Field
            label="Tipo conector"
            value={form.tipo_conector || ""}
            onChange={(v) => set("tipo_conector", v)}
            options={CONECTOR_OPTIONS}
            placeholder="Seleccionar conector"
          />
          <Field label="Codigo empresa CSV" value={form.codigo_empresa_csv || ""} onChange={(v) => set("codigo_empresa_csv", v)} />
        </div>

        {/* Right card */}
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Impuestos y formato</h3>
          <Field
            label="Tipo impuestos"
            value={form.tipo_impuestos || ""}
            onChange={(v) => set("tipo_impuestos", v)}
            options={IMPUESTO_OPTIONS}
            placeholder="Seleccionar"
          />
          <Field label="Digitos plan contable" value={form.digitos_plan || ""} onChange={(v) => set("digitos_plan", v)} type="number" />
          <Field
            label="Separador decimal"
            value={form.separador_decimal || ""}
            onChange={(v) => set("separador_decimal", v)}
            options={[",", "."]}
          />
          <Field label="Tolerancia bases/cuotas" value={form.tolerancia_bases || ""} onChange={(v) => set("tolerancia_bases", v)} type="number" />
          <Field label="Tolerancia total" value={form.tolerancia_total || ""} onChange={(v) => set("tolerancia_total", v)} type="number" />
        </div>
      </div>

      {/* Collapsible: Impuestos y retenciones */}
      <Collapse title="Impuestos y retenciones">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6">
          <Field label="IVA agrario" value={!!form.iva_agrario} onChange={(v) => set("iva_agrario", v)} checkbox />
          <Field label="IVA Tabaco" value={!!form.iva_tabaco} onChange={(v) => set("iva_tabaco", v)} checkbox />
          <Field label="IVA/IGIC no deducible" value={!!form.iva_no_deducible} onChange={(v) => set("iva_no_deducible", v)} checkbox />
        </div>
      </Collapse>

      {/* Collapsible: Otras configuraciones */}
      <Collapse title="Otras configuraciones">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Field label="Id. Cartera proveedores" value={form.id_cartera_proveedores || ""} onChange={(v) => set("id_cartera_proveedores", v)} />
          <Field label="Id. Cartera clientes" value={form.id_cartera_clientes || ""} onChange={(v) => set("id_cartera_clientes", v)} />
          <Field
            label="Pago automatico"
            value={form.pago_automatico || ""}
            onChange={(v) => set("pago_automatico", v)}
            options={[{ value: "si", label: "Si" }, { value: "no", label: "No" }]}
          />
          <Field
            label="Cobro automatico"
            value={form.cobro_automatico || ""}
            onChange={(v) => set("cobro_automatico", v)}
            options={[{ value: "si", label: "Si" }, { value: "no", label: "No" }]}
          />
          <Field label="Autorrellenar vencimiento" value={!!form.autorrellenar_vencimiento} onChange={(v) => set("autorrellenar_vencimiento", v)} checkbox />
          <Field label="Forzar mayusculas" value={!!form.forzar_mayusculas} onChange={(v) => set("forzar_mayusculas", v)} checkbox />
          <Field label="Ignorar duplicadas" value={!!form.ignorar_duplicadas} onChange={(v) => set("ignorar_duplicadas", v)} checkbox />
          <Field label="Busqueda aproximada" value={!!form.busqueda_aproximada} onChange={(v) => set("busqueda_aproximada", v)} checkbox />
          <Field label="Validar CIF" value={!!form.validar_cif} onChange={(v) => set("validar_cif", v)} checkbox />
          <Field label="Total factura minimo" value={form.total_factura_min || ""} onChange={(v) => set("total_factura_min", v)} type="number" />
          <Field label="Total factura maximo" value={form.total_factura_max || ""} onChange={(v) => set("total_factura_max", v)} type="number" />
          <Field
            label="Orden descripcion factura"
            value={form.orden_descripcion || ""}
            onChange={(v) => set("orden_descripcion", v)}
            options={["ascendente", "descendente"]}
          />
          <Field label="Caracteres a excluir proveedor" value={form.chars_excluir_proveedor || ""} onChange={(v) => set("chars_excluir_proveedor", v)} />
          <Field label="Caracteres a excluir cliente" value={form.chars_excluir_cliente || ""} onChange={(v) => set("chars_excluir_cliente", v)} />
          <Field label="Recortar n factura proveedor" value={form.recortar_nfact_proveedor || ""} onChange={(v) => set("recortar_nfact_proveedor", v)} type="number" />
          <Field label="Recortar n factura cliente" value={form.recortar_nfact_cliente || ""} onChange={(v) => set("recortar_nfact_cliente", v)} type="number" />
          <Field label="Cuenta suplidos" value={form.cuenta_suplidos || ""} onChange={(v) => set("cuenta_suplidos", v)} />
          <Field label="Prefijo proveedores" value={form.prefijo_proveedores || ""} onChange={(v) => set("prefijo_proveedores", v)} />
          <Field label="Prefijo clientes" value={form.prefijo_clientes || ""} onChange={(v) => set("prefijo_clientes", v)} />
          <Field label="Cuenta por defecto gastos" value={form.cuenta_defecto_gastos || ""} onChange={(v) => set("cuenta_defecto_gastos", v)} />
          <Field label="Cuenta por defecto ingresos" value={form.cuenta_defecto_ingresos || ""} onChange={(v) => set("cuenta_defecto_ingresos", v)} />
          <Field label="Cambio signo rectificativas" value={!!form.cambio_signo_rectificativas} onChange={(v) => set("cambio_signo_rectificativas", v)} checkbox />
        </div>
      </Collapse>

      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? "Guardando..." : "Guardar configuracion"}
        </Button>
      </div>
    </form>
  );
}
