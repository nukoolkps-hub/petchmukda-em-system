/* ─── Navigation Configuration ───────────────────────────────── */

import {
  Banknote as IconCash,
  FilePlus as IconFilePlus,
  Gem as IconGem,
  Home as IconHome,
  Shield as IconShield,
} from "lucide-react";
import { COLORS } from "../../constants";

export interface NavItem {
  id: string;
  path: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

export function getNavItems(options: {
  isAdmin: boolean;
  salaryDisabled: boolean;
}): NavItem[] {
  if (options.isAdmin) {
    return [
      {
        id: "admin",
        path: "/admin",
        label: "Admin",
        icon: (a: boolean) => (
          <IconShield
            size={22}
            strokeWidth={a ? 2.5 : 2}
            fill={a ? `${COLORS.maroon}40` : "none"}
          />
        ),
      },
    ];
  }

  return [
    {
      id: "home",
      path: "/home",
      label: "หน้าแรก",
      icon: (a) => (
        <IconHome
          size={22}
          strokeWidth={a ? 2.5 : 2}
          fill={a ? `${COLORS.gold}30` : "none"}
        />
      ),
    },
    {
      id: "request",
      path: "/request",
      label: "ยื่นคำขอลา",
      icon: (a) => (
        <IconFilePlus
          size={22}
          strokeWidth={a ? 2.5 : 2}
          fill={a ? `${COLORS.gold}30` : "none"}
        />
      ),
    },
    ...(options.salaryDisabled
      ? []
      : [
          {
            id: "salary",
            path: "/salary",
            label: "เงินเดือน",
            icon: (a: boolean) => (
              <IconCash
                size={22}
                strokeWidth={a ? 2.5 : 2}
                fill={a ? `${COLORS.gold}30` : "none"}
              />
            ),
          },
        ]),
    {
      id: "knowledge",
      path: "/knowledge",
      label: "ความรู้ต่างๆ",
      icon: (a) => (
        <IconGem
          size={22}
          strokeWidth={a ? 2.5 : 2}
          fill={a ? `${COLORS.gold}30` : "none"}
        />
      ),
    },
  ];
}

export const PAGE_TITLES: Record<string, string | null> = {
  home: null,
  request: "ยื่นคำขอลา",
  salary: "เงินเดือน",
  knowledge: "ความรู้ต่างๆ",
  admin: "จัดการข้อมูลพนักงาน",
};
