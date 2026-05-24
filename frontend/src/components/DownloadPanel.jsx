import { motion } from "framer-motion";
import { Download, FileSpreadsheet, RotateCcw, CheckCircle2 } from "lucide-react";

export default function DownloadPanel({ jobId, onReset }) {
  const handleDownload = () => {
    const a = document.createElement("a");
    a.href = `/api/download/${jobId}`;
    a.download = "Comparison_Report.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border border-green-200 bg-soft-green p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 shadow-card-lg"
    >
      {/* Info */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-white border border-green-200 flex items-center justify-center flex-shrink-0 shadow-card">
          <FileSpreadsheet className="w-5 h-5 text-brand-green" strokeWidth={1.75} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-dark">
              Comparison_Report.xlsx
            </h3>
            <CheckCircle2 className="w-4 h-4 text-brand-green" />
          </div>
          <p className="text-xs text-text-secondary mt-0.5">
            5 sheets: Comparison Report · Summary · Duplicate IDs · Missing Records · Audit Log
          </p>
          <div className="flex items-center gap-3 mt-2">
            {["Comparison_Report", "Summary", "Duplicate_IDs", "Missing_Records", "Audit_Log"].map(
              (sheet) => (
                <span
                  key={sheet}
                  className="text-xs px-2 py-0.5 rounded-full bg-white border border-green-100 text-brand-green font-medium"
                >
                  {sheet}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-dark transition-colors px-4 py-2 rounded-lg border border-border-soft bg-white hover:bg-surface"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          New Run
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 text-sm font-semibold text-white bg-brand-green hover:bg-green-700 transition-colors px-5 py-2 rounded-lg shadow-card"
        >
          <Download className="w-4 h-4" />
          Download Report
        </button>
      </div>
    </motion.div>
  );
}
