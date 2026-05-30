/* ─── MosaicPattern — Organic blob decoration ────────────────────
   Each blob = filled body + offset outline (hand-drawn feel).
   Sidebar + Header use the same palette + style so the two surfaces
   read as one continuous L-shape.                                   */

interface MosaicPatternProps {
  /** "sidebar" = vertical column, "header" = wide top bar */
  variant: "sidebar" | "header";
  /** Unused — kept for backwards compat */
  idPrefix?: string;
}

const C = {
  goldFill: "#E8C87A",
  goldStroke: "#C9973A",
  creamFill: "#F5E6C8",
  maroonAccent: "#9B3030",
  maroonDeep: "#5C1212",
};

interface Blob {
  fill: string;
  stroke: string;
  fillOpacity: number;
  strokeOpacity: number;
  body: string;
  outline: string;
}

/* Sidebar viewBox: 0 0 260 900 (tall) */
const SIDEBAR_BLOBS: Blob[] = [
  // 1) top-left large gold — anchors the corner toward header
  {
    fill: C.goldFill,
    stroke: C.goldStroke,
    fillOpacity: 0.34,
    strokeOpacity: 0.55,
    body: "M 70 20 Q 170 5, 195 90 Q 215 175, 130 210 Q 35 220, 10 130 Q -5 50, 70 20 Z",
    outline:
      "M 68 14 Q 175 0, 202 92 Q 220 180, 132 218 Q 30 226, 4 132 Q -10 48, 68 14 Z",
  },
  // 2) top-right small cream
  {
    fill: C.creamFill,
    stroke: C.goldStroke,
    fillOpacity: 0.22,
    strokeOpacity: 0.40,
    body: "M 215 30 Q 260 25, 265 75 Q 268 120, 225 125 Q 190 118, 195 80 Q 200 45, 215 30 Z",
    outline:
      "M 213 24 Q 264 19, 270 76 Q 273 124, 226 132 Q 184 122, 190 79 Q 197 40, 213 24 Z",
  },
  // 3) middle large gold
  {
    fill: C.goldFill,
    stroke: C.goldStroke,
    fillOpacity: 0.28,
    strokeOpacity: 0.45,
    body: "M 50 310 Q 160 295, 200 380 Q 215 470, 130 490 Q 30 495, 5 410 Q -10 340, 50 310 Z",
    outline:
      "M 46 304 Q 165 290, 205 384 Q 220 476, 131 496 Q 26 502, 0 412 Q -16 338, 46 304 Z",
  },
  // 4) middle-right small maroon accent
  {
    fill: C.maroonAccent,
    stroke: C.maroonDeep,
    fillOpacity: 0.32,
    strokeOpacity: 0.35,
    body: "M 220 520 Q 268 515, 272 565 Q 275 615, 230 622 Q 195 615, 198 575 Q 202 535, 220 520 Z",
    outline:
      "M 218 514 Q 272 510, 276 564 Q 280 620, 232 628 Q 192 622, 195 575 Q 198 532, 218 514 Z",
  },
  // 5) bottom large cream
  {
    fill: C.creamFill,
    stroke: C.goldStroke,
    fillOpacity: 0.25,
    strokeOpacity: 0.40,
    body: "M 60 720 Q 175 705, 215 800 Q 230 880, 140 900 Q 40 910, 12 820 Q -5 750, 60 720 Z",
    outline:
      "M 56 712 Q 180 700, 220 802 Q 234 886, 142 906 Q 36 916, 8 820 Q -10 746, 56 712 Z",
  },
];

/* Header viewBox: 0 0 1200 80 (wide).
   Left-most blob is partial (extends off the left edge) so it visually
   continues from the sidebar's top blob.                              */
const HEADER_BLOBS: Blob[] = [
  // 1) far-left large gold — continues from sidebar
  {
    fill: C.goldFill,
    stroke: C.goldStroke,
    fillOpacity: 0.30,
    strokeOpacity: 0.50,
    body: "M -30 -10 Q 80 -20, 130 30 Q 145 70, 80 92 Q -20 96, -50 50 Q -55 15, -30 -10 Z",
    outline:
      "M -34 -16 Q 84 -26, 134 30 Q 150 76, 80 98 Q -26 104, -56 50 Q -60 12, -34 -16 Z",
  },
  // 2) center-left medium cream
  {
    fill: C.creamFill,
    stroke: C.goldStroke,
    fillOpacity: 0.22,
    strokeOpacity: 0.40,
    body: "M 280 -10 Q 380 -15, 420 30 Q 430 70, 360 88 Q 280 92, 255 50 Q 250 10, 280 -10 Z",
    outline:
      "M 276 -16 Q 384 -22, 425 30 Q 436 74, 360 94 Q 274 98, 250 52 Q 246 8, 276 -16 Z",
  },
  // 3) center small gold
  {
    fill: C.goldFill,
    stroke: C.goldStroke,
    fillOpacity: 0.20,
    strokeOpacity: 0.38,
    body: "M 580 -8 Q 650 -10, 670 30 Q 680 70, 620 85 Q 560 80, 555 45 Q 555 12, 580 -8 Z",
    outline:
      "M 576 -14 Q 654 -16, 674 30 Q 684 74, 620 90 Q 552 86, 550 46 Q 550 10, 576 -14 Z",
  },
  // 4) right medium maroon accent
  {
    fill: C.maroonAccent,
    stroke: C.maroonDeep,
    fillOpacity: 0.22,
    strokeOpacity: 0.30,
    body: "M 870 -10 Q 970 -15, 1010 30 Q 1025 70, 940 88 Q 860 92, 845 50 Q 845 15, 870 -10 Z",
    outline:
      "M 866 -16 Q 974 -22, 1016 32 Q 1030 74, 942 94 Q 856 98, 840 50 Q 840 12, 866 -16 Z",
  },
  // 5) far-right cream
  {
    fill: C.creamFill,
    stroke: C.goldStroke,
    fillOpacity: 0.22,
    strokeOpacity: 0.36,
    body: "M 1150 0 Q 1230 -5, 1255 40 Q 1262 80, 1200 90 Q 1140 84, 1135 45 Q 1135 14, 1150 0 Z",
    outline:
      "M 1146 -6 Q 1234 -12, 1262 40 Q 1268 84, 1202 96 Q 1132 92, 1130 46 Q 1130 10, 1146 -6 Z",
  },
];

function renderBlob(b: Blob, key: number) {
  return (
    <g key={key}>
      <path d={b.body} fill={b.fill} fillOpacity={b.fillOpacity} />
      <path
        d={b.outline}
        fill="none"
        stroke={b.stroke}
        strokeWidth="0.8"
        strokeOpacity={b.strokeOpacity}
      />
    </g>
  );
}

export default function MosaicPattern({ variant }: MosaicPatternProps) {
  if (variant === "sidebar") {
    return (
      <svg
        className="absolute inset-0 h-full w-full pointer-events-none"
        viewBox="0 0 260 900"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        {SIDEBAR_BLOBS.map(renderBlob)}
      </svg>
    );
  }

  // variant === "header"
  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      viewBox="0 0 1200 80"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {HEADER_BLOBS.map(renderBlob)}
    </svg>
  );
}
