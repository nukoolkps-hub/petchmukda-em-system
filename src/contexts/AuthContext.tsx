/* ─── AuthContext ─────────────────────────────────────────────
   Wrap the app with <AuthProvider> to:
   1. Listen to Firebase onAuthStateChanged
   2. Resolve admin custom claim ก่อนปล่อยให้ LeaveApp render
      (data layer ได้ scope สุดท้ายตั้งแต่ render แรก — ไม่ subscribe
      แบบพนักงานก่อนแล้วค่อยรื้อไป subscribe แบบ admin)
   3. Show LoginScreen when not authenticated
   4. Provide { user, isAdmin, signOut } to child components
   5. Auto-handle LINE Login callback (?code=xxx)            */

import type { User } from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  completeLineLogin,
  signOut as fbSignOut,
  onAuthChange,
} from "../firebase/auth";

interface AuthState {
  user: User | null;
  /** admin custom claim — resolve เสร็จก่อน `loading` จะเป็น false เสมอ */
  isAdmin: boolean;
  loading: boolean;
  /** กำลังแลก code จาก LINE callback → custom token (ห้าม auto-reload ช่วงนี้) */
  handlingCallback: boolean;
  error: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAdmin: false,
  loading: true,
  handlingCallback: false,
  error: null,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function resolveAdminClaim(firebaseUser: User): Promise<boolean> {
  try {
    const result = await firebaseUser.getIdTokenResult();
    return result.claims.admin === true;
  } catch {
    return false;
  }
}

/** อ่าน ?code&state จาก LINE callback แล้ว "ล้างออกจาก URL ทันที" —
 *  code/state เป็น single-use · ถ้า URL ยังถืออยู่ตอนหน้า reload (auto-reload
 *  ของ BootLoadingScreen · user กด refresh · LINE webview restore) จะแลกซ้ำ
 *  → server ปฏิเสธ "already-used state" ทั้งที่ login รอบแรกกำลังจะสำเร็จ */
function takeLineCallbackParams(): {
  code: string;
  state: string;
  error: string | null;
} | null {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  if (!error && !(code && state)) return null;
  window.history.replaceState({}, "", window.location.pathname);
  return { code: code ?? "", state: state ?? "", error };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [handlingCallback, setHandlingCallback] = useState(false);
  const lineCallbackHandledRef = useRef(false);
  // ลำดับ auth event ล่าสุด — ผล resolve claim ที่ช้ากว่า event ใหม่ให้ทิ้ง
  const seqRef = useRef(0);

  /* ─── Listen to auth state (+ resolve admin claim ก่อนปล่อย) ── */
  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser: User | null) => {
      const seq = ++seqRef.current;
      if (!firebaseUser) {
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      const admin = await resolveAdminClaim(firebaseUser);
      if (seq !== seqRef.current) return;
      // set พร้อมกัน — LeaveApp เห็น user + isAdmin สุดท้ายใน render เดียว
      setIsAdmin(admin);
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  /* ─── Auto-handle LINE Login callback ─────────────────────── */
  useEffect(() => {
    if (lineCallbackHandledRef.current) return;
    const cb = takeLineCallbackParams();
    if (!cb) return;
    lineCallbackHandledRef.current = true;

    if (cb.error) {
      setError(`LINE Login error: ${cb.error}`);
      return;
    }

    setHandlingCallback(true);
    setError(null);

    completeLineLogin({ code: cb.code, state: cb.state })
      .then(async (firebaseUser) => {
        // onAuthChange ยิงไปแล้วตอน signInWithCustomToken · resolve ซ้ำตรงนี้
        // (token cache · ถูก) เพื่อรับประกันว่า handlingCallback ปิดหลังจาก
        // isAdmin พร้อม → ไม่มีเฟรมที่ user มีแต่ isAdmin ยังเป็น false
        const admin = await resolveAdminClaim(firebaseUser);
        setIsAdmin(admin);
        setUser(firebaseUser);
        setLoading(false);
      })
      .catch((err) => {
        console.error("[Auth] LINE callback failed:", err);
        setError(err.message || "LINE Login ไม่สำเร็จ");
      })
      .finally(() => {
        setHandlingCallback(false);
      });
  }, []);

  /* ─── Sign out ────────────────────────────────────────────── */
  const handleSignOut = useCallback(async () => {
    await fbSignOut();
    setUser(null);
    setIsAdmin(false);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        loading: loading || handlingCallback,
        handlingCallback,
        error,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
