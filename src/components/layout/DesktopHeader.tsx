/* ─── DesktopHeader — Top bar for desktop layout ─────────────── */

import { IconBook2 } from "@tabler/icons-react";
import { useLocation } from "react-router-dom";
import MosaicPattern from "../shared/MosaicPattern";
import { PAGE_TITLES } from "./navConfig";

interface DesktopHeaderProps {
  profile: any;
  onShowManual: () => void;
}

export default function DesktopHeader({
  profile,
  onShowManual,
}: DesktopHeaderProps) {
  const tab = useLocation().pathname.replace("/", "") || "home";

  return (
    <div className="leave-desktop-header relative overflow-hidden">
      <MosaicPattern variant="header" idPrefix="dh" />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-2xl">
            {tab === "home" ? "หน้าแรก" : PAGE_TITLES[tab]}
          </div>
          {tab === "home" && profile && (
            <div className="text-gold-lt/55 text-sm mt-0.5">
              สวัสดีค่ะ คุณ{profile.name}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onShowManual}
            title="กฏการคำนวณต่างๆ"
            className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-sm font-semibold shrink-0 whitespace-nowrap"
          >
            <IconBook2 size={18} color="#fff" stroke={2.2} />
            กฏการคำนวณต่างๆ
          </button>
          <div className="text-sm text-gold-lt/50">
            {new Date().toLocaleDateString("th-TH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
