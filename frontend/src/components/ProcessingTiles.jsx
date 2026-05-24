import { motion, AnimatePresence } from "framer-motion";
import {
  FileCheck,
  Sparkles,
  Link2,
  Copy,
  Calculator,
  GitMerge,
  BarChart2,
  FileSpreadsheet,
  PackageCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";

const STEP_META = {
  "File Validation":        { icon: FileCheck,      desc: "Loading & validating input files" },
  "Data Cleaning":          { icon: Sparkles,        desc: "Normalizing strings, removing hidden chars" },
  "ID Concatenation":       { icon: Link2,           desc: "Building composite matching keys" },
  "Duplicate Detection":    { icon: Copy,            desc: "Scanning for duplicate IDs" },
  "Quantity Aggregation":   { icon: Calculator,      desc: "Summing quantities per unique ID" },
  "Record Matching":        { icon: GitMerge,        desc: "Full outer join on composite IDs" },
  "Mismatch Analysis":      { icon: BarChart2,       desc: "Calculating match rate & discrepancies" },
  "Excel Report Generation":{ icon: FileSpreadsheet, desc: "Building 5-sheet Excel workbook" },
  "Final Export Packaging": { icon: PackageCheck,    desc: "Packaging report for download" },
};

function StatusIcon({ status }) {
  if (status === "processing")
    return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
  if (status === "completed")
    return <CheckCircle2 className="w-4 h-4 text-brand-green" />;
  if (status === "failed")
    return <XCircle className="w-4 h-4 text-brand-red" />;
  return <Clock className="w-4 h-4 text-text-muted" />;
}

function StepTile({ step }) {
  const meta = STEP_META[step.key] ?? { icon: Clock, desc: "" };
  const Icon = meta.icon;

  const cardClass = {
    pending:    "bg-surface border-border-soft",
    processing: "bg-white border-blue-300 animate-processing-border shadow-card",
    completed:  "bg-soft-green border-green-200",
    failed:     "bg-soft-red border-red-200",
  }[step.status] ?? "bg-surface border-border-soft";

  const iconBgClass = {
    pending:    "bg-white border-border-soft text-text-muted",
    processing: "bg-blue-50 border-blue-200 text-blue-500",
    completed:  "bg-white border-green-200 text-brand-green",
    failed:     "bg-white border-red-200 text-brand-red",
  }[step.status] ?? "bg-white border-border-soft text-text-muted";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`rounded-xl border p-4 transition-all duration-300 ${cardClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center flex-shrink-0 ${iconBgClass}`}>
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </div>

        {/* Status icon */}
        <StatusIcon status={step.status} />
      </div>

      {/* Title + desc */}
      <div className="mt-3">
        <p className="text-sm font-semibold text-text-dark leading-tight">
          {step.title}
        </p>
        <p className="text-xs text-text-secondary mt-0.5 leading-snug">
          {step.status === "pending"
            ? meta.desc
            : step.message || meta.desc}
        </p>
      </div>

      {/* Timestamp */}
      <AnimatePresence>
        {step.ts && step.status !== "pending" && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-text-muted mt-2 tabular-nums"
          >
            {step.ts}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Processing shimmer bar */}
      {step.status === "processing" && (
        <div className="mt-3 h-0.5 rounded-full overflow-hidden bg-blue-100">
          <div className="h-full shimmer-bg" />
        </div>
      )}
    </motion.div>
  );
}

export default function ProcessingTiles({ steps }) {
  const completedCount = steps.filter((s) => s.status === "completed").length;
  const totalCount = steps.length;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const hasFailed = steps.some((s) => s.status === "failed");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-5"
    >
      {/* Header + progress bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-text-dark">
            Reconciliation Pipeline
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {hasFailed
              ? "Pipeline stopped — see error below"
              : completedCount === totalCount
              ? "All stages completed successfully"
              : "Processing your data — please wait…"}
          </p>
        </div>
        <span className="text-sm font-semibold tabular-nums text-text-secondary">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Overall progress bar */}
      <div className="h-1.5 bg-border-soft rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${hasFailed ? "bg-brand-red" : "bg-brand-green"}`}
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Tiles grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {steps.map((step, i) => (
          <StepTile key={step.key} step={step} index={i} />
        ))}
      </div>
    </motion.div>
  );
}
