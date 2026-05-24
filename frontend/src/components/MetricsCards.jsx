import { motion } from "framer-motion";
import {
  Hash,
  CheckCircle2,
  XCircle,
  PackageX,
  PackageMinus,
  Percent,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

function MetricCard({ label, value, subValue, icon: Icon, color, delay }) {
  const colorMap = {
    default: {
      bg: "bg-white",
      border: "border-border-soft",
      icon: "bg-surface text-text-secondary border-border-soft",
      value: "text-text-dark",
    },
    green: {
      bg: "bg-soft-green",
      border: "border-green-200",
      icon: "bg-white text-brand-green border-green-200",
      value: "text-brand-green",
    },
    red: {
      bg: "bg-soft-red",
      border: "border-red-200",
      icon: "bg-white text-brand-red border-red-200",
      value: "text-brand-red",
    },
    orange: {
      bg: "bg-soft-orange",
      border: "border-orange-200",
      icon: "bg-white text-brand-orange border-orange-200",
      value: "text-brand-orange",
    },
  };

  const c = colorMap[color] ?? colorMap.default;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className={`rounded-xl border p-4 shadow-card flex flex-col gap-3 ${c.bg} ${c.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-secondary uppercase tracking-wide">
          {label}
        </span>
        <div className={`w-7 h-7 rounded-lg border flex items-center justify-center ${c.icon}`}>
          <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        </div>
      </div>
      <div>
        <p className={`text-2xl font-bold tabular-nums leading-tight ${c.value}`}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {subValue !== undefined && (
          <p className="text-xs text-text-secondary mt-0.5">{subValue}</p>
        )}
      </div>
    </motion.div>
  );
}

export default function MetricsCards({ metrics }) {
  if (!metrics) return null;

  const {
    total, matched, unmatched,
    missing_wms, missing_wcs,
    match_pct, total_wcs_qty, total_wms_qty,
  } = metrics;

  const cards = [
    {
      label: "Total Records",
      value: total,
      icon: Hash,
      color: "default",
      subValue: `WCS ${total_wcs_qty?.toLocaleString()} qty · WMS ${total_wms_qty?.toLocaleString()} qty`,
    },
    {
      label: "Matched",
      value: matched,
      icon: CheckCircle2,
      color: "green",
      subValue: `${match_pct}% match rate`,
    },
    {
      label: "Unmatched",
      value: unmatched,
      icon: XCircle,
      color: unmatched > 0 ? "red" : "green",
      subValue: unmatched > 0 ? "Quantity discrepancies" : "No discrepancies",
    },
    {
      label: "Missing in WMS",
      value: missing_wms,
      icon: PackageX,
      color: missing_wms > 0 ? "orange" : "green",
      subValue: missing_wms > 0 ? "IDs only in WCS" : "All WCS IDs found in WMS",
    },
    {
      label: "Missing in WCS",
      value: missing_wcs,
      icon: PackageMinus,
      color: missing_wcs > 0 ? "orange" : "green",
      subValue: missing_wcs > 0 ? "IDs only in WMS" : "All WMS IDs found in WCS",
    },
    {
      label: "Match Rate",
      value: `${match_pct}%`,
      icon: match_pct >= 95 ? TrendingUp : TrendingDown,
      color: match_pct >= 95 ? "green" : match_pct >= 80 ? "orange" : "red",
      subValue: match_pct >= 95 ? "Excellent" : match_pct >= 80 ? "Needs review" : "Critical — review required",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-4"
    >
      <div>
        <h2 className="text-base font-semibold text-text-dark">
          Reconciliation Results
        </h2>
        <p className="text-xs text-text-secondary mt-0.5">
          Summary of quantity matching across both systems
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map((card, i) => (
          <MetricCard key={card.label} {...card} delay={i * 0.06} />
        ))}
      </div>
    </motion.div>
  );
}
