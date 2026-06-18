const STATUS = {
  online: { label: "Online", color: "var(--ar-ok)", dim: "var(--ar-ok-dim)", pulse: true },
  idle: { label: "Idle", color: "var(--ar-ok)", dim: "var(--ar-ok-dim)", pulse: false },
  on_trip: { label: "On Trip", color: "var(--ar-accent)", dim: "var(--ar-accent-dim)", pulse: true },
  offline: { label: "Offline", color: "var(--ar-t3)", dim: "var(--ar-s3)", pulse: false },
  pending: { label: "Pending", color: "var(--ar-warn)", dim: "var(--ar-warn-dim)", pulse: false },
  requested: { label: "Waiting", color: "var(--ar-warn)", dim: "var(--ar-warn-dim)", pulse: true },
  accepted: { label: "In Trip", color: "var(--ar-accent)", dim: "var(--ar-accent-dim)", pulse: true },
  completed: { label: "Completed", color: "var(--ar-ok)", dim: "var(--ar-ok-dim)", pulse: false },
  cancelled: { label: "Cancelled", color: "var(--ar-err)", dim: "var(--ar-err-dim)", pulse: false },
};

export function statusForDriver(driver) {
  if (!driver?.is_approved) return "pending";
  if (driver.is_online && driver.on_trip) return "on_trip";
  if (driver.is_online) return "idle";
  return "offline";
}

export default function StatusBadge({ status, label }) {
  const config = STATUS[status] || STATUS.offline;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-semibold"
      style={{ background: config.dim, color: config.color }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 rounded-full"
        style={{
          background: config.color,
          animation: config.pulse ? "ar-pulse 1.2s ease-in-out infinite" : undefined,
        }}
      />
      {label || config.label}
    </span>
  );
}
