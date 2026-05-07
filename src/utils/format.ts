/* ─── Number formatting ────────────────────────────────────────── */

export const formatThaiNumber = (n) =>
  (n || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
