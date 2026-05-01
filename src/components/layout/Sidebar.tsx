/* ─── Sidebar — Desktop navigation (≥768px) ─────────────────── */

import { useLocation, useNavigate } from "react-router-dom";
import { C } from "../../constants";
import AvatarCircle from "../shared/AvatarCircle";
import Diamond from "../shared/Diamond";
import MosaicPattern from "../shared/MosaicPattern";
import type { NavItem } from "./navConfig";

interface SidebarProps {
  profile: any;
  navItems: NavItem[];
  holding: boolean;
  onEditProfile: () => void;
  onSignOut: () => void;
  startHold: () => void;
  endHold: () => void;
  onRingComplete: () => void;
}

export default function Sidebar({
  profile,
  navItems,
  holding,
  onEditProfile,
  onSignOut,
  startHold,
  endHold,
  onRingComplete,
}: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const currentPath = location.pathname;

  return (
    <div className="leave-sidebar">
      {/* Mosaic bg */}
      <MosaicPattern variant="sidebar" idPrefix="sg" />

      {/* Brand */}
      <div className="leave-sidebar-profile relative">
        <div className="flex items-center gap-2.5 mb-4">
          {/* Long-press target */}
          <div
            onMouseDown={startHold}
            onMouseUp={endHold}
            onMouseLeave={endHold}
            onTouchStart={startHold}
            onTouchEnd={endHold}
            className="relative w-7 h-7 flex items-center justify-center cursor-default select-none shrink-0"
          >
            {holding && (
              <svg
                className="absolute -inset-2 w-11 h-11 pointer-events-none"
                viewBox="0 0 44 44"
              >
                <circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill="none"
                  stroke={C.goldLt}
                  strokeWidth="2.5"
                  strokeOpacity="0.25"
                />
                <circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill="none"
                  stroke={C.goldLt}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="119.38"
                  strokeDashoffset="119.38"
                  transform="rotate(-90 22 22)"
                  onAnimationEnd={onRingComplete}
                  className="animate-[ringFillSide_5s_linear_forwards]"
                />
              </svg>
            )}
            <Diamond size={18} color={holding ? "#fff" : C.goldLt} />
          </div>
          <div>
            <div className="text-gold-lt font-extrabold text-base leading-none">
              ห้างเพชรทองมุกดา
            </div>
            <div className="text-gold-lt/45 text-[11px] mt-0.5">ระบบพนักงาน</div>
          </div>
        </div>
        {/* Profile */}
        {profile && (
          <button
            onClick={onEditProfile}
            className="flex items-center gap-3 bg-white/8 border border-gold-lt/15 rounded-[14px] px-3.5 py-2.5 w-full cursor-pointer font-[inherit] transition-all duration-200"
          >
            <AvatarCircle
              av={profile.av}
              avType={profile.avType}
              img={profile.img}
              size={40}
              fontSize={14}
              border={`2px solid ${C.goldLt}50`}
            />
            <div className="text-left flex-1 min-w-0">
              <div className="text-white font-bold text-sm truncate">
                {profile.name}
              </div>
              <div className="text-gold-lt/50 text-xs mt-px">
                {profile.role}
              </div>
            </div>
            <div className="shrink-0 w-9 h-9 rounded-[9px] bg-gold-lt/15 flex items-center justify-center">
              <svg
                width="20"
                height="20"
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
        )}
        {!profile && (
          <button
            onClick={onEditProfile}
            className="flex items-center gap-2.5 bg-white/8 border-[1.5px] border-dashed border-gold-lt/30 rounded-[14px] px-3.5 py-2.5 w-full cursor-pointer font-[inherit]"
          >
            <span className="text-[22px]">👤</span>
            <span className="text-gold-lt text-sm font-semibold">
              ตั้งค่าโปรไฟล์
            </span>
          </button>
        )}
      </div>

      {/* Nav */}
      <div className="leave-sidebar-nav">
        {navItems.map((n) => {
          const active = currentPath === n.path;
          return (
            <button
              key={n.id}
              onClick={() => navigate(n.path)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 relative ${active ? "bg-white/12" : "bg-transparent"} ${active ? "text-gold-lt" : "text-white/55"}`}
            >
              <span>{n.icon(active)}</span>
              <span>{n.label}</span>
              {active && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold" />
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="leave-sidebar-footer relative">
        <button
          onClick={onSignOut}
          className="w-full px-4 py-2.5 rounded-[10px] border border-white/15 bg-white/6 text-white/50 cursor-pointer font-[inherit] text-[13px] font-medium flex items-center justify-center gap-2 transition-all duration-200 mb-3 hover:bg-white/12 hover:text-white/80"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          ออกจากระบบ
        </button>
        <div className="text-[11px] text-white/25 text-center">
          Haangpetchthongmukda Co., Ltd
        </div>
      </div>
    </div>
  );
}
