/* ─── Admin Navigation Config ─────────────────────────────────────
   แยกออกมาจาก AdminPanel เพื่อให้ Sidebar ใช้ render nav บน Desktop ได้   */

import {
  Bell as IconBell,
  CalendarClock as IconCalendarClock,
  CalendarDays as IconCalendarEvent,
  CalendarOff as IconCalendarOff,
  Banknote as IconCashBanknote,
  BarChart3 as IconChartBar,
  ClipboardList as IconClipboardList,
  Coins as IconCoins,
  CreditCard as IconCreditCard,
  Diamond as IconDiamond,
  HandCoins as IconHandCoins,
  MessageCircle as IconMessageCircle,
  Settings as IconSettings,
  Tag as IconTag,
  Terminal as IconTerminal,
  Users as IconUsers,
} from "lucide-react";

export type AdminSectionId =
  | "summary"
  | "leaves"
  | "salary"
  | "advance"
  | "loans"
  | "payroll"
  | "roles"
  | "positions"
  | "duty-schedule"
  | "store-calendar"
  | "linebot-notifications"
  | "linebot-commands";

export type AdminGroupId =
  | "leave"
  | "payroll"
  | "settings"
  | "duty"
  | "linebot";

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
      { id: "loans", label: "กู้เงิน", Icon: IconHandCoins },
      { id: "payroll", label: "จ่ายเงิน", Icon: IconCreditCard },
    ],
  },
  {
    id: "duty",
    label: "หน้าที่",
    defaultSection: "duty-schedule",
    Icon: IconCalendarClock,
    items: [
      { id: "duty-schedule", label: "ตารางหน้าที่", Icon: IconCalendarClock },
      {
        id: "store-calendar",
        label: "วันเปิด-ปิดร้าน",
        Icon: IconCalendarOff,
      },
    ],
  },
  {
    id: "linebot",
    label: "LINE BOT",
    defaultSection: "linebot-notifications",
    Icon: IconMessageCircle,
    items: [
      { id: "linebot-notifications", label: "การแจ้งเตือน", Icon: IconBell },
      { id: "linebot-commands", label: "คำสั่ง", Icon: IconTerminal },
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
