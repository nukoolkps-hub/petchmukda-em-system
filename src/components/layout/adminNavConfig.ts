/* ─── Admin Navigation Config ─────────────────────────────────────
   แยกออกมาจาก AdminPanel เพื่อให้ Sidebar ใช้ render nav บน Desktop ได้   */

import {
  IconCalendarEvent,
  IconCashBanknote,
  IconChartBar,
  IconClipboardList,
  IconCoins,
  IconCreditCard,
  IconDiamond,
  IconSettings,
  IconTag,
  IconUsers,
} from "@tabler/icons-react";

export type AdminSectionId =
  | "summary"
  | "leaves"
  | "salary"
  | "advance"
  | "payroll"
  | "roles"
  | "positions";

export type AdminGroupId = "leave" | "payroll" | "settings";

type AdminNavIcon = typeof IconChartBar;

export interface AdminNavItem {
  id: AdminSectionId;
  label: string;
  Icon: AdminNavIcon;
}

export interface AdminNavGroup {
  id: AdminGroupId;
  label: string;
  defaultSection: AdminSectionId;
  Icon: AdminNavIcon;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    id: "leave",
    label: "งานลา",
    defaultSection: "summary",
    Icon: IconCalendarEvent,
    items: [
      { id: "summary", label: "สรุปลา", Icon: IconChartBar },
      { id: "leaves", label: "รายการลา", Icon: IconClipboardList },
    ],
  },
  {
    id: "payroll",
    label: "เงินเดือน",
    defaultSection: "salary",
    Icon: IconCoins,
    items: [
      { id: "salary", label: "ค่าคอม", Icon: IconDiamond },
      { id: "advance", label: "เบิกเงิน", Icon: IconCashBanknote },
      { id: "payroll", label: "จ่ายเงิน", Icon: IconCreditCard },
    ],
  },
  {
    id: "settings",
    label: "ตั้งค่า",
    defaultSection: "roles",
    Icon: IconSettings,
    items: [
      { id: "roles", label: "พนักงาน", Icon: IconUsers },
      { id: "positions", label: "ตำแหน่ง", Icon: IconTag },
    ],
  },
];

export function getAdminGroupForSection(
  section: AdminSectionId,
): AdminNavGroup {
  return (
    ADMIN_NAV_GROUPS.find((group) =>
      group.items.some((item) => item.id === section),
    ) || ADMIN_NAV_GROUPS[0]
  );
}
