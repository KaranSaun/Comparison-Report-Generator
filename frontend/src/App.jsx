import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, AlertCircle, X, ArrowRight } from "lucide-react";

import HeaderBar from "./components/HeaderBar.jsx";
import UploadDropzone from "./components/UploadDropzone.jsx";
import ProcessingTiles from "./components/ProcessingTiles.jsx";
import MetricsCards from "./components/MetricsCards.jsx";
import DownloadPanel from "./components/DownloadPanel.jsx";
import AuditLogsPanel from "./components/AuditLogsPanel.jsx";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const WCS_REQUIRED = ["Carton Barcode", "Item", "PutQty"];
const WMS_REQUIRED = ["ID", "SKU", "Qty"];

const INITIAL_STEPS = [
  { key: "File Validation",         title: "File Validation",         status: "pending", message: "", ts: null },
  { key: "Data Cleaning",           title: "Data Cleaning",           status: "pending", message: "", ts: null },
  { key: "ID Concatenation",        title: "ID Concatenation",        status: "pending", message: "", ts: null },
  { key: "Duplicate Detection",     title: "Duplicate Detection",     status: "pending", message: "", ts: null },
  { key: "Quantity Aggregation",    title: "Quantity Aggregation",    status: "pending", message: "", ts: null },
  { key: "Record Matching",         title: "Record Matching",         status: "pending", message: "", ts: null },
  { key: "Mismatch Analysis",       title: "Mismatch Analysis",       status: "pending", message: "", ts: null },
  { key: "Excel Report Generation", title: "Excel Report Generation", status: "pending", message: "", ts: null },
  { key: "Final Export Packaging",  title: "Final Export Packaging",  status: "pending", message: "", ts: null },
];

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------
function Toast({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-card-lg ${
              t.type === "error"
                ? "bg-soft-red border-red-200 text-brand-red"
                : "bg-soft-green border-green-200 text-brand-green"
            }`}
          >
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium flex-1">{t.message}</p>
            <button onClick={() => onDismiss(t.id)}>
              <X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section divider
// ---------------------------------------------------------------------------
function SectionDivider({ label }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px bg-border-soft" />
      <span className="text-xs font-medium text-text-muted uppercase tracking-widest px-1">
        {label}
      </span>
      <div className="flex-1 h-px bg-border-soft" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  // Upload state
  const [wcsUpload, setWcsUpload] = useState(null);
  const [wmsUpload, setWmsUpload] = useState(null);
  const [uploading, setUploading] = useState({ wcs: false, wms: false });
  const [uploadErrors, setUploadErrors] = useState({ wcs: null, wms: null });

  // Pipeline state
  const [phase, setPhase] = useState("upload"); // "upload" | "processing" | "complete"
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [isGenerating, setIsGenerating] = useState(false);
  const [jobId, setJobId] = useState(null);

  // Results
  const [metrics, setMetrics] = useState(null);
  const [logs, setLogs] = useState([]);

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);

  const resultsSectionRef = useRef(null);

  // Auto-scroll to results when complete
  useEffect(() => {
    if (phase === "complete" && resultsSectionRef.current) {
      setTimeout(() => {
        resultsSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 400);
    }
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Toast helpers
  // ---------------------------------------------------------------------------
  const addToast = useCallback((message, type = "error") => {
    const id = ++toastIdRef.current;
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 5000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((p) => p.filter((t) => t.id !== id));
  }, []);

  // ---------------------------------------------------------------------------
  // Upload handlers
  // ---------------------------------------------------------------------------
  const uploadFile = useCallback(
    async (file, fileType) => {
      setUploading((p) => ({ ...p, [fileType]: true }));
      setUploadErrors((p) => ({ ...p, [fileType]: null }));
      if (fileType === "wcs") setWcsUpload(null);
      else setWmsUpload(null);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/upload/${fileType}`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ detail: "Upload failed" }));
          throw new Error(err.detail || "Upload failed");
        }

        const data = await res.json();
        if (fileType === "wcs") setWcsUpload(data);
        else setWmsUpload(data);
      } catch (err) {
        const msg = err.message || "Upload failed";
        setUploadErrors((p) => ({ ...p, [fileType]: msg }));
        addToast(msg, "error");
      } finally {
        setUploading((p) => ({ ...p, [fileType]: false }));
      }
    },
    [addToast]
  );

  const removeUpload = useCallback((fileType) => {
    if (fileType === "wcs") { setWcsUpload(null); setUploadErrors((p) => ({ ...p, wcs: null })); }
    else { setWmsUpload(null); setUploadErrors((p) => ({ ...p, wms: null })); }
  }, []);

  // ---------------------------------------------------------------------------
  // Generate reconciliation report
  // ---------------------------------------------------------------------------
  const handleGenerate = useCallback(async () => {
    if (!wcsUpload || !wmsUpload || isGenerating) return;

    setIsGenerating(true);
    setSteps(INITIAL_STEPS);
    setMetrics(null);
    setLogs([]);

    try {
      // 1. Create job
      const jobRes = await fetch("/api/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wcs_upload_id: wcsUpload.upload_id,
          wms_upload_id: wmsUpload.upload_id,
        }),
      });

      if (!jobRes.ok) {
        const err = await jobRes.json().catch(() => ({ detail: "Could not create job" }));
        throw new Error(err.detail);
      }

      const { job_id } = await jobRes.json();
      setJobId(job_id);
      setPhase("processing");

      // 2. Open SSE stream
      const es = new EventSource(`/api/reconcile/${job_id}/stream`);

      es.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }

        if (data.__done__) {
          es.close();
          setIsGenerating(false);
          return;
        }

        // Update the matching step tile
        setSteps((prev) =>
          prev.map((s) =>
            s.key === data.step
              ? { ...s, status: data.status, message: data.message || s.message, ts: data.ts }
              : s
          )
        );

        // Append to logs
        setLogs((prev) => [...prev, data]);

        // Capture summary metrics from Mismatch Analysis event
        if (data.summary) setMetrics(data.summary);

        // Mark complete
        if (data.download_ready) setPhase("complete");

        // Surface failures as toasts
        if (data.status === "failed") {
          addToast(`${data.step}: ${data.message}`, "error");
        }
      };

      es.onerror = () => {
        es.close();
        setIsGenerating(false);
        addToast("Connection to backend lost. Please try again.", "error");
      };
    } catch (err) {
      setIsGenerating(false);
      addToast(err.message || "Failed to start reconciliation", "error");
    }
  }, [wcsUpload, wmsUpload, isGenerating, addToast]);

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------
  const handleReset = useCallback(async () => {
    if (jobId) {
      fetch(`/api/job/${jobId}`, { method: "DELETE" }).catch(() => {});
    }
    setWcsUpload(null);
    setWmsUpload(null);
    setUploadErrors({ wcs: null, wms: null });
    setPhase("upload");
    setSteps(INITIAL_STEPS);
    setIsGenerating(false);
    setJobId(null);
    setMetrics(null);
    setLogs([]);
  }, [jobId]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const bothUploaded = !!wcsUpload && !!wmsUpload;
  const canGenerate = bothUploaded && !isGenerating && phase !== "processing";

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-white">
      <HeaderBar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col gap-10">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-brand-red uppercase tracking-widest">
              Warehouse Operations
            </span>
            <ArrowRight className="w-3 h-3 text-text-muted" />
            <span className="text-xs text-text-secondary">Inventory Reconciliation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-text-dark tracking-tight">
            Warehouse Reconciliation System
          </h1>
          <p className="text-sm text-text-secondary max-w-xl">
            Compare WMS and WCS quantities accurately. Upload both Excel exports, generate
            the comparison report, and download the validated results.
          </p>
        </motion.div>

        {/* ── Upload section ───────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionDivider label="Step 1 — Upload Files" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* WCS upload */}
            <div className="bg-white rounded-2xl border border-border-soft shadow-card p-5">
              <UploadDropzone
                label="WCS File"
                sublabel="Warehouse Control System export"
                requiredCols={WCS_REQUIRED}
                uploadData={wcsUpload}
                isUploading={uploading.wcs}
                error={uploadErrors.wcs}
                onUpload={(f) => uploadFile(f, "wcs")}
                onRemove={() => removeUpload("wcs")}
                disabled={phase === "processing"}
              />
            </div>

            {/* WMS upload */}
            <div className="bg-white rounded-2xl border border-border-soft shadow-card p-5">
              <UploadDropzone
                label="WMS File"
                sublabel="Warehouse Management System export"
                requiredCols={WMS_REQUIRED}
                uploadData={wmsUpload}
                isUploading={uploading.wms}
                error={uploadErrors.wms}
                onUpload={(f) => uploadFile(f, "wms")}
                onRemove={() => removeUpload("wms")}
                disabled={phase === "processing"}
              />
            </div>
          </div>

          {/* File summary bar (appears when both uploaded) */}
          <AnimatePresence>
            {bothUploaded && phase === "upload" && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between bg-surface border border-border-soft rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span>
                    <span className="font-semibold text-text-dark">WCS:</span>{" "}
                    {wcsUpload.rows?.toLocaleString()} rows
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border-soft inline-block" />
                  <span>
                    <span className="font-semibold text-text-dark">WMS:</span>{" "}
                    {wmsUpload.rows?.toLocaleString()} rows
                  </span>
                  <span className="w-1 h-1 rounded-full bg-border-soft inline-block" />
                  <span className="text-brand-green font-medium">Both files validated ✓</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* ── Generate button ──────────────────────────────────────────── */}
        <section className="flex flex-col gap-5">
          <SectionDivider label="Step 2 — Generate Report" />

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col items-center gap-4"
          >
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              className={[
                "flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-card",
                canGenerate
                  ? "bg-brand-red text-white hover:bg-red-700 hover:shadow-card-hover active:scale-[0.98]"
                  : "bg-surface text-text-muted border border-border-soft cursor-not-allowed",
              ].join(" ")}
            >
              <Play className="w-4 h-4" fill={canGenerate ? "white" : "currentColor"} />
              {isGenerating ? "Processing…" : "Generate Reconciliation Report"}
            </button>

            {!bothUploaded && (
              <p className="text-xs text-text-secondary">
                Upload both WCS and WMS files to enable reconciliation
              </p>
            )}
          </motion.div>
        </section>

        {/* ── Processing tiles ─────────────────────────────────────────── */}
        <AnimatePresence>
          {(phase === "processing" || phase === "complete") && (
            <motion.section
              key="processing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-5"
            >
              <SectionDivider label="Step 3 — Live Pipeline" />
              <ProcessingTiles steps={steps} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* ── Results ──────────────────────────────────────────────────── */}
        <AnimatePresence>
          {phase === "complete" && (
            <motion.section
              key="results"
              ref={resultsSectionRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-8"
            >
              <SectionDivider label="Step 4 — Results" />

              {/* Metrics */}
              {metrics && <MetricsCards metrics={metrics} />}

              {/* Download panel */}
              <DownloadPanel jobId={jobId} onReset={handleReset} />

              {/* Audit logs */}
              <AuditLogsPanel logs={logs} />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Toast notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
