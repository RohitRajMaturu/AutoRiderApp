import { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";

export const theme = {
  backgroundColor: "#1A1A1A",
  textStyle: { color: "#E5E5E5" },
  tooltip: {
    backgroundColor: "#2A2A2A",
    borderColor: "#F5A623",
    textStyle: { color: "#E5E5E5" },
  },
  grid: { borderColor: "transparent" },
  splitLine: { lineStyle: { color: "#2A2A2A" } },
};

const AXIS_LABEL = { color: "#8A8F9E", fontSize: 11 };
const AXIS_LINE = { lineStyle: { color: "#2A2A2A" } };

function safeValues(values = []) {
  return values.map((value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  });
}

export function useCountUp(target, duration = 800) {
  const numericTarget = Number(target);
  const resolvedTarget = Number.isFinite(numericTarget) ? numericTarget : 0;
  const [value, setValue] = useState(resolvedTarget);

  useEffect(() => {
    const from = value;
    const difference = resolvedTarget - from;
    const steps = Math.max(1, Math.round(duration / 24));
    let step = 0;
    const timer = setInterval(() => {
      step += 1;
      const progress = Math.min(step / steps, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + difference * eased);
      if (progress >= 1) clearInterval(timer);
    }, 24);
    return () => clearInterval(timer);
  }, [resolvedTarget, duration]);

  return value;
}

export function ChartSkeleton({ height = 260, className = "" }) {
  return (
    <div
      aria-label="Loading chart"
      className={`ar-chart-skeleton ${className}`}
      role="status"
      style={{ height, width: "100%" }}
    />
  );
}

export function Sparkline({ data, color = "#F5A623", loading = false }) {
  const values = safeValues(data);
  const option = useMemo(
    () => ({
      ...theme,
      animation: true,
      animationDurationUpdate: 500,
      grid: { ...theme.grid, left: 0, right: 0, top: 6, bottom: 2 },
      xAxis: {
        type: "category",
        show: false,
        boundaryGap: false,
        data: values.map((_, index) => index),
      },
      yAxis: { type: "value", show: false, scale: true },
      tooltip: { show: false },
      series: [
        {
          type: "line",
          data: values,
          smooth: true,
          symbol: "none",
          silent: true,
          lineStyle: { color, width: 2 },
        },
      ],
    }),
    [color, values],
  );

  if (loading) return <ChartSkeleton height={60} />;
  return (
    <ReactECharts
      option={option}
      notMerge
      lazyUpdate
      style={{ height: 60, width: "100%" }}
    />
  );
}

export function RevenueAreaChart({ data, height = 260, loading = false }) {
  const option = useMemo(
    () => ({
      ...theme,
      animation: true,
      animationDuration: 650,
      animationDurationUpdate: 650,
      animationEasingUpdate: "cubicOut",
      grid: { ...theme.grid, left: 54, right: 18, top: 24, bottom: 34 },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
        valueFormatter: (value) => `₹${Math.round(Number(value) || 0).toLocaleString("en-IN")}`,
      },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: data.map((item) => item.label),
        axisLabel: AXIS_LABEL,
        axisLine: AXIS_LINE,
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        axisLabel: {
          ...AXIS_LABEL,
          formatter: (value) => `₹${Math.round(value)}`,
        },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: theme.splitLine,
      },
      series: [
        {
          name: "Revenue",
          type: "line",
          data: data.map((item) => Number(item.fare) || 0),
          smooth: true,
          showSymbol: false,
          lineStyle: { color: "#F5A623", width: 3 },
          itemStyle: { color: "#F5A623" },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(245,166,35,0.3)" },
                { offset: 1, color: "rgba(245,166,35,0)" },
              ],
            },
          },
        },
      ],
    }),
    [data],
  );

  if (loading) return <ChartSkeleton height={height} />;
  return <ReactECharts option={option} notMerge lazyUpdate style={{ height, width: "100%" }} />;
}

export function RideVolumeChart({ data, height = 260, loading = false }) {
  const displayData = data.slice(-10);
  const option = useMemo(
    () => ({
      ...theme,
      animation: true,
      animationDuration: 600,
      animationDurationUpdate: 600,
      animationEasingUpdate: "cubicOut",
      grid: { ...theme.grid, left: 58, right: 24, top: 14, bottom: 24, containLabel: true },
      tooltip: {
        ...theme.tooltip,
        trigger: "axis",
        axisPointer: { type: "shadow" },
      },
      xAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: AXIS_LABEL,
        axisLine: AXIS_LINE,
        axisTick: { show: false },
        splitLine: theme.splitLine,
      },
      yAxis: {
        type: "category",
        inverse: true,
        data: displayData.map((item) => item.label),
        axisLabel: AXIS_LABEL,
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Ride volume",
          type: "bar",
          data: displayData.map((item) => Number(item.rides ?? item.total) || 0),
          barMaxWidth: 20,
          itemStyle: {
            color: "#F5A623",
            borderRadius: [0, 10, 10, 0],
          },
        },
      ],
    }),
    [displayData],
  );

  if (loading) return <ChartSkeleton height={height} />;
  return <ReactECharts option={option} notMerge lazyUpdate style={{ height, width: "100%" }} />;
}

export function FleetDonutChart({ idle, online }) {
  const busy = Math.max((Number(online) || 0) - (Number(idle) || 0), 0);
  const option = useMemo(
    () => ({
      ...theme,
      animation: true,
      tooltip: { show: false },
      series: [
        {
          type: "pie",
          radius: ["66%", "92%"],
          center: ["50%", "50%"],
          silent: true,
          label: { show: false },
          data: [
            { value: Number(idle) || 0, itemStyle: { color: "#22C55E" } },
            { value: busy, itemStyle: { color: "#F5A623" } },
            ...(online ? [] : [{ value: 1, itemStyle: { color: "#2A2A2A" } }]),
          ],
        },
      ],
    }),
    [busy, idle, online],
  );

  return <ReactECharts option={option} notMerge style={{ height: 54, width: 54 }} />;
}
