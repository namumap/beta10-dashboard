"use client";

import { useSearchParams } from "next/navigation";
import { TickerForm } from "./ticker-form";
import { WeeklyChart } from "./weekly-chart";

export function AnalysisView() {
  const ticker = useSearchParams().get("ticker") ?? "";

  return (
    <>
      <TickerForm initialTicker={ticker} />
      {ticker && <WeeklyChart ticker={ticker} />}
    </>
  );
}
