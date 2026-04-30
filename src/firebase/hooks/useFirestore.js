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

/* ─── Generic factory ────────────────────────────────────────── */
function makeSubscriptionHook(subscribeFn, defaultValue=[]){
  return function useSubscription(){
    const [data, setData] = useState(defaultValue);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

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
export const useEmployees       = makeSubscriptionHook(subscribeEmployees, []);
export const useLeaves          = makeSubscriptionHook(subscribeLeaves, []);
export const useAdvances        = makeSubscriptionHook(subscribeAdvances, []);
export const useRoles           = makeSubscriptionHook(subscribeRoles, []);

// salaries และ payrollConfirms ใช้ object format
export const useSalaries        = makeSubscriptionHook(subscribeAllSalaries, {});
export const usePayrollConfirms = makeSubscriptionHook(subscribePayrollConfirms, {});
