import React, { useState, useEffect } from "react";
import Field from "../../components/ui/Field";
import Button from "../../components/ui/Button";
import Collapse from "../../components/ui/Collapse";
import Icon from "../../components/ui/Icon";

const CONECTOR_OPTIONS = [
  "CSV Facturas", "A3", "Contaplus", "ContaSol", "Sage 50", "Sage Despachos",
  "Odoo", "Aplifisa", "Glasof", "Goldennet", "Diezsoftware", "Bancos CSV", "Windows",
];

export default function DatosTab({ config, onSave, saving }) {
  const dflt = {
    cif_empresa: "", nombre_empresa: "", tipo_conector: "CSV Facturas", codigo_empresa_csv: "",
    tipo_impuestos: "IVA", digitos_plan: "10", separador_decimal: "Funcionamiento por defecto",
    tolerancia_bases: "0.03", tolerancia_total: "0.05",
    iva_agrario: false, iva_tabaco: false, iva_no_deducible: false,
    id_cartera_proveedores: "", id_cartera_clientes: "",
    pago_automatico: "No", cobro_automatico: "No",
    autorrellenar_vencimiento: false, forzar_mayusculas: false,
    busqueda_aproximada: true, validar_cif: true, ignorar_duplicadas: false,
    total_factura_min: "", total_factura_max: "",
    orden_descripcion: "No. Factura / Tercero",
    chars_excluir_proveedor: "", chars_excluir_cliente: "",
    recortar_num_proveedor: "Mantener todos", recortar_num_cliente: "Mantener todos",
    cuenta_suplidos: "", prefijo_proveedor: "Fra.", prefijo_cliente: "Fra.",
    cuenta_gastos_defecto: "", cuenta_ingresos_defecto: "",
    cambio_signo_rectificativas: true,
  };

  const [form, setForm] = useState({ ...dflt });

  useEffect(() => {
    if (config) setForm({ ...dflt, ...config });
  }, [config]);

  function set(key, val) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4">Datos generales</h3>
          <Field label="CIF de la empresa" value={form.cif_empresa} onChange={(v) => set("cif_empresa", v)} />
          <Field label="Nombre de la empresa" value={form.nombre_empresa} onChange={(v) => set("nombre_empresa", v)} />
          <Field label="Tipo conector" value={form.tipo_conector} onChange={(v) => set("tipo_conector", v)} options={CONECTOR_OPTIONS} />
          <Field label="Código empresa CSV" value={form.codigo_empresa_csv} onChange={(v) => set("codigo_empresa_csv", v)} />
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h3 className="text-sm font-bold mb-4">Impuestos y formato</h3>
          <Field label="Tipo de impuestos" value={form.tipo_impuestos} onChange={(v) => set("tipo_impuestos", v)} options={["IVA", "IGIC", "IVA/IGIC"]} />
          <Field label="Dígitos plan contable" value={form.digitos_plan} onChange={(v) => set("digitos_plan", v)} type="number" />
          <Field label="Separador decimal" value={form.separador_decimal} onChange={(v) => set("separador_decimal", v)} options={["Punto", "Coma", "Funcionamiento por defecto"]} />
          <Field label="Tolerancia bases/cuotas" value={form.tolerancia_bases} onChange={(v) => set("tolerancia_bases", v)} type="number" />
          <Field label="Tolerancia total" value={form.tolerancia_total} onChange={(v) => set("tolerancia_total", v)} type="number" />
        </div>
      </div>

      <Collapse title="Impuestos y retenciones">
        <div className="flex gap-10">
          <Field checkbox label="IVA agrario y pesca" value={!!form.iva_agrario} onChange={(v) => set("iva_agrario", v)} />
          <Field checkbox label="IVA Tabaco" value={!!form.iva_tabaco} onChange={(v) => set("iva_tabaco", v)} />
          <Field checkbox label="IVA/IGIC no deducible" value={!!form.iva_no_deducible} onChange={(v) => set("iva_no_deducible", v)} />
        </div>
      </Collapse>

      <Collapse title="Otras configuraciones">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Id. Cartera proveedores" value={form.id_cartera_proveedores} onChange={(v) => set("id_cartera_proveedores", v)} />
          <div />
          <Field label="Pago Automático" value={form.pago_automatico} onChange={(v) => set("pago_automatico", v)} options={["No", "Sí"]} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Id. Cartera clientes" value={form.id_cartera_clientes} onChange={(v) => set("id_cartera_clientes", v)} />
          <div />
          <Field label="Cobro Automático" value={form.cobro_automatico} onChange={(v) => set("cobro_automatico", v)} options={["No", "Sí"]} />
        </div>
        <div className="grid grid-cols-3 gap-2 my-3">
          <Field checkbox label="Autorrellenar fecha vencimiento" value={!!form.autorrellenar_vencimiento} onChange={(v) => set("autorrellenar_vencimiento", v)} />
          <Field checkbox label="Forzar mayúsculas en asiento" value={!!form.forzar_mayusculas} onChange={(v) => set("forzar_mayusculas", v)} />
          <Field checkbox label="Ignorar duplicadas" value={!!form.ignorar_duplicadas} onChange={(v) => set("ignorar_duplicadas", v)} />
          <Field checkbox label="Búsqueda terceros aproximada" value={!!form.busqueda_aproximada} onChange={(v) => set("busqueda_aproximada", v)} />
          <Field checkbox label="Validar CIF empresa en factura" value={!!form.validar_cif} onChange={(v) => set("validar_cif", v)} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Total factura mínimo" value={form.total_factura_min} onChange={(v) => set("total_factura_min", v)} placeholder="0" />
          <Field label="Total factura máximo" value={form.total_factura_max} onChange={(v) => set("total_factura_max", v)} placeholder="999999" />
          <Field label="Orden Descripción Factura" value={form.orden_descripcion} onChange={(v) => set("orden_descripcion", v)} options={["No. Factura / Tercero", "Tercero / No. Factura", "Solo No. Factura", "Solo Tercero"]} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <Field label="Caracteres a excluir (proveedor)" value={form.chars_excluir_proveedor} onChange={(v) => set("chars_excluir_proveedor", v)} />
          <Field label="Recortar nº factura proveedor" value={form.recortar_num_proveedor} onChange={(v) => set("recortar_num_proveedor", v)} options={["Mantener todos", "Últimos 4", "Últimos 6", "Últimos 8"]} />
          <Field label="Caracteres a excluir (cliente)" value={form.chars_excluir_cliente} onChange={(v) => set("chars_excluir_cliente", v)} />
          <Field label="Recortar nº factura cliente" value={form.recortar_num_cliente} onChange={(v) => set("recortar_num_cliente", v)} options={["Mantener todos", "Últimos 4", "Últimos 6", "Últimos 8"]} />
        </div>
        <div className="grid grid-cols-3 gap-4 mt-2">
          <Field label="Cuenta Suplidos" value={form.cuenta_suplidos} onChange={(v) => set("cuenta_suplidos", v)} />
          <Field label="Prefijo facturas proveedor" value={form.prefijo_proveedor} onChange={(v) => set("prefijo_proveedor", v)} />
          <Field label="Prefijo facturas cliente" value={form.prefijo_cliente} onChange={(v) => set("prefijo_cliente", v)} />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-2">
          <Field label="Cuenta Gastos (si no se detecta proveedor)" value={form.cuenta_gastos_defecto} onChange={(v) => set("cuenta_gastos_defecto", v)} />
          <Field label="Cuenta Ingresos (si no se detecta cliente)" value={form.cuenta_ingresos_defecto} onChange={(v) => set("cuenta_ingresos_defecto", v)} />
        </div>
        <div className="mt-2">
          <Field checkbox label="Cambio de signo automático en facturas rectificativas positivas" value={!!form.cambio_signo_rectificativas} onChange={(v) => set("cambio_signo_rectificativas", v)} />
        </div>
      </Collapse>

      <div className="flex justify-end">
        <Button onClick={() => onSave(form)} disabled={saving}>
          <Icon name="save" size={13} /> {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
