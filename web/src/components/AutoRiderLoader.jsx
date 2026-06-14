import Lottie from "lottie-react";
import animationData from "/animations/auto-rickshaw-loader.json";

export default function AutoRiderLoader({ size = 72, label = "Loading" }) {
  const compact = size <= 40;

  return (
    <span className="inline-flex items-center justify-center gap-2.5">
      <span
        aria-hidden="true"
        className="shrink-0"
        style={{
          width: compact ? 40 : size,
          height: compact ? 40 : size,
          marginBlock: compact ? -8 : 0,
        }}
      >
        <Lottie
          animationData={animationData}
          loop
          autoplay
          style={{ width: "100%", height: "100%" }}
        />
      </span>
      {!!label && <span>{label}</span>}
    </span>
  );
}
