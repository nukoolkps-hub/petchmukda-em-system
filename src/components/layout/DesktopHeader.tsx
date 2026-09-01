/* ─── DesktopHeader — Top bar for desktop layout ─────────────── */

import {
  BookOpen as IconBook2,
  Eye as IconEye,
  FileText as IconFileText,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import MemphisPattern from "../shared/MemphisPattern";
import { PAGE_TITLES } from "./navConfig";

interface DesktopHeaderProps {
  profile: any;
  isAdmin?: boolean;
  onShowManual: () => void;
  /** admin (จริง · ยังไม่ preview) → ปุ่ม "ดูมุมมองพนักงาน" ข้างปุ่มคู่มือ */
  onPreviewEmployee?: () => void;
}

export default function DesktopHeader({
  profile,
  isAdmin = false,
  onShowManual,
  onPreviewEmployee,
}: DesktopHeaderProps) {
  const tab = useLocation().pathname.replace("/", "") || "home";

  return (
    <div className="leave-desktop-header relative overflow-hidden">
      <MemphisPattern variant="header" />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-2xl">
            {tab === "home" ? "หน้าแรก" : PAGE_TITLES[tab]}
          </div>
          {/* subtitle — แสดงทุก tab เพื่อให้ banner สูงเท่ากันเสมอ ไม่ขยับตอนสลับ sidebar */}
          {isAdmin ? (
            <div className="text-gold-lt/55 text-sm mt-0.5">ผู้ดูแลระบบ</div>
          ) : (
            <div className="text-gold-lt/55 text-sm mt-0.5">
              สวัสดีค่ะ คุณ{profile?.name || ""}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          {/* ใบรับรองเงินเดือน — ต้องมีคู่กับ MobileHeader เสมอ · ปุ่มนี้เคย
              อยู่แต่ใน MobileHeader ซึ่ง desktop ซ่อนด้วย CSS
              (`.leave-header-mobile { display: none }`) → พนักงานที่เข้าจาก PC
              หาปุ่มไม่เจอเลย · มีเทสต์ `headerActionParity.test.ts` กันหายอีก */}
          {tab === "salary" && (
            <button
              onClick={() =>
                window.dispatchEvent(new CustomEvent("openSalaryCert"))
              }
              title="พิมพ์ใบรับรองเงินเดือน"
              className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-sm font-semibold shrink-0 whitespace-nowrap"
            >
              <IconFileText size={18} color="#fff" strokeWidth={2.2} />
              ใบรับรอง
            </button>
          )}
          {onPreviewEmployee && (
            <button
              onClick={onPreviewEmployee}
              title="ดูมุมมองพนักงาน"
              className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-sm font-semibold shrink-0 whitespace-nowrap"
            >
              <IconEye size={18} color="#fff" strokeWidth={2.2} />
              ดูมุมมองพนักงาน
            </button>
          )}
          <button
            onClick={onShowManual}
            title="คู่มือการใช้งาน"
            className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-sm font-semibold shrink-0 whitespace-nowrap"
          >
            <IconBook2 size={18} color="#fff" strokeWidth={2.2} />
            คู่มือการใช้งาน
          </button>
          <div className="text-sm text-gold-lt/50">
            {new Intl.DateTimeFormat("th-TH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })
              .formatToParts(new Date())
              .map((p) => (p.type === "year" ? `พ.ศ. ${p.value}` : p.value))
              .join("")}
          </div>
        </div>
      </div>
    </div>
  );
}
