/* ─── Navigation Configuration ───────────────────────────────── */

import {
  IconCash,
  IconFilePlus,
  IconHome,
  IconShield,
} from "@tabler/icons-react";
import { C } from "../../constants";

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
  return [
    {
      id: "home",
      path: "/home",
      label: "หน้าแรก",
      icon: (a) => (
        <IconHome
          size={22}
          stroke={a ? 2.5 : 2}
          fill={a ? `${C.gold}30` : "none"}
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
          stroke={a ? 2.5 : 2}
          fill={a ? `${C.gold}30` : "none"}
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
                stroke={a ? 2.5 : 2}
                fill={a ? `${C.gold}30` : "none"}
              />
            ),
          },
        ]),
    ...(options.isAdmin
      ? [
          {
            id: "admin",
            path: "/admin",
            label: "Admin",
            icon: (a: boolean) => (
              <IconShield
                size={22}
                stroke={a ? 2.5 : 2}
                fill={a ? `${C.maroon}40` : "none"}
              />
            ),
          },
        ]
      : []),
  ];
}

export const PAGE_TITLES: Record<string, string | null> = {
  home: null,
  request: "ยื่นคำขอลา",
  salary: "เงินเดือนของฉัน",
  admin: "จัดการรายการลา",
};
