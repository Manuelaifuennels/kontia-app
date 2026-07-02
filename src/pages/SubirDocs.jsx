import React, { useState, useRef } from "react";
import api from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../components/ui/Toast";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Field from "../components/ui/Field";

const ACCEPTED = ".pdf,.jpg,.jpeg,.png,.zip,.rar,.7z";

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SubirDocs({ onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [tipo, setTipo] = useState("compra");
  const [fechaMode, setFechaMode] = useState("fecha_factura");
  const [fechaCustom, setFechaCustom] = useState("");
  const [separarPdf, setSepararPdf] = useState(false);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState([]);

  function addFiles(fileList) {
    setFiles([...fileList]);
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploading(true);
    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress((p) => [...p, `Procesando ${file.name}...`]);
      try {
        const b64 = await readFileAsBase64(file);
        const esPdf = /\.pdf$/i.test(file.name);
        // separar-pdf es un workflow n8n distinto: trocea el PDF y encola cada página
        const endpoint = separarPdf && esPdf ? "separar-pdf" : "procesar-factura";
        await api.webhook(endpoint, {
          archivo_base64: b64,
          nombre_archivo: file.name,
          media_type: file.type,
          empresa_id: user.empresa_id,
          tipo_documento: tipo,
          fecha_contable: fechaMode === "hoy"
            ? new Date().toISOString().split("T")[0]
            : fechaMode === "configurable" ? (fechaCustom || null) : null,
          empresa_carpeta: String(user.empresa_id),
        });
        results.push({ file: file.name, ok: true });
      } catch (e) {
        results.push({ file: file.name, ok: false, err: e.message });
        setProgress((p) => [...p, `❌ ${file.name}: ${e.message}`]);
      }
    }

    const ok = results.filter((r) => r.ok).length;
    if (ok === files.length) {
      toast(`${ok}/${files.length} facturas enviadas a procesar`, "success");
      setTimeout(onBack, 1500);
    } else {
      toast(`${ok}/${files.length} enviadas — ${files.length - ok} con error`, ok > 0 ? "warning" : "error");
    }
    setUploading(false);
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-5">
        <Button variant="ghost" onClick={onBack}>
          <Icon name="undo" size={16} /> Volver a Contabilidad
        </Button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl p-8">
        <div className="text-center mb-6">
          <Icon name="upload" size={40} className="text-teal-600 mx-auto mb-2" />
          <h2 className="text-xl font-bold text-teal-600 mb-1">Subir documentos</h2>
          <p className="text-sm text-slate-500">Sube tus facturas en PDF, JPG, PNG o ZIP</p>
        </div>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed border-teal-300 rounded-xl p-10 text-center cursor-pointer mb-5 bg-teal-50/30 hover:bg-teal-50/60 transition-colors"
        >
          <div className="text-sm text-slate-500">
            {files.length ? `${files.length} archivo(s) seleccionado(s)` : "Arrastre aquí o haga click"}
          </div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPTED}
            onChange={(e) => addFiles(e.target.files)}
            className="hidden"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <Field
            label="Tipo de documento"
            value={tipo}
            onChange={setTipo}
            options={[
              { value: "compra", label: "Factura de proveedor" },
              { value: "venta", label: "Factura de cliente" },
            ]}
          />
          <Field
            label="Fecha contable"
            value={fechaMode}
            onChange={setFechaMode}
            options={[
              { value: "fecha_factura", label: "Fecha de factura" },
              { value: "hoy", label: "Hoy" },
              { value: "configurable", label: "Fecha configurable" },
            ]}
          />
        </div>
        {fechaMode === "configurable" && (
          <Field label="Fecha personalizada" type="date" value={fechaCustom} onChange={setFechaCustom} />
        )}
        <Field checkbox label="Separar páginas del PDF (cada página = 1 factura)" value={separarPdf} onChange={setSepararPdf} />

        {progress.length > 0 && (
          <div className="my-4 text-xs text-slate-500 space-y-1">
            {progress.map((p, i) => <div key={i}>{p}</div>)}
          </div>
        )}

        <div className="text-center mt-5">
          <Button onClick={handleUpload} disabled={!files.length || uploading} size="lg">
            {uploading ? "Procesando..." : "Subir documentos"}
          </Button>
        </div>
      </div>
    </div>
  );
}
