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
  pending_review: { label: "KYC Review", color: "var(--ar-warn)", dim: "var(--ar-warn-dim)", pulse: false },
  approved: { label: "Approved", color: "var(--ar-ok)", dim: "var(--ar-ok-dim)", pulse: false },
  rejected: { label: "Rejected", color: "var(--ar-err)", dim: "var(--ar-err-dim)", pulse: false },
  resubmission_required: { label: "Resubmit", color: "var(--ar-err)", dim: "var(--ar-err-dim)", pulse: false },
  active: { label: "Active", color: "var(--ar-ok)", dim: "var(--ar-ok-dim)", pulse: false },
  inactive: { label: "Inactive", color: "var(--ar-t3)", dim: "var(--ar-s3)", pulse: false },
  assigned: { label: "Assigned", color: "var(--ar-ok)", dim: "var(--ar-ok-dim)", pulse: false },
  unassigned: { label: "Unassigned", color: "var(--ar-err)", dim: "var(--ar-err-dim)", pulse: false },
  paused: { label: "Paused", color: "var(--ar-warn)", dim: "var(--ar-warn-dim)", pulse: false },
  expired: { label: "Expired", color: "var(--ar-t3)", dim: "var(--ar-s3)", pulse: false },
  pending_match: { label: "Finding Driver", color: "var(--ar-info)", dim: "var(--ar-info-dim)", pulse: true },
  driver_no_show: { label: "No-Show", color: "var(--ar-err)", dim: "var(--ar-err-dim)", pulse: false },
  trial: { label: "Trial", color: "var(--ar-info)", dim: "var(--ar-info-dim)", pulse: false },
  suspended: { label: "Suspended", color: "var(--ar-err)", dim: "var(--ar-err-dim)", pulse: false },
  churned: { label: "Churned", color: "var(--ar-t3)", dim: "var(--ar-s3)", pulse: false },
  scheduled: { label: "Scheduled", color: "var(--ar-t2)", dim: "var(--ar-s3)", pulse: false },
  in_progress: { label: "In Progress", color: "var(--ar-accent)", dim: "var(--ar-accent-dim)", pulse: true },
};

export function statusForDriver(driver) {
  if (!driver?.is_approved) return "pending";
  if (driver.is_online && driver.on_trip) return "on_trip";
  if (driver.is_online) return "idle";
  return "offline";
}

export default function StatusBadge({ status, label }) {
  const normalizedStatus = String(status || "").trim().toLowerCase();
  const config = STATUS[normalizedStatus] || STATUS.offline;
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
