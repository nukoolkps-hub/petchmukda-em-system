/* ─── MemphisPattern — พื้นหลังลาย Memphis สำหรับ header/sidebar ────
   **กฎข้อเดียวของไฟล์นี้: ลายต้องไม่แย่งสายตากับตัวหนังสือ**
   ของเดิมเป็นรูปทรงชิ้นใหญ่ (วงกลม 40px · zigzag · สามเหลี่ยม) กระจายทับ
   ตำแหน่งข้อความพอดี opacity 0.35-0.55 → หัวข้อกับวันที่อ่านยาก
   ตอนนี้เปลี่ยนเป็น **ลายซ้ำชิ้นเล็ก (tiling pattern)** ที่ตาอ่านเป็น
   "พื้นผิว" ไม่ใช่ "วัตถุ" — ยังคงคำศัพท์ Memphis เดิม (วงแหวน · กากบาท ·
   ซิกแซก · จุด) แต่ย่อขนาดลงเหลือ ~4px แล้วลด opacity เหลือ ~0.13
   + `scrim` ไล่เฉดเข้มที่ขอบซ้าย/ขวาของ header ซึ่งเป็นที่อยู่ของหัวข้อและ
   ปุ่ม → ตัวหนังสือลอยขึ้นมาจากพื้นชัดขึ้น ส่วนตรงกลางยังเห็นลายเต็มๆ

   เพิ่ม/แก้ลาย: ย่อให้เล็กและจางไว้ก่อนเสมอ — ถ้าลายเริ่ม "อ่านออกว่าเป็นรูป
   อะไร" ตอนมองผ่านๆ แปลว่าใหญ่/เข้มเกินไปแล้ว                            */

import { useId } from "react";

interface MemphisPatternProps {
  /** "sidebar" = vertical column, "header" = wide top bar */
  variant: "sidebar" | "header";
  /** Unused — kept for backwards compat */
  idPrefix?: string;
}

const C = {
  gold: "#E8C87A",
  goldDeep: "#C9973A",
  cream: "#F5E6C8",
  maroonDeep: "#5C1212",
  /** เข้มกว่า maroon-dk เล็กน้อย — ใช้เป็น scrim ไล่เฉดหลังตัวหนังสือ */
  maroonScrim: "#4A0E0E",
};

/* Shape primitives — each returns SVG <path>/<g> ready to render */

function Dot({
  cx,
  cy,
  r,
  fill,
  opacity = 0.45,
}: {
  cx: number;
  cy: number;
  r: number;
  fill: string;
  opacity?: number;
}) {
  return <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={opacity} />;
}

function Ring({
  cx,
  cy,
  r,
  stroke,
  opacity = 0.5,
  width = 1.2,
}: {
  cx: number;
  cy: number;
  r: number;
  stroke: string;
  opacity?: number;
  width?: number;
}) {
  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeOpacity={opacity}
    />
  );
}

function Triangle({
  cx,
  cy,
  size,
  rotate = 0,
  fill,
  opacity = 0.4,
}: {
  cx: number;
  cy: number;
  size: number;
  rotate?: number;
  fill: string;
  opacity?: number;
}) {
  const h = size * 0.866;
  const points = `${cx},${cy - h * 0.6} ${cx - size / 2},${cy + h * 0.4} ${cx + size / 2},${cy + h * 0.4}`;
  return (
    <polygon
      points={points}
      fill={fill}
      fillOpacity={opacity}
      transform={`rotate(${rotate} ${cx} ${cy})`}
    />
  );
}

function Zigzag({
  x,
  y,
  step = 8,
  segments = 4,
  amp = 5,
  stroke,
  opacity = 0.5,
  width = 1.6,
  rotate = 0,
}: {
  x: number;
  y: number;
  step?: number;
  segments?: number;
  amp?: number;
  stroke: string;
  opacity?: number;
  width?: number;
  rotate?: number;
}) {
  const pts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const px = x + i * step;
    const py = y + (i % 2 === 0 ? 0 : amp);
    pts.push(`${px},${py}`);
  }
  const cx = x + (segments * step) / 2;
  const cy = y + amp / 2;
  return (
    <polyline
      points={pts.join(" ")}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeLinejoin="round"
      strokeLinecap="round"
      transform={`rotate(${rotate} ${cx} ${cy})`}
    />
  );
}

/* ─── ลายซ้ำชิ้นเล็ก (ใช้ร่วมทั้ง header + sidebar) ───────────────
   tile 46×46 px · ไม่มี viewBox บน <svg> → 1 user unit = 1 CSS px
   ชิ้นในลายวางห่างขอบ tile → ต่อกันแล้วไม่มีรอยต่อ                     */
function MicroTexture({ id }: { id: string }) {
  return (
    <pattern id={id} width={46} height={46} patternUnits="userSpaceOnUse">
      <g
        stroke={C.gold}
        strokeOpacity={0.13}
        strokeWidth={1.1}
        strokeLinecap="round"
        fill="none"
      >
        {/* วงแหวน · ซิกแซกจิ๋ว · กากบาท — ย่อจากชุดเดิม */}
        <circle cx={11} cy={11} r={3.4} />
        <path d="M30 8 l4 3 l4 -3" />
        <line x1={33} y1={30} x2={39} y2={30} />
        <line x1={36} y1={27} x2={36} y2={33} />
      </g>
      <g fill={C.cream} fillOpacity={0.15}>
        <circle cx={24} cy={21} r={1.5} />
        <circle cx={9} cy={35} r={1.5} />
        <circle cx={20} cy={41} r={1.1} />
      </g>
    </pattern>
  );
}

/* ─── Card corner sticker — Light Memphis accent for content cards
   Use inside a `relative overflow-hidden` parent. Defaults to gold
   tones for use on white/cream surfaces.                            */
export function MemphisCornerSticker({
  position = "tr",
  tone = "gold",
}: {
  position?: "tr" | "tl" | "br" | "bl";
  tone?: "gold" | "maroon";
}) {
  const stroke = tone === "gold" ? C.goldDeep : C.maroonDeep;
  const fill = tone === "gold" ? C.gold : C.maroonDeep;
  const pos =
    position === "tr"
      ? "top-0 right-0"
      : position === "tl"
        ? "top-0 left-0 scale-x-[-1]"
        : position === "br"
          ? "bottom-0 right-0 scale-y-[-1]"
          : "bottom-0 left-0 scale-x-[-1] scale-y-[-1]";
  return (
    <svg
      className={`absolute ${pos} w-14 h-12 pointer-events-none`}
      viewBox="0 0 56 48"
      xmlns="http://www.w3.org/2000/svg"
    >
      <Ring cx={42} cy={10} r={8} stroke={stroke} opacity={0.22} width={1.4} />
      <Zigzag
        x={6}
        y={14}
        segments={3}
        step={6}
        amp={4}
        stroke={stroke}
        opacity={0.28}
        width={1.4}
      />
      <Dot cx={18} cy={32} r={2} fill={fill} opacity={0.3} />
      <Dot cx={28} cy={38} r={1.5} fill={fill} opacity={0.25} />
      <Triangle
        cx={46}
        cy={34}
        size={6}
        rotate={20}
        fill={fill}
        opacity={0.22}
      />
    </svg>
  );
}

export default function MemphisPattern({ variant }: MemphisPatternProps) {
  // header ของ desktop กับ mobile อยู่ใน DOM พร้อมกัน (สลับกันด้วย CSS
  // display เฉยๆ) → id ของ <pattern> ต้องไม่ชนกัน ไม่งั้น url(#..) ของ
  // ตัวหลังจะไปอ้างของตัวแรก · ตัด ":" ออกเพราะใช้ใน url(#..) ไม่ได้
  const uid = useId().replace(/:/g, "");
  const texId = `memphis-tex-${uid}`;
  const scrimId = `memphis-scrim-${uid}`;

  return (
    <svg
      className="absolute inset-0 h-full w-full pointer-events-none"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <MicroTexture id={texId} />
        {/* scrim เฉพาะ header — ขอบซ้าย (หัวข้อ) และขวา (ปุ่ม + วันที่)
            เข้มขึ้น ให้ตัวหนังสืออ่านง่าย · sidebar ไม่ต้องเพราะเมนูไล่ลง
            ทั้งคอลัมน์ ไม่มีโซนว่างให้เว้น */}
        {variant === "header" && (
          <linearGradient id={scrimId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor={C.maroonScrim} stopOpacity={0.7} />
            <stop offset="0.34" stopColor={C.maroonScrim} stopOpacity={0} />
            <stop offset="0.55" stopColor={C.maroonScrim} stopOpacity={0} />
            <stop offset="1" stopColor={C.maroonScrim} stopOpacity={0.66} />
          </linearGradient>
        )}
      </defs>
      <rect width="100%" height="100%" fill={`url(#${texId})`} />
      {variant === "header" && (
        <rect width="100%" height="100%" fill={`url(#${scrimId})`} />
      )}
    </svg>
  );
}
