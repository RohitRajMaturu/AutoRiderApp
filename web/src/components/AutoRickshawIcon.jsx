export default function AutoRickshawIcon({
  size = 24,
  color = "#1F8A4C",
  yellow = "#F3B51B",
  black = "#17272B",
  surface = "#FFFFFF",
  signal = "#22C55E",
  className = "",
  ...props
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 160 130"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <rect x="37" y="54" width="86" height="34" rx="9" fill={yellow} />
      <rect x="46" y="31" width="64" height="35" rx="17" fill={color} />
      <rect x="52" y="38" width="40" height="18" rx="5" fill={surface} opacity="0.88" />
      <path d="M111 39 L122 58 L118 88 L105 87 L108 58 Z" fill={black} opacity="0.78" />
      <rect x="31" y="72" width="100" height="14" rx="6" fill={yellow} />
      <circle cx="50" cy="94" r="11" fill={black} />
      <circle cx="112" cy="94" r="11" fill={black} />
      <circle cx="50" cy="94" r="4" fill={surface} opacity="0.82" />
      <circle cx="112" cy="94" r="4" fill={surface} opacity="0.82" />
      <rect x="29" y="68" width="12" height="8" rx="3" fill={signal} opacity="0.85" />
    </svg>
  );
}
