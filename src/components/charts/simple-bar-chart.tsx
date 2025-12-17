"use client";

import * as React from "react";
import { formatCurrency } from "@/utils/format";

export interface BarChartDataItem {
  name: string;
  receitas: number;
  despesas: number;
}

interface SimpleBarChartProps {
  data: BarChartDataItem[];
}

/**
 * Lightweight CSS-based bar chart component
 * Shows income vs expenses comparison
 */
export const SimpleBarChart = React.memo(({ data }: SimpleBarChartProps) => {
  const maxValue = React.useMemo(() => {
    let max = 0;
    data.forEach((d) => {
      if (d.receitas > max) max = d.receitas;
      if (d.despesas > max) max = d.despesas;
    });
    return max || 1;
  }, [data]);

  return (
    <div className="h-[280px] flex items-end gap-2 pt-8 pb-8 px-2">
      {data.map((item, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2">
          <div className="w-full flex gap-1 items-end h-[200px]">
            {/* Receitas bar */}
            <div className="flex-1 flex flex-col justify-end">
              <div
                className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-md transition-all duration-500 relative group"
                style={{
                  height: `${(item.receitas / maxValue) * 100}%`,
                  minHeight: item.receitas > 0 ? "4px" : "0",
                }}
              >
                {item.receitas > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-10">
                    {formatCurrency(item.receitas)}
                  </div>
                )}
              </div>
            </div>
            {/* Despesas bar */}
            <div className="flex-1 flex flex-col justify-end">
              <div
                className="w-full bg-gradient-to-t from-rose-600 to-rose-400 rounded-t-md transition-all duration-500 relative group"
                style={{
                  height: `${(item.despesas / maxValue) * 100}%`,
                  minHeight: item.despesas > 0 ? "4px" : "0",
                }}
              >
                {item.despesas > 0 && (
                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-card border border-border px-2 py-1 rounded text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg z-10">
                    {formatCurrency(item.despesas)}
                  </div>
                )}
              </div>
            </div>
          </div>
          <span className="text-xs text-muted-foreground capitalize">
            {item.name}
          </span>
        </div>
      ))}
    </div>
  );
});

SimpleBarChart.displayName = "SimpleBarChart";
