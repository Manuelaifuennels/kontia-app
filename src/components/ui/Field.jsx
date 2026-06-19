import React from "react";

export default function Field({
  label,
  value,
  onChange,
  type = "text",
  options,
  placeholder,
  disabled = false,
  checkbox = false,
}) {
  if (checkbox) {
    return (
      <div className="mb-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="accent-teal-500"
          />
          {label}
        </label>
      </div>
    );
  }

  if (options) {
    return (
      <div className="mb-3">
        {label && (
          <label className="block text-xs text-slate-500 font-medium mb-1">
            {label}
          </label>
        )}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white
            focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => {
            const val = typeof opt === "string" ? opt : opt.value;
            const lbl = typeof opt === "string" ? opt : opt.label;
            return (
              <option key={val} value={val}>
                {lbl}
              </option>
            );
          })}
        </select>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {label && (
        <label className="block text-xs text-slate-500 font-medium mb-1">
          {label}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm
          focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500
          disabled:opacity-50 disabled:cursor-not-allowed"
      />
    </div>
  );
}
