import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Terminal, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";

const STATUS_META = {
  completed: { icon: CheckCircle2, color: "text-brand-green", bg: "bg-soft-green" },
  failed:    { icon: XCircle,      color: "text-brand-red",   bg: "bg-soft-red"   },
  processing:{ icon: Loader2,      color: "text-blue-500",    bg: "bg-blue-50"    },
};

function LogRow({ log }) {
  const meta = STATUS_META[log.status] ?? { icon: Clock, color: "text-text-muted", bg: "bg-surface" };
  const Icon = meta.icon;

  return (
    <div className={`flex items-start gap-3 px-3 py-2.5 rounded-lg ${meta.bg}`}>
      <Icon
        className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${meta.color} ${log.status === "processing" ? "animate-spin" : ""}`}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-text-dark">{log.step}</span>
          <span className="text-xs text-text-muted tabular-nums">{log.ts}</span>
        </div>
        {log.message && (
          <p className="text-xs text-text-secondary mt-0.5 leading-snug break-all">
            {log.message}
          </p>
        )}
      </div>
    </div>
  );
}

export default function AuditLogsPanel({ logs }) {
  const [open, setOpen] = useState(false);

  if (!logs || logs.length === 0) return null;

  const errorCount = logs.filter((l) => l.status === "failed").length;
  const warnCount = logs.filter((l) => l.status === "completed" && l.message?.toLowerCase().includes("duplicate")).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl border border-border-soft bg-white shadow-card overflow-hidden"
    >
      {/* Toggle header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-surface transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <Terminal className="w-4 h-4 text-text-secondary" />
          <span className="text-sm font-semibold text-text-dark">Execution Logs</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-surface border border-border-soft text-text-secondary tabular-nums">
            {logs.length} entries
          </span>
          {errorCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-soft-red border border-red-100 text-brand-red font-medium">
              {errorCount} error{errorCount > 1 ? "s" : ""}
            </span>
          )}
          {warnCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-soft-orange border border-orange-100 text-brand-orange font-medium">
              {warnCount} warning{warnCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-text-secondary" />
        ) : (
          <ChevronDown className="w-4 h-4 text-text-secondary" />
        )}
      </button>

      {/* Log entries */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border-soft px-4 py-3 flex flex-col gap-1.5 max-h-80 overflow-y-auto">
              {logs.map((log, i) => (
                <LogRow key={i} log={log} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
