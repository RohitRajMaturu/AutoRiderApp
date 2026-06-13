export default function AnimatedAuto({ className = "" }) {
  return (
    <div className={`relative flex h-48 w-full items-center justify-center overflow-hidden ${className}`}>
      <style>{`
        @keyframes autoride-vibrate {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          35% { transform: translateY(-2px) rotate(-0.35deg); }
          70% { transform: translateY(1px) rotate(0.25deg); }
        }
        @keyframes autoride-wheel-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes autoride-smoke {
          0% { transform: translate(0, 0) scale(0.4); opacity: 0.55; }
          100% { transform: translate(-34px, -18px) scale(1.9); opacity: 0; }
        }
        @keyframes autoride-road {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -42; }
        }
        .autoride-auto-body { animation: autoride-vibrate 0.42s infinite linear; transform-origin: center; }
        .autoride-wheel { transform-box: fill-box; transform-origin: center; animation: autoride-wheel-spin 0.48s infinite linear; }
        .autoride-smoke { animation: autoride-smoke 1.1s infinite ease-out; transform-origin: center; }
        .autoride-road { animation: autoride-road 1.15s infinite linear; }
      `}</style>

      <svg
        aria-hidden="true"
        className="h-full w-full drop-shadow-[0_20px_35px_rgba(249,115,22,0.18)]"
        viewBox="0 0 360 220"
        fill="none"
      >
        <path
          className="autoride-road"
          d="M28 180H334"
          stroke="#FDBA74"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="22 20"
          opacity="0.52"
        />
        <path
          d="M56 156C92 128 126 116 165 116H239C276 116 305 128 329 156H56Z"
          fill="#1C1917"
          opacity="0.08"
        />

        <circle className="autoride-smoke" cx="78" cy="150" r="7" fill="#D6D3D1" />
        <circle
          className="autoride-smoke"
          cx="80"
          cy="151"
          r="6"
          fill="#E7E5E4"
          style={{ animationDelay: "0.36s" }}
        />
        <circle
          className="autoride-smoke"
          cx="78"
          cy="150"
          r="5"
          fill="#F5F5F4"
          style={{ animationDelay: "0.72s" }}
        />

        <g className="autoride-auto-body">
          <path
            d="M104 99C110 69 134 50 168 50H220C255 50 282 74 289 110L296 147H94L104 99Z"
            fill="#F97316"
            stroke="#1C1917"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path
            d="M127 98C133 80 148 69 169 69H212C233 69 250 81 258 98H127Z"
            fill="#FFFBF5"
            stroke="#1C1917"
            strokeWidth="4"
            strokeLinejoin="round"
          />
          <path
            d="M108 116H284C300 116 313 129 313 145V157H85V139C85 126 95 116 108 116Z"
            fill="#FACC15"
            stroke="#1C1917"
            strokeWidth="5"
            strokeLinejoin="round"
          />
          <path d="M105 125H279" stroke="#FFFBF5" strokeWidth="7" strokeLinecap="round" opacity="0.62" />
          <path d="M218 69L227 116" stroke="#1C1917" strokeWidth="4" strokeLinecap="round" />
          <path d="M126 146H89" stroke="#138808" strokeWidth="7" strokeLinecap="round" />
          <path d="M286 145H313" stroke="#F97316" strokeWidth="7" strokeLinecap="round" />
          <rect x="151" y="116" width="58" height="18" rx="6" fill="#1C1917" opacity="0.18" />

          <g className="autoride-wheel">
            <circle cx="133" cy="158" r="23" fill="#111827" />
            <circle cx="133" cy="158" r="13" fill="#57534E" />
            <path d="M133 139V177M114 158H152" stroke="#A8A29E" strokeWidth="4" strokeLinecap="round" />
            <circle cx="133" cy="158" r="5" fill="#F5F5F4" />
          </g>
          <g className="autoride-wheel">
            <circle cx="258" cy="158" r="23" fill="#111827" />
            <circle cx="258" cy="158" r="13" fill="#57534E" />
            <path d="M258 139V177M239 158H277" stroke="#A8A29E" strokeWidth="4" strokeLinecap="round" />
            <circle cx="258" cy="158" r="5" fill="#F5F5F4" />
          </g>
        </g>

        <path d="M47 68H88M56 83H78M282 54H322M299 70H334" stroke="#A8A29E" strokeWidth="5" strokeLinecap="round" opacity="0.34" />
        <circle cx="305" cy="102" r="12" fill="#138808" opacity="0.88" />
        <circle cx="75" cy="112" r="9" fill="#F97316" opacity="0.75" />
      </svg>
    </div>
  );
}
