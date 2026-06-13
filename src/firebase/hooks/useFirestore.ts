/* ─── Firestore Collection Hooks ──────────────────────────────
   Reusable hooks ที่ใช้ pattern เดียวกัน:
   - subscribe to real-time updates
   - return { data, loading, error }
   - cleanup on unmount                                          */
import { type DependencyList, useEffect, useState } from "react";
import {
  subscribeAdvances,
  subscribeAdvancesByEmployeeId,
  subscribeAdvancesByStatusAndMonth,
  subscribeApprovedAdvancesByMonth,
  subscribePendingAdvances,
} from "../advances";
import { subscribeDuties } from "../duties";
import {
  type DutyAssignmentsSnapshot,
  subscribeDutyAssignments,
} from "../dutyAssignments";
import {
  subscribeEmployeeLoans,
  subscribeEmployeeLoansByEmployeeId,
} from "../employeeLoans";
import {
  subscribeEmployeeByLineUserId,
  subscribeEmployees,
} from "../employees";
import { DEFAULT_GOLD_PRICE, subscribeGoldPrice } from "../goldPrice";
import { EMPTY_LABOR_COST, subscribeLaborCost } from "../laborCost";
import { subscribeLeaves, subscribeLeavesByEmployeeId } from "../leaves";
import { subscribePayrollConfirms } from "../payrollConfirms";
import {
  type PoolAdjustmentsByMonth,
  subscribePoolAdjustments,
} from "../poolAdjustments";
import {
  type PoolSnapshotsByMonth,
  subscribeAllPoolSnapshots,
} from "../poolSnapshots";
import { subscribeRoles } from "../roles";
import { subscribeAllSalaries, subscribeEmployeeSalaries } from "../salaries";
import { EMPTY_STORE_CALENDAR, subscribeStoreCalendar } from "../storeCalendar";

interface SubscriptionResult<T> {
  data: T;
  loading: boolean;
  error: Error | null;
}

type SubscribeFn<T> = (
  onChange: (data: T) => void,
  onError?: (err: Error) => void,
) => () => void;

/* ─── Generic factory ────────────────────────────────────────── */
function makeSubscriptionHook<T>(subscribeFn: SubscribeFn<T>, defaultValue: T) {
  return function useSubscription(): SubscriptionResult<T> {
    const [data, setData] = useState<T>(defaultValue);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
      setLoading(true);
      const unsub = subscribeFn(
        (newData) => {
          setData(newData);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.warn(
            "[Firestore] subscription error (degrading gracefully):",
            err.message,
          );
          // For permission-denied errors, degrade gracefully
          // (return default value instead of blocking the entire app)
          if (
            err.message?.includes("permission") ||
            err.message?.includes("allow")
          ) {
            setData(defaultValue);
            setLoading(false);
            // Don't propagate error — the hook will return default data
          } else {
            setError(err);
            setLoading(false);
          }
        },
      );
      return unsub;
    }, []);

    return { data, loading, error };
  };
}

function useScopedSubscription<T>(
  getSubscribeFn: () => SubscribeFn<T> | null,
  defaultValue: T,
  deps: DependencyList,
  options?: { keepPreviousData?: boolean },
): SubscriptionResult<T> {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const subscribeFn = getSubscribeFn();
    // โดยปกติ reset ทุกครั้งที่ scope/เดือนเปลี่ยน — กันข้อมูล "ชุดเก่า" ค้างแสดง
    // (เช่น เปลี่ยนเดือนในประวัติเบิกเงิน แล้ว query ใหม่ยังไม่มา/ error →
    //  เดิมจะยังโชว์เดือนก่อน). ถ้า keepPreviousData = true จะ "ไม่ล้าง"
    // ข้อมูลเดิม รอแทนเมื่อชุดใหม่มา — ลดอาการ "กระพริบ" (เช่นหน้าจ่ายเงิน
    // ที่ยอดเด้งเป็น 0 ชั่ววินาทีตอนสลับเดือน)
    if (!options?.keepPreviousData) {
      setData(defaultValue);
    }
    setError(null);
    if (!subscribeFn) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeFn(
      (newData) => {
        setData(newData);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.warn(
          "[Firestore] scoped subscription error (degrading gracefully):",
          err.message,
        );
        // ทุกกรณี error → ล้างข้อมูลเป็นค่าเริ่มต้น ไม่ค้างข้อมูล scope เก่า
        setData(defaultValue);
        if (
          err.message?.includes("permission") ||
          err.message?.includes("allow")
        ) {
          setLoading(false);
        } else {
          setError(err);
          setLoading(false);
        }
      },
    );
    return unsub;
    // biome-ignore lint/correctness/useExhaustiveDependencies: this generic hook accepts the caller's scoped dependency list.
  }, deps);

  return { data, loading, error };
}

/* ─── Specific hooks ─────────────────────────────────────────── */
export const useEmployees = makeSubscriptionHook(
  subscribeEmployees,
  [] as any[],
);
export const useLeaves = makeSubscriptionHook(subscribeLeaves, [] as any[]);
export const useAdvances = makeSubscriptionHook(subscribeAdvances, [] as any[]);
export const usePendingAdvances = makeSubscriptionHook(
  subscribePendingAdvances,
  [] as any[],
);
export const useRoles = makeSubscriptionHook(subscribeRoles, [] as any[]);
export const useDuties = makeSubscriptionHook(subscribeDuties, [] as any[]);
export const useDutyAssignments = makeSubscriptionHook(
  subscribeDutyAssignments,
  null as DutyAssignmentsSnapshot | null,
);

// salaries และ payrollConfirms ใช้ object format
export const useSalaries = makeSubscriptionHook(
  subscribeAllSalaries,
  {} as Record<string, any>,
);
export const usePayrollConfirms = makeSubscriptionHook(
  subscribePayrollConfirms,
  {} as Record<string, any>,
);

export function useLeavesForScope({
  isAdmin,
  employeeId,
}: {
  isAdmin: boolean;
  employeeId: string | null;
}) {
  return useScopedSubscription(
    () => {
      if (isAdmin) return subscribeLeaves;
      if (employeeId) {
        return (onChange, onError) =>
          subscribeLeavesByEmployeeId(employeeId, onChange, onError);
      }
      return null;
    },
    [] as any[],
    [isAdmin, employeeId],
  );
}

export function useEmployeesForScope({
  isAdmin,
  authUid,
}: {
  isAdmin: boolean;
  authUid: string;
}) {
  return useScopedSubscription(
    () => {
      if (isAdmin) return subscribeEmployees;
      if (authUid) {
        return (onChange, onError) =>
          subscribeEmployeeByLineUserId(authUid, onChange, onError);
      }
      return null;
    },
    [] as any[],
    [isAdmin, authUid],
  );
}

export function useEmployeeLoansForScope({
  isAdmin,
  employeeId,
}: {
  isAdmin: boolean;
  employeeId: string | null;
}) {
  return useScopedSubscription(
    () => {
      if (isAdmin) return subscribeEmployeeLoans;
      if (employeeId) {
        return (onChange, onError) =>
          subscribeEmployeeLoansByEmployeeId(employeeId, onChange, onError);
      }
      return null;
    },
    [] as any[],
    [isAdmin, employeeId],
  );
}

export function useAdvancesForScope({
  isAdmin,
  employeeId,
}: {
  isAdmin: boolean;
  employeeId: string | null;
}) {
  return useScopedSubscription(
    () => {
      if (isAdmin) return subscribePendingAdvances;
      if (employeeId) {
        return (onChange, onError) =>
          subscribeAdvancesByEmployeeId(employeeId, onChange, onError);
      }
      return null;
    },
    [] as any[],
    [isAdmin, employeeId],
  );
}

export function useAdvancesByStatusAndMonth({
  status,
  yearMonth,
  enabled = true,
}: {
  status: "pending" | "approved" | "rejected" | null;
  yearMonth: string;
  enabled?: boolean;
}) {
  return useScopedSubscription(
    () => {
      if (!enabled || !status || !yearMonth) return null;
      return (onChange, onError) =>
        subscribeAdvancesByStatusAndMonth(status, yearMonth, onChange, onError);
    },
    [] as any[],
    [enabled, status, yearMonth],
    { keepPreviousData: true },
  );
}

export function useApprovedAdvancesByMonth(yearMonth: string | null) {
  return useScopedSubscription(
    () => {
      if (!yearMonth) return null;
      return (onChange, onError) =>
        subscribeApprovedAdvancesByMonth(yearMonth, onChange, onError);
    },
    [] as any[],
    [yearMonth],
    { keepPreviousData: true },
  );
}

export function useSalariesForScope({
  isAdmin,
  employeeId,
}: {
  isAdmin: boolean;
  employeeId: string | null;
}) {
  // PHASE 2: admin subscribe ทุกคนผ่าน collectionGroup เหมือนเดิม
  // พนักงาน subscribe เฉพาะของตัวเอง (rules ล็อก salaries แล้ว) — peer data
  // ที่ pool calc ต้องใช้ดึงจาก poolSnapshots ผ่าน usePoolSnapshots แล้ว
  // merge เข้า salaryData ใน useFirebaseAppData
  return useScopedSubscription(
    () => {
      if (isAdmin) return subscribeAllSalaries;
      if (employeeId) {
        return (onChange, onError) =>
          subscribeEmployeeSalaries(employeeId, onChange, onError);
      }
      return null;
    },
    {} as Record<string, any>,
    [isAdmin, employeeId],
  );
}

export function usePoolSnapshots() {
  return useScopedSubscription(
    () => subscribeAllPoolSnapshots,
    {} as PoolSnapshotsByMonth,
    [],
  );
}

export function usePoolAdjustments() {
  return useScopedSubscription(
    () => subscribePoolAdjustments,
    {} as PoolAdjustmentsByMonth,
    [],
  );
}

export function usePayrollConfirmsForScope(_args: { isAdmin: boolean }) {
  // ทั้ง admin และ employee ต้องเห็นสถานะ "ยืนยันยอดแล้ว/ยัง" — employee
  // ใช้เพื่อปลดล็อกการพิมพ์สลิป (เห็นแค่ confirmedAt + totalAmount)
  return useScopedSubscription(
    () => subscribePayrollConfirms,
    {} as Record<string, any>,
    [],
  );
}

/** subscribe store calendar (ทุกคน signed-in — ทั้ง admin/employee
 *  ใช้เช็คว่าวันนี้ร้านเปิด-ปิดเหมือนกัน · ขนาดเล็กมาก ไม่ต้องแยก scope) */
export function useStoreCalendar() {
  return useScopedSubscription(
    () => subscribeStoreCalendar,
    EMPTY_STORE_CALENDAR,
    [],
  );
}

/** ราคาทองคำไทย — public read · admin write · doc เดียว /config/goldPrice */
export function useGoldPrice() {
  return useScopedSubscription(
    () => subscribeGoldPrice,
    DEFAULT_GOLD_PRICE,
    [],
  );
}

/** ค่าแรงเริ่มต้น (ทอง 96.5%) — public read · admin write · doc เดียว
 *  /config/laborCost · override CHANGE_PRICE_WEIGHTS.laborBase */
export function useLaborCost() {
  return useScopedSubscription(
    () => subscribeLaborCost,
    EMPTY_LABOR_COST,
    [],
  );
}
