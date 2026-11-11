export type OHLCVBar = {
  date: string;   // YYYYMMDD
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type KisChartItem = {
  stck_bsop_date: string;
  stck_oprc: string;
  stck_hgpr: string;
  stck_lwpr: string;
  stck_clpr: string;
  acml_vol: string;
};

export type KisChartResponse = {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
  output1: {
    hts_kor_isnm: string;
    stck_prpr: string;
  };
  output2: KisChartItem[];
};
