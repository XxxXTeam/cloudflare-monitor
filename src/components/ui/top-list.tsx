"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBytes } from "@/lib/utils";

/*
TopListItem 排行榜列表项数据结构
@field name 项目名称
@field value 项目数值
*/
interface TopListItem {
  name: string;
  value: number;
}

/*
TopListProps 排行榜组件属性
@field title 标题
@field icon 可选的标题图标
@field data 排行榜数据数组
@field color 进度条颜色 CSS 类名
@field formatValue 可选的自定义数值格式化函数
@field emptyText 数据为空时的提示文本
*/
interface TopListProps {
  title: string;
  icon?: React.ReactNode;
  data: TopListItem[];
  color?: string;
  formatValue?: (value: number) => string;
  emptyText?: string;
}

/*
TopList 排行榜列表组件
@功能 展示带排名序号和进度条的 TOP N 排行榜列表
*/
export function TopList({
  title,
  icon,
  data,
  color = "bg-primary",
  formatValue = formatBytes,
  emptyText = "暂无数据",
}: TopListProps) {
  const maxValue = data.length > 0 ? data[0].value : 1;

  return (
    <Card>
      <CardHeader className="pb-2 sm:pb-4">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-2.5 sm:space-y-3">
            {data.map((item, i) => (
              <div key={i} className="flex items-center gap-2 sm:gap-4">
                <span className="w-5 sm:w-6 text-center text-xs sm:text-sm font-medium text-muted-foreground flex-shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-xs sm:text-sm font-mono truncate" title={item.name}>
                      {item.name || "Unknown"}
                    </p>
                    <span className="text-xs sm:text-sm text-muted-foreground flex-shrink-0">
                      {formatValue(item.value)}
                    </span>
                  </div>
                  <div className="h-1.5 sm:h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${color}`}
                      style={{ width: `${(item.value / maxValue) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-6 sm:py-8 text-sm">{emptyText}</p>
        )}
      </CardContent>
    </Card>
  );
}
