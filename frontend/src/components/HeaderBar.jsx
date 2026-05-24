import { Activity, Warehouse } from "lucide-react";

export default function HeaderBar() {
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-border-soft">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left — brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-brand-red flex items-center justify-center flex-shrink-0">
            <Warehouse className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <span className="font-semibold text-text-dark text-sm tracking-tight">
            WH Reconciliation
          </span>
          <span className="hidden sm:inline-block text-border-soft">·</span>
          <span className="hidden sm:inline-block text-xs text-text-secondary font-medium px-2 py-0.5 bg-surface rounded-full border border-border-soft">
            v1.0
          </span>
        </div>

        {/* Right — status + timestamp */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-1.5 text-xs text-text-secondary">
            <Activity className="w-3.5 h-3.5 text-brand-green" />
            <span className="text-brand-green font-medium">System Online</span>
          </div>
          <div className="hidden sm:block w-px h-4 bg-border-soft" />
          <span className="text-xs text-text-secondary tabular-nums">
            {dateStr} · {timeStr}
          </span>
          <div className="w-7 h-7 rounded-full bg-surface border border-border-soft flex items-center justify-center text-xs font-semibold text-text-secondary">
            W
          </div>
        </div>
      </div>
    </header>
  );
}
