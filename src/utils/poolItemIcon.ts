import {
  Diamond as IconDiamond,
  ShoppingBag as IconShoppingBag,
  Sparkles as IconSparkles,
  Tag as IconTag,
  type LucideIcon,
} from "lucide-react";
import {
  LEGACY_POOL_BUY_ID,
  LEGACY_POOL_NORMAL_ID,
  LEGACY_POOL_SPECIAL_ID,
} from "./salaryUtils";

/**
 * Icon เริ่มต้นของ pool item ที่ไม่ใช่ 3 รายการ legacy (normal/special/buy)
 * — เช่น item ที่ admin สร้างเอง ("ขายมือสอง" ฯลฯ)
 * ใช้ Tag (ป้ายราคา) เป็น default กลางๆ · ไม่ชนกับ Diamond ของ "ขายทั่วไป"
 */
export const DEFAULT_POOL_ITEM_ICON: LucideIcon = IconTag;

/**
 * Lucide icon ของ pool item ตาม id — single source ให้ทั้งฝั่ง admin
 * (SalaryAdminEdit) และพนักงาน (SalaryView) + PoolFlowModal ใช้ตรงกัน
 */
export function getPoolItemIcon(id: string): LucideIcon {
  if (id === LEGACY_POOL_NORMAL_ID) return IconDiamond;
  if (id === LEGACY_POOL_SPECIAL_ID) return IconSparkles;
  if (id === LEGACY_POOL_BUY_ID) return IconShoppingBag;
  return DEFAULT_POOL_ITEM_ICON;
}
