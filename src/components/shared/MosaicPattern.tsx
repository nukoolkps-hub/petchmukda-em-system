/* ─── MosaicPattern — Reusable SVG mosaic decoration ─────────── */

interface MosaicPatternProps {
  /** "sidebar" = tall/repeating, "header" = compact top-bar */
  variant: "sidebar" | "header";
  /** Unique prefix for gradient IDs to avoid SVG conflicts */
  idPrefix?: string;
}

export default function MosaicPattern({
  variant,
  idPrefix = "mp",
}: MosaicPatternProps) {
  const g1 = `${idPrefix}1`;
  const g2 = `${idPrefix}2`;
  const g3 = `${idPrefix}3`;

  if (variant === "sidebar") {
    return (
      <svg
        className="absolute top-0 right-0 h-full w-[70%] pointer-events-none opacity-60"
        viewBox="0 0 220 500"
        preserveAspectRatio="xMaxYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={g1} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#E8C87A" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#C9973A" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id={g2} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#E8C87A" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#9B3030" stopOpacity="0.06" />
          </linearGradient>
        </defs>
        {[0, 80, 160, 240, 320, 400].map((y) => [
          <polygon
            key={`a${y}`}
            points={`80,${y} 140,${y} 110,${y + 40}`}
            fill={`url(#${g1})`}
          />,
          <polygon
            key={`b${y}`}
            points={`140,${y} 220,${y} 220,${y + 55} 175,${y + 30}`}
            fill={`url(#${g2})`}
          />,
          <polygon
            key={`c${y}`}
            points={`110,${y + 40} 175,${y + 30} 160,${y + 75} 95,${y + 70}`}
            fill={`url(#${g1})`}
          />,
        ])}
      </svg>
    );
  }

  // variant === "header"
  return (
    <svg
      className="absolute top-0 right-0 h-full w-[54%] pointer-events-none"
      viewBox="0 0 220 160"
      preserveAspectRatio="xMaxYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={g1} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E8C87A" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#C9973A" stopOpacity="0.06" />
        </linearGradient>
        <linearGradient id={g2} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#E8C87A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#9B3030" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id={g3} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C9973A" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#E8C87A" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      {/* row 0 */}
      <polygon points="110,0 140,0 125,22" fill={`url(#${g2})`} />
      <polygon points="140,0 175,0 175,28 155,14" fill={`url(#${g1})`} />
      <polygon points="175,0 220,0 220,35 195,18" fill={`url(#${g3})`} />
      <polygon
        points="195,18 220,35 220,0"
        fill={`url(#${g2})`}
        opacity="0.5"
      />
      {/* row 1 */}
      <polygon points="110,0 125,22 100,38 85,18" fill={`url(#${g1})`} />
      <polygon points="125,22 155,14 160,40 130,50" fill={`url(#${g3})`} />
      <polygon points="155,14 175,28 170,52 145,44" fill={`url(#${g2})`} />
      <polygon points="175,28 195,18 210,48 185,58" fill={`url(#${g1})`} />
      <polygon points="195,18 220,35 220,62 205,55" fill={`url(#${g3})`} />
      {/* row 2 */}
      <polygon points="85,18 100,38 80,56 65,38" fill={`url(#${g3})`} />
      <polygon points="100,38 130,50 118,72 92,62" fill={`url(#${g2})`} />
      <polygon points="130,50 145,44 158,68 138,78" fill={`url(#${g1})`} />
      <polygon points="145,44 170,52 168,76 148,82" fill={`url(#${g3})`} />
      <polygon points="170,52 185,58 188,82 168,76" fill={`url(#${g2})`} />
      <polygon points="185,58 205,55 215,80 192,88" fill={`url(#${g1})`} />
      <polygon points="205,55 220,62 220,90 210,84" fill={`url(#${g3})`} />
      {/* row 3 */}
      <polygon points="65,38 80,56 68,76 52,58" fill={`url(#${g2})`} />
      <polygon points="80,56 92,62 88,84 72,78" fill={`url(#${g1})`} />
      <polygon points="92,62 118,72 110,96 88,84" fill={`url(#${g3})`} />
      <polygon points="118,72 138,78 132,102 112,96" fill={`url(#${g2})`} />
      <polygon
        points="138,78 148,82 150,106 134,102"
        fill={`url(#${g1})`}
      />
      <polygon
        points="148,82 168,76 172,100 150,106"
        fill={`url(#${g3})`}
      />
      <polygon
        points="168,76 188,82 188,108 170,104"
        fill={`url(#${g2})`}
      />
      <polygon
        points="188,82 192,88 220,95 220,118 192,112"
        fill={`url(#${g1})`}
      />
      {/* row 4 */}
      <polygon points="52,58 68,76 55,98 40,78" fill={`url(#${g1})`} />
      <polygon points="68,76 72,78 75,102 58,98" fill={`url(#${g3})`} />
      <polygon points="72,78 88,84 88,108 70,104" fill={`url(#${g2})`} />
      <polygon points="88,84 110,96 105,120 85,110" fill={`url(#${g1})`} />
      <polygon
        points="110,96 112,96 118,120 102,124"
        fill={`url(#${g3})`}
      />
      <polygon
        points="112,96 132,102 128,126 112,124"
        fill={`url(#${g2})`}
      />
      <polygon
        points="132,102 150,106 148,130 130,128"
        fill={`url(#${g1})`}
      />
      <polygon
        points="150,106 170,104 172,128 150,130"
        fill={`url(#${g3})`}
      />
      <polygon
        points="170,104 188,108 190,132 172,128"
        fill={`url(#${g2})`}
      />
      <polygon
        points="188,108 220,118 220,142 192,136"
        fill={`url(#${g1})`}
      />
      {/* row 5 – bottom fade */}
      <polygon
        points="40,78 55,98 45,118 30,100"
        fill={`url(#${g3})`}
        opacity="0.6"
      />
      <polygon
        points="55,98 58,98 60,120 45,118"
        fill={`url(#${g2})`}
        opacity="0.6"
      />
      <polygon
        points="58,98 70,104 68,128 52,120"
        fill={`url(#${g1})`}
        opacity="0.6"
      />
      <polygon
        points="70,104 85,110 82,134 65,128"
        fill={`url(#${g3})`}
        opacity="0.55"
      />
      <polygon
        points="85,110 102,124 98,148 80,138"
        fill={`url(#${g2})`}
        opacity="0.5"
      />
      <polygon
        points="102,124 128,126 122,150 100,148"
        fill={`url(#${g1})`}
        opacity="0.45"
      />
      <polygon
        points="128,126 148,130 144,154 126,150"
        fill={`url(#${g3})`}
        opacity="0.4"
      />
      <polygon
        points="148,130 172,128 170,155 148,158"
        fill={`url(#${g2})`}
        opacity="0.35"
      />
      <polygon
        points="172,128 192,136 190,158 170,160"
        fill={`url(#${g1})`}
        opacity="0.3"
      />
      <polygon
        points="192,136 220,142 220,160 192,160"
        fill={`url(#${g3})`}
        opacity="0.25"
      />
      {/* subtle edge shimmer */}
      <polygon
        points="200,0 220,0 220,20"
        fill="#E8C87A"
        opacity="0.12"
      />
      <line
        x1="110"
        y1="0"
        x2="220"
        y2="80"
        stroke="#E8C87A"
        strokeWidth="0.4"
        opacity="0.15"
      />
      <line
        x1="130"
        y1="0"
        x2="220"
        y2="60"
        stroke="#E8C87A"
        strokeWidth="0.3"
        opacity="0.10"
      />
    </svg>
  );
}
