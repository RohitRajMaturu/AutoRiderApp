export default function AutoRiderLoader({ label = "Loading" }) {
  return (
    <span className="inline-flex items-center justify-center gap-2">
      <svg
        aria-hidden="true"
        className="h-6 w-8 animate-pulse"
        viewBox="0 0 64 40"
        fill="none"
      >
        <path
          d="M12 24c1.4-8.2 7.2-14 16-14h12c5.8 0 10.8 3.8 12.4 9.4L54 24"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M18 24h30l-3-8H26c-4.2 0-7.2 2.2-8 8Z"
          fill="currentColor"
          opacity="0.18"
        />
        <circle cx="22" cy="28" r="5" fill="currentColor" />
        <circle cx="46" cy="28" r="5" fill="currentColor" />
        <path
          d="M8 24h48"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      <span>{label}</span>
    </span>
  );
}
