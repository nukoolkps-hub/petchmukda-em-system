/* ─── MobileHeader — Mobile top header with profile strip ────── */

import { useLocation } from "react-router-dom";
import { C } from "../../constants";
import AvatarCircle from "../shared/AvatarCircle";
import Diamond from "../shared/Diamond";
import MosaicPattern from "../shared/MosaicPattern";
import { PAGE_TITLES } from "./navConfig";

interface MobileHeaderProps {
  profile: any;
  holding: boolean;
  onEditProfile: () => void;
  onShowManual: () => void;
  startHold: () => void;
  endHold: () => void;
  onRingComplete: () => void;
}

export default function MobileHeader({
  profile,
  holding,
  onEditProfile,
  onShowManual,
  startHold,
  endHold,
  onRingComplete,
}: MobileHeaderProps) {
  const tab = useLocation().pathname.replace("/", "") || "home";

  return (
    <div className="leave-header-mobile bg-gradient-to-br from-maroon-dk via-maroon to-maroon-lt pt-5 px-5 pb-0 shrink-0 relative overflow-hidden">
      {/* Mosaic decoration */}
      <MosaicPattern variant="header" idPrefix="mg" />

      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2.5">
          {tab === "home" ? (
            <div className="flex items-center gap-2.5 select-none">
              {/* Long-press ONLY on diamond */}
              <div
                onMouseDown={startHold}
                onMouseUp={endHold}
                onMouseLeave={endHold}
                onTouchStart={startHold}
                onTouchEnd={endHold}
                className="relative w-8 h-8 flex items-center justify-center cursor-pointer shrink-0"
              >
                {holding && (
                  <svg
                    className="absolute -inset-2 w-12 h-12 pointer-events-none"
                    viewBox="0 0 48 48"
                  >
                    <circle
                      cx="24"
                      cy="24"
                      r="21"
                      fill="none"
                      stroke={C.goldLt}
                      strokeWidth="3"
                      strokeOpacity="0.2"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="21"
                      fill="none"
                      stroke={C.goldLt}
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="131.95"
                      strokeDashoffset="131.95"
                      transform="rotate(-90 24 24)"
                      onAnimationEnd={onRingComplete}
                      className="animate-[ringFill_5s_linear_forwards]"
                    />
                  </svg>
                )}
                <Diamond size={20} color={holding ? "#fff" : C.goldLt} />
              </div>
              <div>
                <div className="text-gold-lt font-extrabold text-lg leading-none tracking-tight">
                  ห้างเพชรทองมุกดา
                </div>
                <div className="text-gold-lt/50 text-[11px] tracking-wider mt-px">
                  ระบบพนักงาน
                </div>
              </div>
            </div>
          ) : (
            <div className="text-white font-bold text-[19px]">
              {PAGE_TITLES[tab]}
            </div>
          )}
        </div>
        {tab === "home" && (
          <button
            onClick={onShowManual}
            title="กฏการคำนวณต่างๆ"
            className="flex items-center gap-1.5 px-[11px] py-[7px] rounded-[10px] border border-gold-lt/25 bg-white/12 cursor-pointer text-white font-[inherit] text-[11px] font-semibold shrink-0 whitespace-nowrap"
          >
            <svg
              width="16"
              height="16"
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
            กฏการคำนวณ
          </button>
        )}
        {tab !== "home" && <div className="w-9 h-9" />}
      </div>

      {/* profile strip */}
      {tab === "home" && (
        <div className="flex items-center gap-3.5 mb-4.5 relative">
          {profile ? (
            <button
              onClick={onEditProfile}
              className="bg-transparent border-none p-0 cursor-pointer flex items-center gap-3.5 flex-1"
            >
              <AvatarCircle
                av={profile.av}
                avType={profile.avType}
                img={profile.img}
                size={56}
                fontSize={18}
                border={`2.5px solid ${C.goldLt}50`}
              />
              <div className="text-left">
                <div className="text-gold-lt/50 text-[13px]">สวัสดีค่ะ</div>
                <div className="text-white font-bold text-xl leading-[1.15]">
                  {profile.name}
                </div>
                <div className="text-gold-lt/55 text-[13px] mt-0.5">
                  {profile.role}
                </div>
              </div>
              <div className="ml-auto w-10 h-10 rounded-[10px] bg-gold-lt/13 flex items-center justify-center shrink-0">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            </button>
          ) : (
            <button
              onClick={onEditProfile}
              className="flex items-center gap-3 bg-white/12 border-[1.5px] border-dashed border-gold-lt/37 rounded-[14px] px-4 py-3 cursor-pointer flex-1 font-[inherit]"
            >
              <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center text-[22px]">
                👤
              </div>
              <div className="text-left">
                <div className="text-gold-lt font-bold text-[15px]">
                  ตั้งค่าโปรไฟล์ของคุณ
                </div>
                <div className="text-gold-lt/50 text-xs mt-0.5">
                  กรอกชื่อและเลือกรูปโปรไฟล์
                </div>
              </div>
            </button>
          )}
        </div>
      )}
      {tab !== "home" && <div className="h-2" />}
      <div className="h-0.5 bg-gold-divider" />
    </div>
  );
}
