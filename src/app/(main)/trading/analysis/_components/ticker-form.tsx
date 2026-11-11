"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function TickerForm({ initialTicker = "" }: { initialTicker?: string }) {
  const router = useRouter();
  const [ticker, setTicker] = React.useState(initialTicker);

  React.useEffect(() => {
    setTicker(initialTicker);
  }, [initialTicker]);

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const value = ticker.trim();
    if (!value) return;
    router.push(`/trading/analysis?ticker=${encodeURIComponent(value)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        className="h-9 w-40 font-mono text-sm"
        placeholder="티커 (예: 005630)"
        value={ticker}
        onChange={(e) => setTicker(e.target.value.toUpperCase())}
      />
      <Button type="submit" size="sm">
        분석
      </Button>
    </form>
  );
}
