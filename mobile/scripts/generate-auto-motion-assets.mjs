import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = join(process.cwd(), "assets", "animations", "auto-motion");

const palette = {
  autoYellow: "#F3B51B",
  autoGreen: "#1F8A4C",
  autoBlack: "#17272B",
  primary: "#43B8B3",
  primaryDark: "#339E9A",
  success: "#22C55E",
  error: "#EF4444",
  purple: "#7C3AED",
  text: "#17272B",
  textSecondary: "#647678",
  surface: "#FFFFFF",
  darkSurface: "#17272B",
  road: "#D8E4E5",
};

const animations = [
  {
    id: "searching-nearby-auto",
    text: "Finding nearby autos...",
    loop: true,
    frames: 120,
    size: 240,
    sequence: [
      "Auto eases left and right over a soft road shadow.",
      "Three radar rings pulse outward from the GPS center.",
      "Location pins fade in staggered order, then disappear for seamless loop.",
    ],
    timing: "0-400ms settle, 400-1600ms radar pulse, 1600-2000ms pin fade reset.",
    rive: "State machine: idle_loop; inputs: theme, reduceMotion. Artboards: auto, radar, pins.",
  },
  {
    id: "driver-match-found",
    text: "Driver found!",
    loop: false,
    frames: 96,
    size: 240,
    sequence: [
      "Auto starts left and travels toward a glowing destination pin.",
      "Auto brakes with a small suspension dip.",
      "Success check draws on, followed by restrained teal/gold particles.",
    ],
    timing: "0-900ms approach, 900-1150ms stop, 1150-1600ms check and particles.",
    rive: "State machine: intro -> found_complete; trigger: play. Inputs: theme.",
  },
  {
    id: "driver-arriving",
    text: "Driver is on the way",
    loop: true,
    frames: 150,
    size: 240,
    sequence: [
      "Dotted route reveals from driver side to passenger pin.",
      "Auto glides along the route and loops back invisibly.",
      "Passenger pin gently pulses to anchor the waiting state.",
    ],
    timing: "0-2500ms route travel loop with pin pulse every 900ms.",
    rive: "State machine: arriving_loop; numeric input progress 0..1 for ETA sync.",
  },
  {
    id: "ride-in-progress",
    text: "Ride in progress",
    loop: true,
    frames: 150,
    size: 240,
    sequence: [
      "Pickup and destination markers stay fixed.",
      "Auto moves continuously along a curved route.",
      "Route shimmer suggests motion without visual noise.",
    ],
    timing: "0-2500ms continuous route loop.",
    rive: "State machine: ride_loop; numeric input routeProgress.",
  },
  {
    id: "ride-completed",
    text: "Ride completed successfully",
    loop: false,
    frames: 110,
    size: 240,
    sequence: [
      "Auto reaches destination marker.",
      "Destination glow expands into a success ring.",
      "Auto settles while checkmark appears.",
    ],
    timing: "0-1000ms arrive, 1000-1400ms ring, 1400-1800ms check settle.",
    rive: "State machine: complete_once; trigger: complete.",
  },
  {
    id: "booking-button-loader",
    text: "Finding Auto...",
    loop: true,
    frames: 72,
    size: 120,
    sequence: [
      "Tiny auto enters from left inside button-safe frame.",
      "Road dash scrolls opposite direction.",
      "Auto exits and re-enters with no jump.",
    ],
    timing: "0-1200ms seamless button loop.",
    rive: "State machine: button_loop; artboard 120x48.",
  },
  {
    id: "no-drivers-available",
    text: "No autos nearby right now",
    loop: false,
    frames: 120,
    size: 240,
    sequence: [
      "Parked auto rests beside a quiet road.",
      "Three nearby pins fade away one by one.",
      "Scene holds on a calm empty state.",
    ],
    timing: "0-900ms pins disappear, 900-2000ms hold.",
    rive: "State machine: empty_hold; trigger: reset.",
  },
  {
    id: "payment-success",
    text: "Payment successful",
    loop: false,
    frames: 96,
    size: 240,
    sequence: [
      "Green success ring opens at center.",
      "Auto passes through the ring.",
      "UPI-style success check locks in.",
    ],
    timing: "0-450ms ring, 450-1100ms pass-through, 1100-1600ms check.",
    rive: "State machine: payment_success; trigger: paid.",
  },
  {
    id: "detecting-location",
    text: "Detecting your location...",
    loop: true,
    frames: 120,
    size: 220,
    sequence: [
      "GPS marker pins to center.",
      "Two radar rings expand and fade.",
      "Center dot breathes subtly.",
    ],
    timing: "0-2000ms radar loop.",
    rive: "State machine: gps_loop; boolean input hasLock.",
  },
  {
    id: "splash-screen",
    text: "TukTukGo",
    loop: false,
    frames: 150,
    size: 320,
    sequence: [
      "Auto outline draws progressively.",
      "Cab fills with yellow and green brand colors.",
      "Wheels and wordmark settle into final lockup.",
    ],
    timing: "0-1200ms outline draw, 1200-2100ms fill, 2100-2500ms settle.",
    rive: "State machine: splash_once; trigger: start; events: finished.",
  },
];

function hexToLottie(hex) {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
    1,
  ];
}

function keyframes(values) {
  return {
    a: 1,
    k: values.map((item, index) => ({
      t: item.t,
      s: item.s,
      e: values[index + 1]?.s,
      i: { x: [0.42], y: [1] },
      o: { x: [0.58], y: [0] },
    })),
  };
}

function transform({ p = [0, 0, 0], s = [100, 100, 100], r = 0, o = 100 } = {}) {
  return {
    o: typeof o === "number" ? { a: 0, k: o } : o,
    r: typeof r === "number" ? { a: 0, k: r } : r,
    p: Array.isArray(p) ? { a: 0, k: p } : p,
    a: { a: 0, k: [0, 0, 0] },
    s: Array.isArray(s) ? { a: 0, k: s } : s,
  };
}

function shapeLayer({ ind, name, shapes, p, s, r, o, ip = 0, op }) {
  return {
    ddd: 0,
    ind,
    ty: 4,
    nm: name,
    sr: 1,
    ks: transform({ p, s, r, o }),
    ao: 0,
    shapes,
    ip,
    op,
    st: 0,
    bm: 0,
  };
}

function fill(color, opacity = 100) {
  return { ty: "fl", c: { a: 0, k: hexToLottie(color) }, o: { a: 0, k: opacity }, r: 1 };
}

function stroke(color, width = 4, opacity = 100) {
  return {
    ty: "st",
    c: { a: 0, k: hexToLottie(color) },
    o: { a: 0, k: opacity },
    w: { a: 0, k: width },
    lc: 2,
    lj: 2,
  };
}

function ellipse({ size, color, opacity = 100, outline = false, width = 4, p = [0, 0] }) {
  return {
    ty: "gr",
    it: [
      { ty: "el", d: 1, s: { a: 0, k: size }, p: { a: 0, k: p } },
      outline ? stroke(color, width, opacity) : fill(color, opacity),
      { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
    ],
  };
}

function rect({ size, radius, color, opacity = 100, p = [0, 0] }) {
  return {
    ty: "gr",
    it: [
      { ty: "rc", d: 1, s: { a: 0, k: size }, p: { a: 0, k: p }, r: { a: 0, k: radius } },
      fill(color, opacity),
      { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
    ],
  };
}

function autoShapes(scale = 1) {
  const x = (value) => value * scale;
  return [
    rect({ size: [x(82), x(34)], radius: x(9), color: palette.autoYellow, p: [0, x(8)] }),
    rect({ size: [x(62), x(34)], radius: x(17), color: palette.autoGreen, p: [x(-5), x(-14)] }),
    rect({ size: [x(40), x(18)], radius: x(5), color: palette.surface, opacity: 86, p: [x(-12), x(-16)] }),
    rect({ size: [x(12), x(42)], radius: x(3), color: palette.autoBlack, opacity: 80, p: [x(27), x(-4)] }),
    ellipse({ size: [x(20), x(20)], color: palette.autoBlack, p: [x(-30), x(28)] }),
    ellipse({ size: [x(20), x(20)], color: palette.autoBlack, p: [x(28), x(28)] }),
    ellipse({ size: [x(9), x(9)], color: palette.surface, opacity: 78, p: [x(-30), x(28)] }),
    ellipse({ size: [x(9), x(9)], color: palette.surface, opacity: 78, p: [x(28), x(28)] }),
  ];
}

function pathShape(points, color = palette.primary, width = 4, opacity = 100) {
  return {
    ty: "gr",
    it: [
      {
        ty: "sh",
        ks: {
          a: 0,
          k: {
            i: points.map(() => [0, 0]),
            o: points.map(() => [0, 0]),
            v: points,
            c: false,
          },
        },
      },
      stroke(color, width, opacity),
      { ty: "tr", p: { a: 0, k: [0, 0] }, a: { a: 0, k: [0, 0] }, s: { a: 0, k: [100, 100] }, r: { a: 0, k: 0 }, o: { a: 0, k: 100 } },
    ],
  };
}

function pinShapes(color = palette.primary) {
  return [
    ellipse({ size: [28, 28], color, p: [0, -7] }),
    ellipse({ size: [9, 9], color: palette.surface, opacity: 95, p: [0, -7] }),
    pathShape([[-7, 5], [0, 18], [7, 5]], color, 4, 100),
  ];
}

function checkShapes(color = palette.success) {
  return [pathShape([[-18, 0], [-5, 13], [20, -14]], color, 7, 100)];
}

function textLayer(ind, text, y, op) {
  return {
    ddd: 0,
    ind,
    ty: 5,
    nm: "caption",
    sr: 1,
    ks: transform({ p: [op.w / 2, y, 0] }),
    ao: 0,
    t: {
      d: {
        k: [
          {
            s: {
              sz: [op.w, 40],
              ps: [-op.w / 2, -18],
              s: 17,
              f: "Inter",
              t: text,
              j: 2,
              tr: 0,
              lh: 20,
              fc: hexToLottie(palette.text).slice(0, 3),
            },
            t: 0,
          },
        ],
      },
      p: {},
      m: { g: 1, a: { a: 0, k: [0, 0] } },
      a: [],
    },
    ip: 0,
    op: op.frames,
    st: 0,
    bm: 0,
  };
}

function makeLayers(animation) {
  const frames = animation.frames;
  const w = animation.size;
  const h = animation.size;
  let ind = 1;
  const layers = [];

  const add = (layer) => {
    layers.push({ ...layer, op: layer.op || frames });
  };

  const roadY = h * 0.68;
  add(shapeLayer({
    ind: ind++,
    name: "soft road shadow",
    p: [w / 2, roadY, 0],
    shapes: [rect({ size: [w * 0.62, 5], radius: 3, color: palette.road, opacity: 65 })],
  }));

  if (animation.id.includes("detecting-location")) {
    [0, 20, 40].forEach((delay) => {
      add(shapeLayer({
        ind: ind++,
        name: `radar ring ${delay}`,
        p: [w / 2, h / 2, 0],
        s: keyframes([
          { t: delay, s: [35, 35, 100] },
          { t: delay + 55, s: [130, 130, 100] },
          { t: frames, s: [35, 35, 100] },
        ]),
        o: keyframes([
          { t: delay, s: [52] },
          { t: delay + 55, s: [0] },
          { t: frames, s: [0] },
        ]),
        shapes: [ellipse({ size: [52, 52], color: palette.primary, outline: true, width: 3, opacity: 100 })],
      }));
    });
    add(shapeLayer({ ind: ind++, name: "gps pin", p: [w / 2, h / 2, 0], shapes: pinShapes(palette.primary) }));
  } else {
    const autoP =
      animation.id === "booking-button-loader"
        ? keyframes([{ t: 0, s: [-24, h * 0.52, 0] }, { t: frames, s: [w + 24, h * 0.52, 0] }])
        : animation.id === "driver-match-found" || animation.id === "ride-completed" || animation.id === "payment-success"
          ? keyframes([{ t: 0, s: [w * 0.22, h * 0.58, 0] }, { t: frames * 0.7, s: [w * 0.7, h * 0.58, 0] }, { t: frames, s: [w * 0.72, h * 0.58, 0] }])
          : animation.id === "driver-arriving" || animation.id === "ride-in-progress"
            ? keyframes([{ t: 0, s: [w * 0.24, h * 0.58, 0] }, { t: frames * 0.55, s: [w * 0.62, h * 0.46, 0] }, { t: frames, s: [w * 0.78, h * 0.58, 0] }])
            : animation.id === "searching-nearby-auto"
              ? keyframes([{ t: 0, s: [w * 0.5, h * 0.58, 0] }, { t: frames / 2, s: [w * 0.42, h * 0.58, 0] }, { t: frames, s: [w * 0.5, h * 0.58, 0] }])
              : [w * 0.5, h * 0.58, 0];

    if (animation.id.includes("arriving") || animation.id.includes("progress")) {
      add(shapeLayer({
        ind: ind++,
        name: "dotted route",
        p: [0, 0, 0],
        shapes: [pathShape([[w * 0.22, h * 0.62], [w * 0.45, h * 0.48], [w * 0.78, h * 0.6]], palette.primary, 4, 55)],
      }));
      add(shapeLayer({ ind: ind++, name: "pickup pin", p: [w * 0.2, h * 0.62, 0], s: [75, 75, 100], shapes: pinShapes(palette.success) }));
      add(shapeLayer({ ind: ind++, name: "destination pin", p: [w * 0.82, h * 0.6, 0], s: [75, 75, 100], shapes: pinShapes(palette.purple) }));
    }

    if (animation.id.includes("searching")) {
      [0, 22, 44].forEach((delay) => {
        add(shapeLayer({
          ind: ind++,
          name: `nearby radar ${delay}`,
          p: [w / 2, h * 0.55, 0],
          s: keyframes([{ t: delay, s: [30, 30, 100] }, { t: delay + 50, s: [115, 115, 100] }, { t: frames, s: [30, 30, 100] }]),
          o: keyframes([{ t: delay, s: [45] }, { t: delay + 50, s: [0] }, { t: frames, s: [0] }]),
          shapes: [ellipse({ size: [70, 70], color: palette.primary, outline: true, width: 3 })],
        }));
      });
      [[0.2, 0.38], [0.78, 0.38], [0.72, 0.72]].forEach(([px, py], index) => {
        add(shapeLayer({
          ind: ind++,
          name: `nearby pin ${index + 1}`,
          p: [w * px, h * py, 0],
          s: [55, 55, 100],
          o: keyframes([{ t: index * 14, s: [0] }, { t: index * 14 + 18, s: [100] }, { t: frames - 20, s: [100] }, { t: frames, s: [0] }]),
          shapes: pinShapes(palette.primary),
        }));
      });
    }

    if (animation.id.includes("no-drivers")) {
      [[0.25, 0.38], [0.72, 0.35], [0.78, 0.68]].forEach(([px, py], index) => {
        add(shapeLayer({
          ind: ind++,
          name: `fading pin ${index + 1}`,
          p: [w * px, h * py, 0],
          s: [60, 60, 100],
          o: keyframes([{ t: 0, s: [100] }, { t: 26 + index * 20, s: [0] }, { t: frames, s: [0] }]),
          shapes: pinShapes(palette.primary),
        }));
      });
    }

    if (animation.id.includes("payment-success") || animation.id.includes("completed")) {
      add(shapeLayer({
        ind: ind++,
        name: "success ring",
        p: [w * 0.73, h * 0.5, 0],
        s: keyframes([{ t: 35, s: [40, 40, 100] }, { t: frames * 0.75, s: [125, 125, 100] }, { t: frames, s: [100, 100, 100] }]),
        o: keyframes([{ t: 35, s: [0] }, { t: frames * 0.75, s: [100] }, { t: frames, s: [100] }]),
        shapes: [ellipse({ size: [58, 58], color: palette.success, outline: true, width: 5 })],
      }));
    }

    if (animation.id.includes("match") || animation.id.includes("completed") || animation.id.includes("payment")) {
      add(shapeLayer({
        ind: ind++,
        name: "success check",
        p: [w * 0.73, h * 0.5, 0],
        s: keyframes([{ t: frames * 0.62, s: [30, 30, 100] }, { t: frames * 0.8, s: [105, 105, 100] }, { t: frames, s: [100, 100, 100] }]),
        o: keyframes([{ t: frames * 0.62, s: [0] }, { t: frames * 0.8, s: [100] }, { t: frames, s: [100] }]),
        shapes: checkShapes(palette.success),
      }));
    }

    if (animation.id.includes("splash")) {
      add(shapeLayer({
        ind: ind++,
        name: "outline draw",
        p: [w / 2, h * 0.48, 0],
        o: keyframes([{ t: 0, s: [100] }, { t: frames, s: [100] }]),
        shapes: [pathShape([[-58, 20], [-42, -28], [18, -38], [58, 8], [42, 28], [-58, 28]], palette.autoBlack, 5, 100)],
      }));
      add(shapeLayer({
        ind: ind++,
        name: "splash auto fill",
        p: [w / 2, h * 0.48, 0],
        s: keyframes([{ t: 58, s: [80, 80, 100] }, { t: 90, s: [104, 104, 100] }, { t: frames, s: [100, 100, 100] }]),
        o: keyframes([{ t: 58, s: [0] }, { t: 90, s: [100] }, { t: frames, s: [100] }]),
        shapes: autoShapes(1.25),
      }));
    } else {
      add(shapeLayer({
        ind: ind++,
        name: "authentic auto rickshaw",
        p: autoP,
        s: animation.id.includes("booking-button") ? [58, 58, 100] : [100, 100, 100],
        shapes: autoShapes(animation.id.includes("booking-button") ? 0.55 : 1),
      }));
    }
  }

  add(textLayer(ind++, animation.text, h - 28, { w, frames }));
  return layers.reverse();
}

function buildLottie(animation) {
  return {
    v: "5.9.0",
    fr: 60,
    ip: 0,
    op: animation.frames,
    w: animation.size,
    h: animation.size,
    nm: animation.id,
    ddd: 0,
    assets: [],
    meta: {
      g: "TukTukGo motion generator",
      themeTokens: palette,
      loop: animation.loop,
      sequence: animation.sequence,
      timing: animation.timing,
      rive: animation.rive,
      lightTheme: "Use surface/text tokens as authored.",
      darkTheme: "Swap surface/text tokens and reduce road opacity by 20%.",
      dimensions: `${animation.size}x${animation.size}`,
      optimization: "Vector-only shapes, no raster images, no masks, short timeline, shared palette tokens.",
    },
    layers: makeLayers(animation),
  };
}

mkdirSync(outDir, { recursive: true });

for (const animation of animations) {
  writeFileSync(
    join(outDir, `${animation.id}.json`),
    `${JSON.stringify(buildLottie(animation), null, 2)}\n`,
  );
}

writeFileSync(
  join(outDir, "palette.json"),
  `${JSON.stringify({ palette, animations: animations.map(({ id, text, loop, sequence, timing, rive }) => ({ id, text, loop, sequence, timing, rive })) }, null, 2)}\n`,
);

console.log(`Generated ${animations.length} TukTukGo motion assets in ${outDir}`);
