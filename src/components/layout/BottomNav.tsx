/* ─── BottomNav — Mobile bottom tab bar ──────────────────────── */

import type { NavItem } from "./navConfig";

interface BottomNavProps {
  navItems: NavItem[];
  tab: string;
  onTabChange: (id: string) => void;
}

export default function BottomNav({
  navItems,
  tab,
  onTabChange,
}: BottomNavProps) {
  return (
    <div className="leave-bottom-nav bg-white border-t border-bdr shadow-[0_-4px_20px_rgba(90,30,10,0.10)] z-[100]">
      {navItems.map((n) => {
        const active = tab === n.id,
          isAdminTab = n.id === "admin";
        return (
          <button
            key={n.id}
            onClick={() => onTabChange(n.id)}
            className={`flex-1 pt-2.5 pb-3 bg-transparent border-none cursor-pointer font-[inherit] flex flex-col items-center gap-1 transition-colors duration-200 relative ${active ? (isAdminTab ? "text-maroon" : "text-gold") : "text-txt-soft"}`}
          >
            {active && (
              <div
                className={`absolute top-0 w-9 h-0.5 rounded-b ${isAdminTab ? "bg-linear-to-r from-maroon to-maroon-lt" : "bg-linear-to-r from-gold to-gold-lt"}`}
              />
            )}
            <span
              className={`transition-transform duration-150 ${active ? "-translate-y-px" : ""}`}
            >
              {n.icon(active)}
            </span>
            <span
              className={`text-[11px] ${active ? "font-bold" : "font-medium"}`}
            >
              {n.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
