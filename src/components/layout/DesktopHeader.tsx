/* ─── DesktopHeader — Top bar for desktop layout ─────────────── */

import MosaicPattern from "../shared/MosaicPattern";

interface DesktopHeaderProps {
  tab: string;
  pageTitle: Record<string, string | null>;
  profile: any;
  onShowManual: () => void;
}

export default function DesktopHeader({
  tab,
  pageTitle,
  profile,
  onShowManual,
}: DesktopHeaderProps) {
  return (
    <div className="leave-desktop-header relative overflow-hidden">
      <MosaicPattern variant="header" idPrefix="dh" />
      <div className="relative flex items-center justify-between">
        <div>
          <div className="text-white font-bold text-[22px]">
            {tab === "home" ? "หน้าแรก" : pageTitle[tab]}
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
            className="flex items-center gap-2 px-3 py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-xs font-semibold shrink-0 whitespace-nowrap"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            กฏการคำนวณต่างๆ
          </button>
          <div className="text-[13px] text-gold-lt/50">
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
