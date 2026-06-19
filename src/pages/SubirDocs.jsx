import React, { useState, useRef } from "react";
import api from "../api/client";
import { useToast } from "../components/ui/Toast";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Field from "../components/ui/Field";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.zip";

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SubirDocs({ onBack }) {
  const toast = useToast();
  const fileRef = useRef(null);

  const [tipo, setTipo] = useState("compra");
  const [fechaMode, setFechaMode] = useState("fecha_factura");
  const [fechaCustom, setFechaCustom] = useState("");
  const [separarPdf, setSepararPdf] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList) {
    const arr = Array.from(fileList).filter((f) => {
      const ext = f.name.split(".").pop().toLowerCase();
      return ["pdf", "jpg", "jpeg", "png", "zip"].includes(ext);
    });
    setFiles((prev) => [...prev, ...arr]);
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    if (files.length === 0) {
      toast("Selecciona al menos un archivo", "warning");
      return;
    }

    setUploading(true);
    setProgress({ current: 0, total: files.length });

    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      setProgress({ current: i + 1, total: files.length });
      try {
        const base64 = await readFileAsBase64(files[i]);
        const fecha =
          fechaMode === "hoy"
            ? new Date().toISOString().slice(0, 10)
            : fechaMode === "configurable"
            ? fechaCustom
            : null;

        await api.webhook("procesar-factura", {
          archivo: base64,
          nombre_archivo: files[i].name,
          tipo_documento: tipo,
          fecha_factura: fecha,
          separar_paginas: separarPdf,
        });
        successCount++;
      } catch (err) {
        toast(`Error al subir ${files[i].name}: ${err.message}`, "error");
      }
    }

    setUploading(false);
    if (successCount > 0) {
      toast(`${successCount} archivo(s) procesados correctamente`, "success");
      setTimeout(() => onBack(), 1200);
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-6">
        <Icon name="undo" size={16} /> Volver a contabilidad
      </button>

      <h1 className="text-xl font-bold text-slate-800 mb-6">Subir documentos</h1>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Field
          label="Tipo de documento"
          value={tipo}
          onChange={setTipo}
          options={[
            { value: "compra", label: "Factura de compra" },
            { value: "venta", label: "Factura de venta" },
          ]}
        />
        <Field
          label="Fecha de la factura"
          value={fechaMode}
          onChange={setFechaMode}
          options={[
            { value: "fecha_factura", label: "Extraer del documento" },
            { value: "hoy", label: "Fecha de hoy" },
            { value: "configurable", label: "Fecha personalizada" },
          ]}
        />
      </div>

      {fechaMode === "configurable" && (
        <div className="mb-4">
          <Field label="Fecha" type="date" value={fechaCustom} onChange={setFechaCustom} />
        </div>
      )}

      <Field label="Separar páginas del PDF" checkbox value={separarPdf} onChange={setSepararPdf} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors mb-6 ${
          dragOver
            ? "border-teal-400 bg-teal-50"
            : "border-slate-300 hover:border-slate-400 bg-slate-50"
        }`}
      >
        <Icon name="upload" size={32} className="mx-auto text-slate-400 mb-3" />
        <p className="text-sm text-slate-600 font-medium">
          Arrastra archivos o haz clic para seleccionar
        </p>
        <p className="text-xs text-slate-400 mt-1">PDF, JPG, PNG, ZIP</p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="mb-6 space-y-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-4 py-2">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Icon name="file" size={16} className="text-slate-400" />
                {f.name}
                <span className="text-xs text-slate-400">({(f.size / 1024).toFixed(0)} KB)</span>
              </div>
              <button onClick={() => removeFile(i)} className="text-slate-400 hover:text-red-500 transition-colors">
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      {uploading && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
            <span>Procesando archivos...</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2">
            <div
              className="bg-teal-500 h-2 rounded-full transition-all"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      <Button onClick={handleUpload} disabled={uploading || files.length === 0} size="lg" className="w-full justify-center">
        {uploading ? "Procesando..." : `Subir ${files.length} archivo(s)`}
      </Button>
    </div>
  );
}
