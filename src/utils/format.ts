/* ─── Number formatting ────────────────────────────────────────── */

export const TH_NUMBER = (n) =>
  (n||0).toLocaleString("th-TH",{minimumFractionDigits:0,maximumFractionDigits:2});
