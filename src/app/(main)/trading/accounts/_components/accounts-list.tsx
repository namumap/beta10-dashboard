"use client";

import * as React from "react";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Account = {
  id: number;
  acc_type: string | null;
  acc_no: string | null;
  ticker: string | null;
  stock_name: string | null;
  qty: number | null;
  cur_amt: number | null;
  avg_amt: number | null;
  earning_rate: number | null;
  diff_rate: number | null;
  diff_amt: number | null;
  eval_amt: number | null;
  purchase_amt: number | null;
  updated_at: string | null;
};

type OHLCVPoint = {
  dt: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
};

function formatKRW(value: number | null) {
  if (value == null) return "-";
  return value.toLocaleString("ko-KR") + "원";
}

function formatRate(value: number | null) {
  if (value == null) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

type HAMetrics = { consecUp: number; upRate: number; consecDown: number; downRate: number };
type SortMode = "default" | "ha_down_days" | "ha_down_rate" | "ha_up_days" | "ha_up_rate";

function toHeikinAshi(data: OHLCVPoint[]): OHLCVPoint[] {
  return data.map((d, i) => {
    const haC = (d.o + d.h + d.l + d.c) / 4;
    const haO = i === 0 ? (d.o + d.c) / 2 : (data[i - 1].o + data[i - 1].c) / 2;
    const haH = Math.max(d.h, haO, haC);
    const haL = Math.min(d.l, haO, haC);
    return { ...d, o: haO, h: haH, l: haL, c: haC };
  });
}

function getHAMetrics(points: OHLCVPoint[]): HAMetrics {
  if (points.length === 0) return { consecUp: 0, upRate: 0, consecDown: 0, downRate: 0 };
  const ha = toHeikinAshi(points);
  let consecUp = 0, consecDown = 0;
  for (let i = ha.length - 1; i >= 0; i--) {
    if (ha[i].c >= ha[i].o) {
      if (consecDown > 0) break;
      consecUp++;
    } else {
      if (consecUp > 0) break;
      consecDown++;
    }
  }
  let upRate = 0, downRate = 0;
  if (consecUp > 0) {
    const s = ha[ha.length - consecUp];
    upRate = ((ha[ha.length - 1].c - s.o) / s.o) * 100;
  }
  if (consecDown > 0) {
    const s = ha[ha.length - consecDown];
    downRate = ((ha[ha.length - 1].c - s.o) / s.o) * 100;
  }
  return { consecUp, upRate, consecDown, downRate };
}

function MiniCandleChart({ data }: { data: OHLCVPoint[] }) {
  const W = 120, H = 40, PAD = 2;
  const valid = data.filter(
    (d) => isFinite(d.o) && isFinite(d.h) && isFinite(d.l) && isFinite(d.c),
  );
  if (valid.length === 0) return <div style={{ width: W, height: H }} />;

  const minLow = Math.min(...valid.map((d) => d.l));
  const maxHigh = Math.max(...valid.map((d) => d.h));
  const priceRange = maxHigh - minLow || 1;

  const toY = (price: number) => PAD + ((maxHigh - price) / priceRange) * (H - PAD * 2);
  const slotW = (W - PAD * 2) / valid.length;
  const candleW = Math.max(1, slotW - 1.5);

  return (
    <svg width={W} height={H} className="overflow-visible">
      {valid.map((d, i) => {
        const cx = PAD + i * slotW + slotW / 2;
        const isUp = d.c >= d.o;
        const color = isUp ? "#ef4444" : "#3b82f6";
        const bodyTop = toY(Math.max(d.o, d.c));
        const bodyBot = toY(Math.min(d.o, d.c));
        const bodyH = Math.max(1, bodyBot - bodyTop);
        return (
          <g key={i}>
            <line x1={cx} y1={toY(d.h)} x2={cx} y2={toY(d.l)} stroke={color} strokeWidth={0.8} />
            <rect x={cx - candleW / 2} y={bodyTop} width={candleW} height={bodyH} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

export function AccountsList() {
  const [data, setData] = React.useState<Account[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [chartData, setChartData] = React.useState<Record<string, OHLCVPoint[]>>({});
  const [sortMode, setSortMode] = React.useState<SortMode>("default");
  const [globalFilter, setGlobalFilter] = React.useState("");

  React.useEffect(() => {
    const supabase = createClient();
    supabase
      .from("accounts")
      .select("*")
      .order("diff_rate", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setData(data ?? []);
        setLoading(false);
      });
  }, []);

  React.useEffect(() => {
    if (data.length === 0) return;
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const tickers = data.map((r) => r.ticker).filter(Boolean) as string[];
    Promise.all(
      tickers.map(async (ticker) => {
        try {
          const res = await fetch(
            `${baseUrl}/storage/v1/object/public/charts/latest/${ticker}.json`,
          );
          if (!res.ok) return null;
          const json: OHLCVPoint[] = await res.json();
          const sorted = [...json].sort((a, b) => a.dt.localeCompare(b.dt));
          return { ticker, points: sorted.slice(-20) };
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      const map: Record<string, OHLCVPoint[]> = {};
      for (const r of results) {
        if (r) map[r.ticker] = r.points;
      }
      setChartData(map);
    });
  }, [data]);

  const haMetrics = React.useMemo(() => {
    const map: Record<string, HAMetrics> = {};
    for (const [ticker, points] of Object.entries(chartData)) {
      map[ticker] = getHAMetrics(points);
    }
    return map;
  }, [chartData]);

  const sortedData = React.useMemo(() => {
    if (sortMode === "default") return data;
    return [...data].sort((a, b) => {
      const am = a.ticker ? haMetrics[a.ticker] : null;
      const bm = b.ticker ? haMetrics[b.ticker] : null;
      if (!am || !bm) return 0;
      switch (sortMode) {
        case "ha_down_days": return bm.consecDown - am.consecDown || am.downRate - bm.downRate;
        case "ha_down_rate": return am.downRate - bm.downRate;
        case "ha_up_days": return bm.consecUp - am.consecUp || bm.upRate - am.upRate;
        case "ha_up_rate": return bm.upRate - am.upRate;
      }
    });
  }, [data, sortMode, haMetrics]);

  const columns = React.useMemo<ColumnDef<Account>[]>(
    () => [
      {
        accessorKey: "stock_name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-2 text-xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            종목
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            {row.original.ticker ? (
              <a
                href={`https://kr.tradingview.com/chart/IG6pTN2y/?symbol=krx%3A${row.original.ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-sm hover:underline"
              >
                {row.original.stock_name ?? "-"}
              </a>
            ) : (
              <p className="font-medium text-sm">{row.original.stock_name ?? "-"}</p>
            )}
            {row.original.ticker ? (
              <a
                href={`https://kr.tradingview.com/chart/IG6pTN2y/?symbol=krx%3A${row.original.ticker}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground text-xs hover:text-foreground hover:underline"
              >
                {row.original.ticker}
              </a>
            ) : (
              <p className="text-muted-foreground text-xs">-</p>
            )}
          </div>
        ),
      },
      {
        id: "chart",
        header: () => <div className="text-center text-xs">차트 (20일)</div>,
        cell: ({ row }) => {
          const ticker = row.original.ticker;
          const points = ticker ? chartData[ticker] : undefined;
          return (
            <div className="flex items-center justify-center py-1">
              {points ? (
                <MiniCandleChart data={points} />
              ) : (
                <div className="h-10 w-30 rounded bg-muted/30 animate-pulse" />
              )}
            </div>
          );
        },
      },
      {
        id: "chart_ha",
        header: () => <div className="text-center text-xs">HA (20일)</div>,
        cell: ({ row }) => {
          const ticker = row.original.ticker;
          const points = ticker ? chartData[ticker] : undefined;
          return (
            <div className="flex items-center justify-center py-1">
              {points ? (
                <MiniCandleChart data={toHeikinAshi(points)} />
              ) : (
                <div className="h-10 w-30 rounded bg-muted/30 animate-pulse" />
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "diff_amt",
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-8 px-2 text-xs"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              오늘
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const val = row.original.diff_amt;
          const rate = row.original.diff_rate;
          const color = cn(
            val != null && val > 0 && "text-red-500",
            val != null && val < 0 && "text-blue-500",
          );
          return (
            <div className="flex flex-col items-end gap-0.5 tabular-nums">
              <p className={cn("text-xs", color)}>
                {val != null ? (val > 0 ? "+" : "") + val.toLocaleString("ko-KR") + "원" : "-"}
              </p>
              {rate != null && (
                <p className={cn("text-xs opacity-60", color)}>
                  ({rate > 0 ? "+" : ""}{rate.toFixed(2)}%)
                </p>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "acc_type",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-8 px-2 text-xs"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            계좌
          </Button>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <p className="text-xs">{row.original.acc_type ?? "-"}</p>
            <p className="text-muted-foreground text-xs">{row.original.acc_no}</p>
          </div>
        ),
      },
      {
        accessorKey: "qty",
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-8 px-2 text-xs"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              수량
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right text-xs tabular-nums">{row.original.qty?.toLocaleString("ko-KR") ?? "-"}</div>
        ),
      },
      {
        accessorKey: "cur_amt",
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-8 px-2 text-xs"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              현재가 / 매입가
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const rate = row.original.earning_rate;
          return (
            <div className="flex flex-col items-end gap-0.5 tabular-nums">
              <p className={cn(
                "text-xs",
                rate != null && rate > 0 && "text-red-500",
                rate != null && rate < 0 && "text-blue-500",
              )}>
                {formatKRW(row.original.cur_amt)}
              </p>
              <p className="text-muted-foreground text-xs">{formatKRW(row.original.avg_amt)}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "eval_amt",
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-8 px-2 text-xs"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              평가금액 / 매입금액
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const rate = row.original.earning_rate;
          return (
            <div className="flex flex-col items-end gap-0.5 tabular-nums">
              <p className={cn(
                "text-xs",
                rate != null && rate > 0 && "text-red-500",
                rate != null && rate < 0 && "text-blue-500",
              )}>
                {formatKRW(row.original.eval_amt)}
              </p>
              <p className="text-muted-foreground text-xs">{formatKRW(row.original.purchase_amt)}</p>
            </div>
          );
        },
      },
      {
        accessorKey: "earning_rate",
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="-mr-2 h-8 px-2 text-xs"
              onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            >
              손익금액
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const val = row.original.earning_rate;
          const earnAmt = (row.original.eval_amt ?? 0) - (row.original.purchase_amt ?? 0);
          const color = cn(
            val != null && val > 0 && "text-red-500",
            val != null && val < 0 && "text-blue-500",
          );
          return (
            <div className="flex flex-col items-end gap-0.5 tabular-nums">
              <p className={cn("text-xs", color)}>
                {(earnAmt > 0 ? "+" : "") + earnAmt.toLocaleString("ko-KR") + "원"}
              </p>
              <p className={cn("text-xs opacity-60", color)}>
                ({formatRate(val)})
              </p>
            </div>
          );
        },
      },
    ],
    [chartData],
  );

  const totalEvalAmt = data.reduce((sum, r) => sum + (r.eval_amt ?? 0), 0);
  const totalPurchaseAmt = data.reduce((sum, r) => sum + (r.purchase_amt ?? 0), 0);
  const totalDiffAmt = data.reduce((sum, r) => sum + (r.diff_amt ?? 0), 0);
  const totalEarnAmt = totalEvalAmt - totalPurchaseAmt;
  const avgEarningRate =
    data.length > 0
      ? data.reduce((sum, r) => sum + (r.earning_rate ?? 0), 0) / data.length
      : 0;
  const avgDiffRate =
    data.length > 0
      ? data.reduce((sum, r) => sum + (r.diff_rate ?? 0), 0) / data.length
      : 0;

  const handleSortModeChange = (mode: SortMode) => {
    setSortMode(mode);
    setSorting([]);
  };

  const handleSortingChange: React.Dispatch<React.SetStateAction<SortingState>> = (updater) => {
    setSorting(updater);
    setSortMode("default");
  };

  const table = useReactTable({
    data: sortedData,
    columns,
    getRowId: (row) => String(row.id),
    state: { sorting, globalFilter },
    onSortingChange: handleSortingChange,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      return (
        (row.original.stock_name ?? "").toLowerCase().includes(search) ||
        (row.original.ticker ?? "").toLowerCase().includes(search)
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>보유 계좌</CardTitle>
        <CardDescription>계좌별 보유 종목 현황 및 손익</CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-medium tabular-nums">
            {data.length}종목
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-4 sm:divide-x sm:divide-border/60">
          <SummaryCard label="총평가금액" value={formatKRW(totalEvalAmt)} />
          <SummaryCard label="총매입금액" value={formatKRW(totalPurchaseAmt)} />
          <SummaryCard
            label="총수익"
            value={formatKRW(totalEarnAmt)}
            sub={formatRate(avgEarningRate)}
            highlight={totalEarnAmt > 0 ? "positive" : totalEarnAmt < 0 ? "negative" : undefined}
          />
          <SummaryCard
            label="오늘손익"
            value={(totalDiffAmt > 0 ? "+" : "") + totalDiffAmt.toLocaleString("ko-KR") + "원"}
            sub={formatRate(avgDiffRate)}
            highlight={totalDiffAmt > 0 ? "positive" : totalDiffAmt < 0 ? "negative" : undefined}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { mode: "default", label: "오늘수익률" },
                { mode: "ha_down_days", label: "HA 연속하락일" },
                { mode: "ha_down_rate", label: "HA 하락율" },
                { mode: "ha_up_days", label: "HA 연속상승일" },
                { mode: "ha_up_rate", label: "HA 상승율" },
              ] as { mode: SortMode; label: string }[]
            ).map(({ mode, label }) => (
              <Button
                key={mode}
                variant={sortMode === mode ? "default" : "outline"}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => handleSortModeChange(mode)}
              >
                {label}
              </Button>
            ))}
          </div>
          <Input
            className="h-7 w-44 text-xs"
            placeholder="종목명 또는 티커 검색..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
          />
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/30">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground text-sm">
                    불러오는 중...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-destructive text-sm">
                    {error}
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground text-sm">
                    데이터가 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: "positive" | "negative";
}) {
  return (
    <div className="flex flex-col gap-1 px-0 sm:px-3 last:sm:pr-0 first:sm:pl-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "font-semibold text-base tabular-nums",
          highlight === "positive" && "text-red-500",
          highlight === "negative" && "text-blue-500",
        )}
      >
        {value}
        {sub && <span className="ml-1 text-xs font-normal opacity-70">({sub})</span>}
      </p>
    </div>
  );
}
