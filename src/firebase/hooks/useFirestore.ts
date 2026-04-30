/* ─── Firestore Collection Hooks ──────────────────────────────
   Reusable hooks ที่ใช้ pattern เดียวกัน:
   - subscribe to real-time updates
   - return { data, loading, error }
   - cleanup on unmount                                          */
import { useState, useEffect } from "react";

import { subscribeEmployees }       from "../employees";
import { subscribeLeaves }          from "../leaves";
import { subscribeAllSalaries }     from "../salaries";
import { subscribeAdvances }        from "../advances";
import { subscribeRoles }           from "../roles";
import { subscribePayrollConfirms } from "../payrollConfirms";

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
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
      return unsub;
    }, []);

    return { data, loading, error };
  };
}

/* ─── Specific hooks ─────────────────────────────────────────── */
export const useEmployees       = makeSubscriptionHook(subscribeEmployees, [] as any[]);
export const useLeaves          = makeSubscriptionHook(subscribeLeaves, [] as any[]);
export const useAdvances        = makeSubscriptionHook(subscribeAdvances, [] as any[]);
export const useRoles           = makeSubscriptionHook(subscribeRoles, [] as any[]);

// salaries และ payrollConfirms ใช้ object format
export const useSalaries        = makeSubscriptionHook(subscribeAllSalaries, {} as Record<string, any>);
export const usePayrollConfirms = makeSubscriptionHook(subscribePayrollConfirms, {} as Record<string, any>);
