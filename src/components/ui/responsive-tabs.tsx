"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/*
TabItem 定义单个标签项的数据结构
@field value 标签的唯一标识值
@field label 标签显示的文本
@field icon 可选的标签图标
*/
interface TabItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

/*
ResponsiveTabsProps 响应式标签组件的属性定义
@field tabs 标签项数组
@field activeTab 当前激活的标签值
@field onTabChange 标签切换回调函数
@field children 标签内容区域
@field accentColor 可选的高亮颜色类名，如 'bg-edgeone-blue'、'bg-cloudflare-orange'
@field className 可选的自定义样式类名
*/
interface ResponsiveTabsProps {
  tabs: TabItem[];
  activeTab: string;
  onTabChange: (value: string) => void;
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
}

/*
ResponsiveTabs 响应式标签组件
移动端（<md）使用 Headless UI Listbox 下拉选择器
桌面端（>=md）使用可横向滚动的标签栏，带左右滚动按钮
@功能 自适应移动端和桌面端的标签导航方案
*/
export function ResponsiveTabs({
  tabs,
  activeTab,
  onTabChange,
  children,
  accentColor = "bg-primary",
  className,
}: ResponsiveTabsProps) {
  const activeItem = tabs.find((t) => t.value === activeTab) || tabs[0];
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  /*
  checkScroll 检查标签栏是否可以左右滚动，更新滚动指示器状态
  @功能 监听滚动容器的滚动位置，判断是否可以继续左右滚动
  */
  const checkScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll]);

  /* 当活动标签变化时，自动滚动标签栏使其可见 */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const activeEl = el.querySelector(`[data-tab-value="${activeTab}"]`) as HTMLElement;
    if (activeEl) {
      const left = activeEl.offsetLeft - el.offsetLeft;
      const right = left + activeEl.offsetWidth;
      if (left < el.scrollLeft) {
        el.scrollTo({ left: left - 8, behavior: "smooth" });
      } else if (right > el.scrollLeft + el.clientWidth) {
        el.scrollTo({ left: right - el.clientWidth + 8, behavior: "smooth" });
      }
    }
  }, [activeTab]);

  const scroll = (dir: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div className={cn("space-y-3 sm:space-y-4", className)}>
      {/* 移动端：下拉选择器 */}
      <div className="md:hidden">
        <Listbox value={activeTab} onChange={onTabChange}>
          <div className="relative">
            <ListboxButton className="relative w-full cursor-pointer rounded-lg border bg-background py-2.5 pl-3 pr-10 text-left text-sm font-medium shadow-sm transition hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
              <span className="flex items-center gap-2">
                {activeItem?.icon}
                {activeItem?.label}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </span>
            </ListboxButton>
            <ListboxOptions className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border bg-popover py-1 shadow-lg focus:outline-none">
              {tabs.map((tab) => (
                <ListboxOption
                  key={tab.value}
                  value={tab.value}
                  className={({ focus, selected }) =>
                    cn(
                      "relative cursor-pointer select-none py-2 pl-3 pr-9 text-sm",
                      focus && "bg-accent",
                      selected && "font-semibold text-primary"
                    )
                  }
                >
                  {({ selected }) => (
                    <span className={cn("flex items-center gap-2", selected && "font-semibold")}>
                      {tab.icon}
                      {tab.label}
                    </span>
                  )}
                </ListboxOption>
              ))}
            </ListboxOptions>
          </div>
        </Listbox>
      </div>

      {/* 桌面端：可滚动标签栏 */}
      <div className="hidden md:flex items-center gap-1">
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="flex-shrink-0 rounded-md p-1 hover:bg-accent transition-colors"
            aria-label="向左滚动"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
        <div
          ref={scrollRef}
          className="flex-1 overflow-x-auto scrollbar-hide"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <div className="inline-flex h-auto gap-1 rounded-lg bg-muted/50 p-1 w-max">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                data-tab-value={tab.value}
                onClick={() => onTabChange(tab.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all",
                  activeTab === tab.value
                    ? `${accentColor} text-white shadow-sm`
                    : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="flex-shrink-0 rounded-md p-1 hover:bg-accent transition-colors"
            aria-label="向右滚动"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 内容区域 */}
      <div>{children}</div>
    </div>
  );
}
