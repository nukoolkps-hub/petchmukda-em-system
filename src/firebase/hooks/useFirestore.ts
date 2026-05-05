/* ─── Firestore Collection Hooks ──────────────────────────────
   Reusable hooks ที่ใช้ pattern เดียวกัน:
   - subscribe to real-time updates
   - return { data, loading, error }
   - cleanup on unmount                                          */
import { useEffect, useState, type DependencyList } from "react";
import { subscribeAdvances, subscribeAdvancesByEmployeeId } from "../advances";
import { subscribeEmployeeByLineUserId, subscribeEmployees } from "../employees";
import { subscribeLeaves, subscribeLeavesByEmployeeId } from "../leaves";
import { subscribePayrollConfirms } from "../payrollConfirms";
import { subscribeRoles } from "../roles";
import { subscribeAllSalaries, subscribeEmployeeSalaries } from "../salaries";

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
): SubscriptionResult<T> {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const subscribeFn = getSubscribeFn();
    if (!subscribeFn) {
      setData(defaultValue);
      setLoading(false);
      setError(null);
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
        if (
          err.message?.includes("permission") ||
          err.message?.includes("allow")
        ) {
          setData(defaultValue);
          setLoading(false);
        } else {
          setError(err);
          setLoading(false);
        }
      },
    );
    return unsub;
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
export const useRoles = makeSubscriptionHook(subscribeRoles, [] as any[]);

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

export function useAdvancesForScope({
  isAdmin,
  employeeId,
}: {
  isAdmin: boolean;
  employeeId: string | null;
}) {
  return useScopedSubscription(
    () => {
      if (isAdmin) return subscribeAdvances;
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

export function useSalariesForScope({
  isAdmin,
  employeeId,
}: {
  isAdmin: boolean;
  employeeId: string | null;
}) {
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

export function usePayrollConfirmsForScope({ isAdmin }: { isAdmin: boolean }) {
  return useScopedSubscription(
    () => (isAdmin ? subscribePayrollConfirms : null),
    {} as Record<string, any>,
    [isAdmin],
  );
}
