import { kisGet } from "./client";
import type { KisChartResponse, OHLCVBar } from "./types";

const CHART_PATH = "/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice";

function toDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

async function fetchChartPage(
  ticker: string,
  startDate: string,
  endDate: string,
  periodCode: "D" | "W" | "M",
): Promise<OHLCVBar[]> {
  const data = await kisGet<KisChartResponse>(
    CHART_PATH,
    {
      FID_COND_MRKT_DIV_CODE: "J",
      FID_INPUT_ISCD: ticker,
      FID_INPUT_DATE_1: startDate,
      FID_INPUT_DATE_2: endDate,
      FID_PERIOD_DIV_CODE: periodCode,
      FID_ORG_ADJ_PRC: "1",
    },
    "FHKST03010100",
  );

  if (data.rt_cd !== "0") throw new Error(`KIS chart error: ${data.msg1}`);

  return (data.output2 ?? []).map((item) => ({
    date: item.stck_bsop_date,
    open: Number(item.stck_oprc),
    high: Number(item.stck_hgpr),
    low: Number(item.stck_lwpr),
    close: Number(item.stck_clpr),
    volume: Number(item.acml_vol),
  }));
}

/** 주봉 데이터를 최대 100건(약 2년) 1회 호출로 가져옵니다. */
export async function fetchWeeklyChart(ticker: string): Promise<OHLCVBar[]> {
  const bars = await fetchChartPage(ticker, toDate(730), toDate(0), "W");
  return bars.sort((a, b) => a.date.localeCompare(b.date));
}
