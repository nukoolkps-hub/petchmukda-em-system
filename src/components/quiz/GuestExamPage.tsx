/* ─── หน้าทำข้อสอบสำหรับพนักงานที่สแกน QR (#/exam/<รหัสรอบ>) ───────────
   **อยู่นอก AuthGate** — เปิดจากมือถือตัวเองโดยไม่ต้อง login · ทุกการอ่าน/
   เขียนวิ่งผ่าน Cloud Function (ดู `src/firebase/quizGuest.ts`)

   3 จังหวะ:
   1. กติกา + กรอกชื่อ — **เวลายังไม่เดิน** (ดึงกติกาด้วย `quizGuestInfo`
      ที่ยังไม่สร้างใบสอบ) · กดเริ่มเมื่อไหร่ server ถึงตรึงเวลาเริ่ม
   2. ทำข้อสอบ — ใช้ `QuizRunner` ตัวเดียวกับที่ ADMIN เปิดให้ทำ ต่างแค่
      ฉีด `io` ให้เขียนผ่าน callable แทน Firestore
   3. ส่งแล้ว — บอกว่ารอ ADMIN ตรวจ (ผู้สอบไม่เห็นคะแนนตัวเอง)

   **บัตรผ่านเก็บใน localStorage** → รีเฟรช/เน็ตหลุด/เผลอปิดแท็บ กลับมาทำต่อ
   ได้ที่เดิม พร้อมเวลาที่เหลือถูกต้อง · ใบที่จบแล้วต้องกด "เริ่มใบใหม่" ถึงจะ
   ล้างทิ้ง ไม่ล้างเองอัตโนมัติ (มือถือเครื่องเดียวอาจส่งต่อให้คนถัดไปทำ)  */

import {
  AlertTriangle as IconAlertTriangle,
  CheckCircle2 as IconCheckCircle,
  ClipboardCheck as IconClipboardCheck,
  Clock as IconClock,
  Play as IconPlay,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import type { QuizSet } from "../../content/quiz/basicExam";
import {
  clearGuestTicket,
  fetchGuestRoundInfo,
  type GuestExamState,
  type GuestRoundInfo,
  type GuestTicket,
  joinQuizRound,
  loadGuestTicket,
  saveGuestTicket,
  syncGuestExam,
} from "../../firebase/quizGuest";
import type { QuizAttempt } from "../../utils/quizAttempt";
import { normalizeRoundCode } from "../../utils/quizRound";
import QuizRunner, { type QuizRunnerIO } from "./QuizRunner";

type Phase = "loading" | "intro" | "running" | "done";

function errText(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function GuestExamPage() {
  const params = useParams<{ code?: string }>();
  const [code, setCode] = useState(() => normalizeRoundCode(params.code ?? ""));
  const [phase, setPhase] = useState<Phase>("loading");
  const [info, setInfo] = useState<GuestRoundInfo | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [ticket, setTicket] = useState<GuestTicket | null>(null);
  const [state, setState] = useState<GuestExamState | null>(null);
  const [quiz, setQuiz] = useState<QuizSet | null>(null);
  /** server − เครื่องนี้ (ms) — มือถือที่ตั้งเวลาเพี้ยนต้องนับถอยหลังตรงกับ server */
  const [skew, setSkew] = useState(0);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4000);
  }, []);

  /** ใบที่ทำค้างไว้ในเครื่องนี้ — หยิบกลับมาก่อนเสมอ ไม่เริ่มใบใหม่ทับ */
  useEffect(() => {
    const saved = loadGuestTicket();
    if (!saved) {
      setPhase("intro");
      return;
    }
    let alive = true;
    syncGuestExam(saved, { includeQuiz: true })
      .then((res) => {
        if (!alive) return;
        setTicket(saved);
        setState(res);
        setQuiz(res.quiz ?? null);
        setSkew(res.serverNow - Date.now());
        const finished = !!res.submittedAt || !!res.cancelledAt;
        setPhase(finished || !res.quiz ? "done" : "running");
      })
      .catch(() => {
        // ใบเก่าถูกลบ/token ใช้ไม่ได้แล้ว → เริ่มใหม่ได้เลย ไม่ค้างหน้าโหลด
        if (!alive) return;
        clearGuestTicket();
        setPhase("intro");
      });
    return () => {
      alive = false;
    };
  }, []);

  /** เช็ครหัสรอบ + ดึงกติกา (ยังไม่เริ่มจับเวลา) */
  useEffect(() => {
    if (phase !== "intro" || !code) return;
    let alive = true;
    setBusy(true);
    fetchGuestRoundInfo(code)
      .then((res) => alive && setInfo(res))
      .catch(
        (err) =>
          alive &&
          setInfo({
            open: false,
            reason: errText(err, "เชื่อมต่อไม่สำเร็จ — ลองใหม่อีกครั้ง"),
            quizTitle: "",
            rules: [],
            durationMinutes: 0,
            mainCount: 0,
            generalCount: 0,
          }),
      )
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [phase, code]);

  const io = useMemo<QuizRunnerIO | undefined>(() => {
    if (!ticket) return undefined;
    return {
      save: async (answers) => {
        await syncGuestExam(ticket, { answers });
      },
      // **ส่ง submit: true เสมอ ไม่ว่าจะกดเองหรือหมดเวลา** — ให้ server
      // เป็นคนตัดสินว่าใบนี้ "หมดเวลา" หรือ "กดส่งเอง" จากนาฬิกาของมันเอง
      // (ถ้าเชื่อ flag จาก client แล้วนาฬิกาสองฝั่งต่างกันเสี้ยววินาที ใบนั้น
      // จะถูกบันทึกคำตอบแต่ไม่ถูกส่ง → ค้างเป็นใบที่ไม่มีใครตรวจได้)
      submit: async (answers) => {
        await syncGuestExam(ticket, { answers, submit: true });
      },
      cancel: async () => {
        await syncGuestExam(ticket, { cancel: true });
      },
    };
  }, [ticket]);

  /** ใบสอบในรูปแบบที่ `QuizRunner` ใช้ — ประกอบจาก state ที่ server คืนมา */
  const attempt = useMemo<QuizAttempt | null>(() => {
    if (!state || !quiz) return null;
    return {
      id: state.attemptId,
      quizId: quiz.id,
      uid: "",
      employeeId: "",
      employeeName: state.employeeName,
      startedAt: state.startedAt,
      durationMinutes: state.durationMinutes,
      answers: state.answers,
      submittedAt: state.submittedAt,
      autoSubmitted: state.autoSubmitted,
      cancelledAt: state.cancelledAt,
      priceSnapshot: state.priceSnapshot,
    };
  }, [state, quiz]);

  async function start() {
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      showToast("กรอกชื่อก่อนเริ่มทำข้อสอบ");
      return;
    }
    setBusy(true);
    try {
      const res = await joinQuizRound(code, trimmed);
      const next = { attemptId: res.attemptId, token: res.token };
      saveGuestTicket(next);
      setTicket(next);
      setState(res);
      setQuiz(res.quiz ?? null);
      setSkew(res.serverNow - Date.now());
      setPhase("running");
    } catch (err) {
      showToast(errText(err, "เริ่มทำข้อสอบไม่สำเร็จ"));
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    clearGuestTicket();
    setTicket(null);
    setState(null);
    setQuiz(null);
    setName("");
    setPhase("intro");
  }

  return (
    <div className="min-h-screen bg-cream font-sans">
      {/* ── หัวหน้าจอ — ไม่มีเมนู/แท็บอื่น ให้โฟกัสอยู่กับข้อสอบอย่างเดียว ── */}
      <header className="bg-maroon text-white px-4 py-3">
        <div className="max-w-[560px] mx-auto flex items-center gap-2">
          <IconClipboardCheck size={20} strokeWidth={2.4} />
          <div className="text-base font-extrabold">แบบทดสอบพนักงาน</div>
          <div className="ml-auto text-xs text-white/80 font-semibold">
            ห้างเพชรทองมุกดา
          </div>
        </div>
      </header>

      <main className="max-w-[560px] mx-auto px-4 py-4">
        {phase === "loading" && (
          <div className="text-sm text-txt-soft text-center py-10">
            กำลังโหลด…
          </div>
        )}

        {phase === "intro" && (
          <div className="rounded-[12px] border-[1.5px] border-[#C9973A50] bg-gold-pale/60 p-3.5">
            {/* รหัสรอบมาจาก QR แล้ว — ให้แก้ได้เผื่อสแกนไม่ติดแล้วพิมพ์เอง */}
            <label className="block mb-3">
              <span className="block text-xs font-bold text-txt mb-1.5">
                รหัสรอบสอบ
              </span>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setInfo(null);
                  setCode(normalizeRoundCode(e.target.value));
                }}
                placeholder="เช่น AB12CD"
                className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-white text-sm text-txt font-[Prompt,monospace] tracking-widest outline-none focus:border-maroon"
              />
            </label>

            {busy && !info && (
              <div className="text-xs text-txt-soft mb-2">กำลังตรวจรหัส…</div>
            )}

            {info && !info.open && (
              <div className="mb-3 px-3 py-2.5 rounded-[8px] bg-[#FDECEA] border border-[#C0392B50] text-xs text-red font-semibold flex items-start gap-1.5">
                <IconAlertTriangle
                  size={14}
                  strokeWidth={2.4}
                  className="shrink-0 mt-0.5"
                />
                <span>{info.reason} — แจ้ง ADMIN ให้เปิดรอบสอบใหม่</span>
              </div>
            )}

            {info?.open && (
              <>
                <div className="text-base font-extrabold text-maroon mb-1.5">
                  {info.quizTitle}
                </div>
                <div className="text-xs text-txt-mid mb-2.5 flex items-center gap-1.5">
                  <IconClock size={13} strokeWidth={2.4} />
                  {info.mainCount} ข้อหลัก · {info.generalCount} ความรู้รอบตัว ·{" "}
                  {info.durationMinutes} นาที
                </div>
                <ul className="mb-3 space-y-1">
                  {info.rules.map((rule) => (
                    <li
                      key={rule}
                      className="text-xs text-txt-mid leading-relaxed flex items-start gap-1.5"
                    >
                      <span className="shrink-0 mt-[7px] w-1 h-1 rounded-full bg-maroon" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>

                <label className="block mb-3">
                  <span className="block text-xs font-bold text-txt mb-1.5">
                    ชื่อผู้ทำข้อสอบ
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="พิมพ์ชื่อ-ชื่อเล่นของตัวเอง"
                    className="w-full px-3 py-2.5 rounded-[9px] border border-bdr bg-white text-sm text-txt font-[inherit] outline-none focus:border-maroon"
                  />
                </label>

                <div className="mb-3 px-3 py-2 rounded-[8px] bg-amber-lt/60 border border-amber/40 text-xs text-txt leading-relaxed">
                  กด "เริ่มทำข้อสอบ" แล้ว<b>เวลาจะเริ่มเดินทันที</b> ·
                  ปิดแท็บ/เน็ตหลุดแล้วเปิดลิงก์เดิมกลับมาทำต่อได้ เวลาเดินต่อจากเดิม
                </div>

                <button
                  type="button"
                  onClick={() => void start()}
                  disabled={busy || !name.trim()}
                  className="w-full py-3 rounded-[12px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
                >
                  <IconPlay size={16} strokeWidth={2.4} />
                  {busy ? "กำลังเริ่ม…" : "เริ่มทำข้อสอบ"}
                </button>
              </>
            )}
          </div>
        )}

        {phase === "running" && attempt && quiz && (
          <QuizRunner
            quiz={quiz}
            attempt={attempt}
            io={io}
            clockSkewMs={skew}
            showToast={showToast}
            onFinished={() => {
              setPhase("done");
              // ดึงสถานะจริงกลับมา — จอสุดท้ายต้องแยกออกว่า "ส่งแล้ว" หรือ
              // "ยกเลิก" ซึ่งรู้ได้จาก doc ฝั่ง server เท่านั้น
              if (ticket) {
                void syncGuestExam(ticket)
                  .then(setState)
                  .catch(() => {});
              }
            }}
          />
        )}

        {phase === "done" && (
          <div className="rounded-[12px] border border-bdr bg-white p-4 text-center">
            <IconCheckCircle
              size={40}
              strokeWidth={2.2}
              className="text-green mx-auto mb-2"
            />
            <div className="text-base font-extrabold text-txt mb-1">
              {state?.cancelledAt ? "ยกเลิกการทำข้อสอบแล้ว" : "ส่งคำตอบแล้ว"}
            </div>
            <p className="text-xs text-txt-mid leading-relaxed mb-4">
              {state?.cancelledAt
                ? "ชุดนี้ไม่ถูกนับเป็นผลสอบ"
                : "รอ ADMIN ตรวจให้คะแนน — ผลสอบดูได้ที่ ADMIN ไม่ได้ขึ้นบนหน้านี้"}
            </p>
            <button
              type="button"
              onClick={startOver}
              className="w-full py-2.5 rounded-[10px] border border-bdr bg-white text-sm font-bold text-txt font-[inherit] cursor-pointer"
            >
              ให้คนถัดไปเริ่มทำข้อสอบ
            </button>
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-[10px] bg-maroon text-white text-sm font-semibold shadow-lg max-w-[90vw] text-center">
          {toast}
        </div>
      )}
    </div>
  );
}
