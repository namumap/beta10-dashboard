"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fetchWeeklyChart } from "@/lib/kis/chart";
import type { OHLCVBar } from "@/lib/kis/types";

function calc30MA(bars: OHLCVBar[]): (number | null)[] {
  return bars.map((_, i) => {
    if (i < 29) return null;
    const slice = bars.slice(i - 29, i + 1);
    return slice.reduce((s, b) => s + b.close, 0) / 30;
  });
}

function formatDate(yyyymmdd: string) {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

type ChartRow = { date: string; close: number; ma30: number | null };

export function WeeklyChart({ ticker }: { ticker: string }) {
  const [rows, setRows] = React.useState<ChartRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!ticker) return;
    setLoading(true);
    setError(null);
    fetchWeeklyChart(ticker)
      .then((bars) => {
        const ma = calc30MA(bars);
        setRows(
          bars.map((b, i) => ({
            date: formatDate(b.date),
            close: b.close,
            ma30: ma[i],
          })),
        );
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [ticker]);

  if (!ticker) return null;

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        데이터 불러오는 중...
      </div>
    );

  if (error)
    return (
      <div className="flex h-64 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );

  if (rows.length === 0) return null;

  const minClose = Math.min(...rows.map((r) => r.close));
  const maxClose = Math.max(...rows.map((r) => r.close));
  const pad = (maxClose - minClose) * 0.05;

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="mb-3 text-sm font-medium">
        {ticker} — 주봉 종가 / 30MA
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={rows} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10 }}
            tickFormatter={(v: string) => v.slice(0, 7)}
            interval={Math.floor(rows.length / 8)}
            stroke="hsl(var(--border))"
          />
          <YAxis
            domain={[minClose - pad, maxClose + pad]}
            tick={{ fontSize: 10 }}
            tickFormatter={(v: number) => v.toLocaleString("ko-KR")}
            width={64}
            stroke="hsl(var(--border))"
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === "number" ? value.toLocaleString("ko-KR") : value,
              name === "close" ? "종가" : "30MA",
            ]}
            labelStyle={{ fontSize: 12 }}
            contentStyle={{ fontSize: 12 }}
          />
          <Bar dataKey="close" fill="hsl(var(--primary))" opacity={0.7} maxBarSize={12} />
          <Line
            dataKey="ma30"
            dot={false}
            stroke="#f97316"
            strokeWidth={1.5}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
