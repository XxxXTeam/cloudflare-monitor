"use client";

import { useMemo } from "react";
import { Globe } from "lucide-react";
import type { CFAnalyticsData } from "@/types";

/*
GeographyStatsProps 地理分布统计组件属性
@field data Cloudflare 分析数据
@field formatNumber 数字格式化函数
@field formatBytes 字节格式化函数
*/
interface GeographyStatsProps {
  data: CFAnalyticsData | null;
  formatNumber: (num: number) => string;
  formatBytes: (bytes: number) => string;
}

/*
GeographyStats 访问地区排行榜组件
@功能 展示 Cloudflare 站点的访问国家/地区 TOP 10 排行榜
*/
export function GeographyStats({ data, formatNumber, formatBytes }: GeographyStatsProps) {
  const geoData = useMemo(() => {
    if (!data?.accounts) return [];

    const countryStats: Record<string, { requests: number; bytes: number; threats: number }> = {};

    data.accounts.forEach((account) => {
      account.zones?.forEach((zone) => {
        zone.geography?.forEach((geo) => {
          // 从 countryMap 获取国家数据
          geo.sum.countryMap?.forEach((country) => {
            const countryName = country.clientCountryName;
            if (!countryStats[countryName]) {
              countryStats[countryName] = { requests: 0, bytes: 0, threats: 0 };
            }
            countryStats[countryName].requests += country.requests || 0;
            countryStats[countryName].bytes += country.bytes || 0;
            countryStats[countryName].threats += country.threats || 0;
          });
        });
      });
    });

    return Object.entries(countryStats)
      .map(([country, stats]) => ({
        country,
        ...stats,
      }))
      .sort((a, b) => b.requests - a.requests)
      .slice(0, 10);
  }, [data]);

  if (geoData.length === 0) {
    return null;
  }

  const maxRequests = Math.max(...geoData.map((g) => g.requests));

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4 sm:mb-5">
        <Globe className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold">访问国家/地区 TOP 10</h3>
      </div>
      <div className="space-y-3 sm:space-y-3.5">
        {geoData.map((geo, index) => (
          <div key={geo.country} className="flex items-center gap-2.5 sm:gap-3">
            <span className="w-5 text-center text-[11px] font-medium text-muted-foreground flex-shrink-0 tabular-nums">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="text-xs sm:text-sm font-medium truncate">{geo.country}</span>
                <div className="flex gap-2 sm:gap-3 text-[11px] sm:text-xs text-muted-foreground flex-shrink-0 tabular-nums">
                  <span className="hidden sm:inline">{formatNumber(geo.requests)} 请求</span>
                  <span>{formatBytes(geo.bytes)}</span>
                </div>
              </div>
              <div className="h-1 sm:h-1.5 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${(geo.requests / maxRequests) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
