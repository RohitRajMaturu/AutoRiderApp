import { motion } from "motion/react";

export default function TukTukGoLoader({ size = 56, label, tone = "light" }) {
  const captionColor = tone === "dark" ? "text-[#BFD1D3]" : "text-[#586C70]";
  const dotColor = tone === "dark" ? "bg-white" : "bg-[#43B8B3]";

  return (
    <div className="inline-flex flex-col items-center justify-center gap-2" role="status" aria-live="polite">
      <motion.div
        className="relative rounded-full border-4 border-[#BFE5E0] border-t-[#43B8B3]"
        style={{ width: size, height: size }}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      >
        <span className="sr-only">{label || "Loading"}</span>
      </motion.div>
      <div className="flex items-center gap-1.5" aria-hidden="true">
        {[0, 0.15, 0.3].map((delay) => (
          <motion.span
            key={delay}
            className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
            animate={{ opacity: [0.35, 1, 0.35], y: [0, -2, 0] }}
            transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay }}
          />
        ))}
      </div>

      {label ? (
        <span className={`text-[11px] font-bold uppercase tracking-normal ${captionColor}`}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
