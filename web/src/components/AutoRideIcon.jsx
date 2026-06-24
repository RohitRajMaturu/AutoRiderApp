export default function AutoRideIcon({ size, className = "", style, ...props }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex select-none items-center justify-center ${className}`}
      style={{
        ...(size == null ? null : { fontSize: size }),
        lineHeight: 1,
        ...style,
      }}
      {...props}
    >
      🛺
    </span>
  );
}
