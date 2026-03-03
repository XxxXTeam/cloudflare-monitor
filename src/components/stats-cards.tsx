"use client";

import { Activity, Database, Shield, Gauge } from "lucide-react";

/*
StatsCardsProps 统计卡片组件属性
@field totalRequests 总请求数
@field totalBytes 总流量字节数
@field totalThreats 安全威胁数
@field cacheHitRate 缓存命中率百分比字符串
@field formatNumber 数字格式化函数
@field formatBytes 字节格式化函数
*/
interface StatsCardsProps {
  totalRequests: number;
  totalBytes: number;
  totalThreats: number;
  cacheHitRate: string;
  formatNumber: (num: number) => string;
  formatBytes: (bytes: number) => string;
}

/*
StatsCards 全平台数据统计卡片组件
@功能 以简洁现代的卡片形式展示请求数、流量、威胁数和缓存命中率
*/
export function StatsCards({
  totalRequests,
  totalBytes,
  totalThreats,
  cacheHitRate,
  formatNumber,
  formatBytes,
}: StatsCardsProps) {
  const stats = [
    {
      title: "总请求数",
      value: formatNumber(totalRequests),
      icon: Activity,
      accent: "text-blue-600 dark:text-blue-400",
      dot: "bg-blue-500",
    },
    {
      title: "总流量",
      value: formatBytes(totalBytes),
      icon: Database,
      accent: "text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
    },
    {
      title: "安全威胁",
      value: formatNumber(totalThreats),
      icon: Shield,
      accent: "text-red-600 dark:text-red-400",
      dot: "bg-red-500",
    },
    {
      title: "缓存命中率",
      value: `${cacheHitRate}%`,
      icon: Gauge,
      accent: "text-violet-600 dark:text-violet-400",
      dot: "bg-violet-500",
    },
  ];

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.title}
          className="group relative rounded-xl border border-border/60 bg-card p-4 sm:p-5 transition-all hover:border-border hover:shadow-sm"
        >
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className={`w-1.5 h-1.5 rounded-full ${stat.dot}`} />
            <p className="text-[11px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
          </div>
          <p className={`text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight stat-value ${stat.accent}`}>
            {stat.value}
          </p>
        </div>
      ))}
    </div>
  );
}
