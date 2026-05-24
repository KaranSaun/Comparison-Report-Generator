import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  X,
  Loader2,
  AlertCircle,
} from "lucide-react";

export default function UploadDropzone({
  label,
  sublabel,
  requiredCols,
  uploadData,       // {filename, rows, columns, size_label} | null
  isUploading,
  error,
  onUpload,
  onRemove,
  disabled,
}) {
  const onDrop = useCallback(
    (accepted) => {
      if (accepted.length > 0 && !disabled) onUpload(accepted[0]);
    },
    [onUpload, disabled]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/vnd.ms-excel": [".xls"],
    },
    multiple: false,
    disabled: disabled || isUploading,
  });

  const isSuccess = !!uploadData;
  const isError = !!error;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col gap-3"
    >
      {/* Card header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-dark">{label}</h3>
          <p className="text-xs text-text-secondary mt-0.5">{sublabel}</p>
        </div>
        {isSuccess && (
          <CheckCircle2 className="w-5 h-5 text-brand-green flex-shrink-0" />
        )}
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={[
          "relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer select-none",
          isSuccess
            ? "border-brand-green bg-soft-green cursor-default"
            : isError
            ? "border-brand-red bg-soft-red"
            : isDragActive
            ? "border-blue-400 bg-blue-50"
            : disabled || isUploading
            ? "border-border-soft bg-surface cursor-not-allowed opacity-60"
            : "border-border-soft bg-surface hover:border-blue-300 hover:bg-blue-50/30",
        ].join(" ")}
        style={{ minHeight: 148 }}
      >
        <input {...getInputProps()} />

        <AnimatePresence mode="wait">
          {isUploading ? (
            <motion.div
              key="uploading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            >
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
              <span className="text-sm text-text-secondary">Uploading…</span>
            </motion.div>
          ) : isSuccess ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4"
            >
              <FileSpreadsheet className="w-7 h-7 text-brand-green" />
              <span className="text-sm font-medium text-text-dark text-center truncate max-w-full">
                {uploadData.filename}
              </span>
              <div className="flex items-center gap-3 text-xs text-text-secondary">
                <span>{uploadData.rows?.toLocaleString()} rows</span>
                <span className="w-1 h-1 rounded-full bg-border-soft inline-block" />
                <span>{uploadData.size_label}</span>
              </div>
              {/* Remove button */}
              <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                className="mt-1 flex items-center gap-1 text-xs text-text-secondary hover:text-brand-red transition-colors"
              >
                <X className="w-3 h-3" /> Remove
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5"
            >
              {isError ? (
                <XCircle className="w-7 h-7 text-brand-red" />
              ) : (
                <Upload
                  className={[
                    "w-7 h-7 transition-colors",
                    isDragActive ? "text-blue-500" : "text-text-muted",
                  ].join(" ")}
                />
              )}
              <span className="text-sm font-medium text-text-dark text-center">
                {isDragActive
                  ? "Drop to upload"
                  : isError
                  ? "Upload failed — try again"
                  : "Drag & drop or click to browse"}
              </span>
              <span className="text-xs text-text-secondary text-center">
                .xlsx or .xls · Excel format only
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message */}
      <AnimatePresence>
        {isError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 text-xs text-brand-red bg-soft-red border border-red-100 rounded-lg px-3 py-2"
          >
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Required columns pill list */}
      {!isSuccess && (
        <div className="flex flex-wrap gap-1.5">
          {requiredCols.map((col) => (
            <span
              key={col}
              className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border-soft text-text-secondary font-mono"
            >
              {col}
            </span>
          ))}
        </div>
      )}

      {/* Detected columns (after upload) */}
      {isSuccess && (
        <div className="flex flex-wrap gap-1.5">
          {uploadData.columns?.slice(0, 6).map((col) => (
            <span
              key={col}
              className="text-xs px-2 py-0.5 rounded-full bg-soft-green border border-green-100 text-brand-green font-mono"
            >
              {col}
            </span>
          ))}
          {uploadData.columns?.length > 6 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border-soft text-text-secondary">
              +{uploadData.columns.length - 6} more
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
