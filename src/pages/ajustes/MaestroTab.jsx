import React, { useState, useMemo } from "react";
import api from "../../api/client";
import { useToast } from "../../components/ui/Toast";
import PGC, { PGC_GRUPOS } from "../../constants/pgc";
import Button from "../../components/ui/Button";
import Icon from "../../components/ui/Icon";
import Modal from "../../components/ui/Modal";
import Field from "../../components/ui/Field";

const TIPO_COLORS = {
  gasto: "bg-indigo-100 text-indigo-700",
  ingreso: "bg-green-100 text-green-700",
  iva: "bg-yellow-100 text-yellow-700",
  tercero: "bg-gray-100 text-gray-600",
  activo: "bg-sky-100 text-sky-700",
  pasivo: "bg-rose-100 text-rose-700",
  patrimonio: "bg-amber-100 text-amber-700",
};

export default function MaestroTab({ maestro, onReload }) {
  const toast = useToast();
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ subcuenta: "", descripcion: "", tipo: "gasto" });
  const [deleting, setDeleting] = useState(null);

  const customRows = useMemo(() => {
    const list = Array.isArray(maestro) ? maestro : maestro?.list || [];
    return list.map((m) => ({
      ...m,
      codigo: String(m.subcuenta || ""),
      nombre: m.descripcion || "",
      grupo: parseInt(String(m.subcuenta || "0")[0], 10) || 0,
      isCustom: true,
    }));
  }, [maestro]);

  const allAccounts = useMemo(() => {
    let pgc = selectedGrupo ? PGC.filter((c) => c.grupo === selectedGrupo) : PGC;
    let custom = selectedGrupo
      ? customRows.filter((c) => c.grupo === selectedGrupo)
      : customRows;

    const merged = [
      ...pgc.map((c) => ({ ...c, isCustom: false })),
      ...custom,
    ].sort((a, b) => a.codigo.localeCompare(b.codigo));

    if (search) {
      const q = search.toLowerCase();
      return merged.filter(
        (c) => c.codigo.includes(q) || c.nombre.toLowerCase().includes(q)
      );
    }
    return merged;
  }, [selectedGrupo, search, customRows]);

  const stats = useMemo(() => {
    const total = customRows.length;
    const byGrupo = {};
    customRows.forEach((c) => { byGrupo[c.grupo] = (byGrupo[c.grupo] || 0) + 1; });
    return { total, byGrupo };
  }, [customRows]);

  function openAdd(parentCodigo) {
    setForm({
      subcuenta: parentCodigo ? parentCodigo + "0" : "",
      descripcion: "",
      tipo: parentCodigo?.[0] === "6" ? "gasto" : parentCodigo?.[0] === "7" ? "ingreso" : parentCodigo?.[0] === "4" ? "tercero" : "gasto",
    });
    setEditItem(null);
    setShowAdd(true);
  }

  function openEdit(item) {
    setForm({ subcuenta: String(item.subcuenta || ""), descripcion: item.descripcion || "", tipo: item.tipo || "gasto" });
    setEditItem(item);
    setShowAdd(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.subcuenta || !form.descripcion) {
      return toast("Subcuenta y descripción obligatorios", "warning");
    }
    try {
      if (editItem) {
        await api.updateRecord("maestro", { Id: editItem.Id, subcuenta: form.subcuenta, descripcion: form.descripcion, tipo: form.tipo });
        toast("Cuenta actualizada", "success");
      } else {
        await api.createRecord("maestro", form);
        toast("Cuenta creada", "success");
      }
      setShowAdd(false);
      onReload();
      window.dispatchEvent(new Event("maestro-updated"));
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api.deleteRecord("maestro", deleting.Id);
      toast("Cuenta eliminada", "success");
      setDeleting(null);
      onReload();
      window.dispatchEvent(new Event("maestro-updated"));
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">Plan General Contable</h3>
          <p className="text-xs text-slate-400 mt-0.5">{PGC.length} cuentas PGC + {stats.total} subcuentas personalizadas</p>
        </div>
        <Button size="sm" onClick={() => openAdd("")}>
          <Icon name="plus" size={16} /> Subcuenta
        </Button>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        <button
          onClick={() => setSelectedGrupo(null)}
          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
            !selectedGrupo ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
          }`}
        >
          Todos
        </button>
        {PGC_GRUPOS.map((g) => (
          <button
            key={g.grupo}
            onClick={() => setSelectedGrupo(selectedGrupo === g.grupo ? null : g.grupo)}
            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
              selectedGrupo === g.grupo ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
            title={g.nombre}
          >
            G{g.grupo} {stats.byGrupo[g.grupo] ? <span className="ml-0.5 opacity-60">({stats.byGrupo[g.grupo]})</span> : ""}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código o nombre..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
        />
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[60vh] overflow-y-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead className="sticky top-0 bg-white z-10">
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 w-28">Código</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Nombre</th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 w-20">Tipo</th>
              <th className="px-3 py-2.5 w-24" />
            </tr>
          </thead>
          <tbody>
            {allAccounts.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Sin resultados</td></tr>
            )}
            {allAccounts.map((c, i) => {
              const isGroup = c.codigo.length === 2;
              const isSubgroup = c.codigo.length === 3 && !c.isCustom;
              const indent = c.isCustom ? Math.max(0, c.codigo.length - 3) * 12 : (c.codigo.length - 2) * 12;

              return (
                <tr
                  key={`${c.codigo}-${c.isCustom ? "c" : "p"}-${i}`}
                  className={`border-b border-slate-100 transition-colors ${
                    c.isCustom
                      ? "bg-teal-50/40 hover:bg-teal-50"
                      : isGroup
                        ? "bg-slate-50/80"
                        : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-3 py-2" style={{ paddingLeft: `${12 + indent}px` }}>
                    <span className={`font-mono ${c.isCustom ? "text-teal-700 font-semibold" : isGroup ? "text-slate-800 font-bold" : "text-slate-600"}`}>
                      {c.codigo}
                    </span>
                  </td>
                  <td className={`px-3 py-2 ${isGroup ? "font-semibold text-slate-800" : isSubgroup ? "font-medium text-slate-700" : "text-slate-600"}`}>
                    {c.nombre}
                    {c.isCustom && <span className="ml-2 text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">personalizada</span>}
                  </td>
                  <td className="px-3 py-2">
                    {c.isCustom && c.tipo && (
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${TIPO_COLORS[c.tipo] || TIPO_COLORS.tercero}`}>
                        {c.tipo}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {c.isCustom ? (
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(c)} className="text-slate-400 hover:text-teal-600 p-1" title="Editar">
                          <Icon name="edit" size={13} />
                        </button>
                        <button onClick={() => setDeleting(c)} className="text-slate-400 hover:text-red-500 p-1" title="Eliminar">
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    ) : c.codigo.length >= 3 ? (
                      <button
                        onClick={() => openAdd(c.codigo)}
                        className="text-slate-300 hover:text-teal-600 p-1"
                        title={`Subcuenta de ${c.codigo}`}
                      >
                        <Icon name="plus" size={13} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editItem ? "Editar subcuenta" : "Nueva subcuenta"} width="max-w-md">
        <form onSubmit={handleSave} className="space-y-1">
          <Field label="Código subcuenta" value={form.subcuenta} onChange={(v) => setForm({ ...form, subcuenta: v })} placeholder="6290001" />
          <Field label="Descripción" value={form.descripcion} onChange={(v) => setForm({ ...form, descripcion: v })} placeholder="Servicios profesionales ABC S.L." />
          <Field
            label="Tipo"
            value={form.tipo}
            onChange={(v) => setForm({ ...form, tipo: v })}
            options={[
              { value: "gasto", label: "Gasto" },
              { value: "ingreso", label: "Ingreso" },
              { value: "iva", label: "IVA" },
              { value: "tercero", label: "Tercero" },
              { value: "activo", label: "Activo" },
              { value: "pasivo", label: "Pasivo" },
              { value: "patrimonio", label: "Patrimonio" },
            ]}
          />
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)} type="button">Cancelar</Button>
            <Button size="sm" type="submit">{editItem ? "Guardar" : "Crear"}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title="Eliminar subcuenta" width="max-w-sm">
        <p className="text-sm text-slate-600 mb-4">
          ¿Eliminar <span className="font-mono font-semibold">{deleting?.subcuenta}</span> — {deleting?.descripcion}?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setDeleting(null)}>Cancelar</Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Eliminar</Button>
        </div>
      </Modal>
    </div>
  );
}
