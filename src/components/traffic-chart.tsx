"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Cloud, Zap, ArrowUpRight } from "lucide-react";
import type { CFZone, TimePeriod } from "@/types";
import { formatBytes, formatCompactNumber } from "@/lib/utils";

/*
TrafficChartProps 流量图表组件属性
@field title 图表标题（通常为域名）
@field subtitle 副标题（通常为账户名）
@field data 站点数据
@field selectedPeriod 选择的时间周期
@field provider 服务商标识
*/
interface TrafficChartProps {
  title: string;
  subtitle?: string;
  data: CFZone;
  selectedPeriod: TimePeriod;
  provider: "cloudflare" | "edgeone";
}

export function TrafficChart({
  title,
  subtitle,
  data,
  selectedPeriod,
  provider,
}: TrafficChartProps) {
  const chartData = useMemo(() => {
    const useHourlyData = selectedPeriod === "1day" || selectedPeriod === "3days";
    const rawData = useHourlyData ? data.rawHours || [] : data.raw || [];

    const sortedData = rawData
      .filter((d) => d && d.dimensions && d.sum)
      .sort((a, b) => {
        const aTime = useHourlyData
          ? (a as { dimensions: { datetime: string } }).dimensions.datetime
          : (a as { dimensions: { date: string } }).dimensions.date;
        const bTime = useHourlyData
          ? (b as { dimensions: { datetime: string } }).dimensions.datetime
          : (b as { dimensions: { date: string } }).dimensions.date;
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      });

    let periodData;
    if (useHourlyData) {
      const periodHours = selectedPeriod === "1day" ? 24 : 72;
      periodData = sortedData.slice(-Math.min(sortedData.length, periodHours));
    } else {
      const periodDays = selectedPeriod === "7days" ? 7 : 30;
      periodData = sortedData.slice(-Math.min(sortedData.length, periodDays));
    }

    return periodData.map((item) => {
      const time = useHourlyData
        ? (item as { dimensions: { datetime: string } }).dimensions.datetime
        : (item as { dimensions: { date: string } }).dimensions.date;

      const date = new Date(time);
      let label: string;
      if (useHourlyData) {
        label = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
      } else {
        label = `${date.getMonth() + 1}/${date.getDate()}`;
      }

      return {
        time: label,
        requests: item.sum.requests,
        bandwidth: item.sum.bytes,
        cached: item.sum.cachedRequests,
      };
    });
  }, [data, selectedPeriod]);

  const Icon = provider === "cloudflare" ? Cloud : Zap;
  const iconColor = provider === "cloudflare" ? "text-cloudflare-orange" : "text-edgeone-blue";
  const lineColor = provider === "cloudflare" ? "#F38020" : "#006EFF";

  if (data.error) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>}
        <p className="text-sm text-destructive">{data.error}</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mb-2">{subtitle}</p>}
        <p className="text-sm text-muted-foreground">暂无数据</p>
      </div>
    );
  }

  return (
    <div className="group rounded-xl border border-border/60 bg-card p-4 sm:p-5 transition-all hover:border-border hover:shadow-sm cursor-pointer">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${iconColor}`} />
          <span className="text-sm font-medium">{title}</span>
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mb-3">{subtitle}</p>}
      <div className="h-[180px] sm:h-[200px]">
        <ResponsiveContainer width="100%" height="100%" style={{ pointerEvents: 'none' }}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(value: number) => formatCompactNumber(value)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              }}
              formatter={(value: number, name: string) => {
                if (name === "bandwidth") return [formatBytes(value), "流量"];
                return [formatCompactNumber(value), name === "requests" ? "请求数" : "缓存请求"];
              }}
            />
            <Line
              type="monotone"
              dataKey="requests"
              stroke={lineColor}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="cached"
              stroke="#10B981"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
