/* ─── Navigation Configuration ───────────────────────────────── */

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
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={a ? 2.5 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
            fill={a ? `${C.gold}30` : "none"}
          />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
    },
    {
      id: "request",
      path: "/request",
      label: "ยื่นคำขอลา",
      icon: (a) => (
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={a ? 2.5 : 2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            fill={a ? `${C.gold}30` : "none"}
          />
          <polyline points="14 2 14 8 20 8" />
          <line x1="12" y1="18" x2="12" y2="12" />
          <line x1="9" y1="15" x2="15" y2="15" />
        </svg>
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
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={a ? 2.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect
                  x="2"
                  y="6"
                  width="20"
                  height="12"
                  rx="2"
                  fill={a ? `${C.gold}30` : "none"}
                />
                <circle cx="12" cy="12" r="2.5" />
                <path d="M6 9.5h.01M18 14.5h.01" />
              </svg>
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
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={a ? 2.5 : 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path
                  d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  fill={a ? `${C.maroon}40` : "none"}
                />
              </svg>
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
