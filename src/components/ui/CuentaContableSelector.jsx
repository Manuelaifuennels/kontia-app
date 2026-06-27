import React, { useState, useMemo, useRef, useEffect } from "react";
import PGC, { PGC_GRUPOS } from "../../constants/pgc";

export default function CuentaContableSelector({ value, onChange, label, filterGrupos }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGrupo, setSelectedGrupo] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const cuentas = useMemo(() => {
    let list = PGC;
    if (filterGrupos) list = list.filter((c) => filterGrupos.includes(c.grupo));
    if (selectedGrupo) list = list.filter((c) => c.grupo === selectedGrupo);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.codigo.includes(q) || c.nombre.toLowerCase().includes(q)
      );
    }
    return list;
  }, [search, selectedGrupo, filterGrupos]);

  const selected = value ? PGC.find((c) => c.codigo === value) : null;
  const displayValue = selected ? `${selected.codigo} - ${selected.nombre}` : "";

  const grupos = filterGrupos
    ? PGC_GRUPOS.filter((g) => filterGrupos.includes(g.grupo))
    : PGC_GRUPOS;

  return (
    <div className="mb-3" ref={ref}>
      {label && (
        <label className="block text-xs text-slate-500 font-medium mb-1">{label}</label>
      )}
      <div className="relative">
        <input
          type="text"
          value={open ? search : displayValue}
          onChange={(e) => { setSearch(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setSearch(""); }}
          placeholder="Buscar cuenta contable..."
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm
            focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500"
        />
        {value && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(""); setSearch(""); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
          >
            &times;
          </button>
        )}

        {open && (
          <div className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-72 overflow-hidden flex flex-col">
            <div className="flex gap-1 p-2 border-b border-slate-100 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedGrupo(null)}
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                  !selectedGrupo ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                }`}
              >
                Todos
              </button>
              {grupos.map((g) => (
                <button
                  key={g.grupo}
                  type="button"
                  onClick={() => setSelectedGrupo(selectedGrupo === g.grupo ? null : g.grupo)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
                    selectedGrupo === g.grupo ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  }`}
                  title={g.nombre}
                >
                  G{g.grupo}
                </button>
              ))}
            </div>
            <div className="overflow-y-auto flex-1">
              {cuentas.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-slate-400">Sin resultados</div>
              )}
              {cuentas.map((c) => {
                const isSubgroup = c.codigo.length === 2;
                return (
                  <button
                    key={c.codigo}
                    type="button"
                    onClick={() => { onChange(c.codigo); setOpen(false); setSearch(""); }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-teal-50 transition-colors flex items-center gap-2 ${
                      value === c.codigo ? "bg-teal-50 text-teal-700" : ""
                    } ${isSubgroup ? "font-semibold text-slate-700 bg-slate-50/50" : "text-slate-600"}`}
                  >
                    <span className="font-mono text-teal-600 w-10 shrink-0">{c.codigo}</span>
                    <span className="truncate">{c.nombre}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
