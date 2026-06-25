import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import SvgChart, { SVGRenderer } from "@wuba/react-native-echarts/svgChart";
import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";

echarts.use([
  SVGRenderer,
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
]);

export default function MobileEChart({ option, height, width, style }) {
  const chartRef = useRef(null);
  const [measuredWidth, setMeasuredWidth] = useState(width || 0);
  const chartWidth = width || measuredWidth;
  const stableOption = useMemo(() => option, [option]);

  useEffect(() => {
    if (!chartRef.current || !chartWidth || !height) return undefined;
    const chart = echarts.init(chartRef.current, null, {
      renderer: "svg",
      width: chartWidth,
      height,
    });
    chart.setOption(stableOption, true);
    return () => chart.dispose();
  }, [chartWidth, height, stableOption]);

  return (
    <View
      onLayout={(event) => {
        if (!width) setMeasuredWidth(Math.round(event.nativeEvent.layout.width));
      }}
      style={[{ height, width: width || "100%" }, style]}
    >
      {chartWidth > 0 ? <SvgChart ref={chartRef} /> : null}
    </View>
  );
}
