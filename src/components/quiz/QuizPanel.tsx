/* ─── QuizPanel — แบบทดสอบความรู้พื้นฐาน (admin section) ──────────────
   router บางๆ 3 โหมด: รายการ → ทำข้อสอบ → ตรวจ

   **ชุดที่ทำค้างไว้จะถูกหยิบกลับมาต่อเสมอ** — ไม่สร้างชุดใหม่ทับ ไม่งั้น
   กดเริ่มซ้ำ/เผลอรีเฟรช = ได้เวลาใหม่ 100 นาทีฟรี · ชุดที่หมดเวลาแล้วแต่
   ยังไม่ได้ส่ง (ปิดแท็บหนีไป) ก็นับว่าจบ ไม่ให้ทำต่อ                      */

import {
  ClipboardCheck as IconClipboardCheck,
  Clock as IconClock,
  FileText as IconFileText,
  Play as IconPlay,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BASIC_EXAM } from "../../content/quiz/basicExam";
import { useAuth } from "../../contexts/AuthContext";
import {
  startQuizAttempt,
  subscribeAllQuizAttempts,
} from "../../firebase/quizAttempts";
import type { Employee } from "../../types";
import { fmtThaiDateTime } from "../../utils/dateUtils";
import {
  isExpired,
  type QuizAttempt,
  scoreAttempt,
} from "../../utils/quizAttempt";
import QuizReview from "./QuizReview";
import QuizRunner from "./QuizRunner";

interface Props {
  employeeDirectory?: Employee[];
  showToast?: (msg: string) => void;
}

export default function QuizPanel({ employeeDirectory, showToast }: Props) {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => subscribeAllQuizAttempts(setAttempts), []);

  const uid = user?.uid ?? "";
  // `uid` = เจ้าของชุด (rules ใช้ตัวนี้) · `employeeId` = doc id ใน employees
  // (ว่างได้ถ้า ADMIN ไม่มี employee doc) — เก็บไว้ให้ระบบล้างข้อมูลรายคน join ได้
  const me = useMemo(
    () => (employeeDirectory ?? []).find((e) => e.lineUserId === uid) ?? null,
    [employeeDirectory, uid],
  );
  const myEmployeeId = me?.id ?? "";
  const myName = me?.nickname || me?.name || user?.displayName || "ADMIN";

  // ชุดของเราที่ยังทำอยู่จริง (ยังไม่ส่ง + ยังไม่หมดเวลา)
  const inProgress = useMemo(
    () =>
      attempts.find(
        (a) => a.uid === uid && !a.submittedAt && !isExpired(a, Date.now()),
      ) ?? null,
    [attempts, uid],
  );

  const running = attempts.find((a) => a.id === runningId) ?? null;
  const reviewing = attempts.find((a) => a.id === reviewId) ?? null;

  async function handleStart() {
    if (starting) return;
    // มีชุดค้างอยู่ → ทำต่อ ไม่สร้างใหม่ (กันกดเริ่มซ้ำได้เวลาเพิ่ม)
    if (inProgress) {
      setRunningId(inProgress.id);
      return;
    }
    setStarting(true);
    try {
      const id = await startQuizAttempt(BASIC_EXAM, uid, myEmployeeId, myName);
      setRunningId(id);
    } catch (err) {
      showToast?.(
        err instanceof Error ? `เริ่มไม่สำเร็จ: ${err.message}` : "เริ่มไม่สำเร็จ",
      );
    } finally {
      setStarting(false);
    }
  }

  if (running) {
    return (
      <QuizRunner
        quiz={BASIC_EXAM}
        attempt={running}
        onFinished={() => {
          setRunningId(null);
          setReviewId(running.id);
        }}
        showToast={showToast}
      />
    );
  }

  if (reviewing) {
    return (
      <QuizReview
        quiz={BASIC_EXAM}
        attempt={reviewing}
        gradedBy={myName}
        onBack={() => setReviewId(null)}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="font-sans">
      {/* ── กติกา + ปุ่มเริ่ม ── */}
      <div className="rounded-[12px] border-[1.5px] border-[#C9973A50] bg-gold-pale/60 p-3.5 mb-4">
        <div className="text-base font-extrabold text-maroon mb-2 flex items-center gap-1.5">
          <IconClipboardCheck size={18} strokeWidth={2.4} />
          {BASIC_EXAM.title}
        </div>
        <ul className="mb-3 space-y-1">
          {BASIC_EXAM.rules.map((rule) => (
            <li
              key={rule}
              className="text-xs text-txt-mid leading-relaxed flex items-start gap-1.5"
            >
              <span className="shrink-0 mt-[7px] w-1 h-1 rounded-full bg-maroon" />
              <span>{rule}</span>
            </li>
          ))}
        </ul>

        {inProgress && (
          <div className="mb-2.5 px-3 py-2 rounded-[8px] bg-amber-lt/70 border border-amber/40 text-xs text-txt font-semibold flex items-center gap-1.5">
            <IconClock
              size={14}
              strokeWidth={2.4}
              className="text-amber shrink-0"
            />
            มีชุดที่ทำค้างไว้ — กดเพื่อทำต่อ (เวลาเดินต่อจากเดิม ไม่ได้เริ่มใหม่)
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleStart()}
          disabled={starting || !uid}
          className="w-full py-3 rounded-[12px] bg-maroon text-white text-sm font-bold font-[inherit] cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-1.5"
        >
          <IconPlay size={16} strokeWidth={2.6} />
          {starting ? "กำลังเริ่ม…" : inProgress ? "ทำข้อสอบต่อ" : "เริ่มทำข้อสอบ"}
        </button>
      </div>

      {/* ── ประวัติการทำข้อสอบ ── */}
      <div className="text-sm font-extrabold text-maroon mb-2 flex items-center gap-1.5">
        <IconFileText size={16} strokeWidth={2.4} />
        ประวัติการทำข้อสอบ
      </div>

      {attempts.length === 0 ? (
        <div className="text-center text-xs text-txt-soft py-6 px-4 bg-cream/60 rounded-[10px] border border-dashed border-bdr">
          ยังไม่มีใครทำข้อสอบ
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {attempts.map((a) => {
            const score = scoreAttempt(a, BASIC_EXAM);
            const done = !!a.submittedAt || isExpired(a, Date.now());
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setReviewId(a.id)}
                className="text-left rounded-[10px] border border-bdr bg-white p-3 cursor-pointer hover:border-maroon/40 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-txt">
                    {a.employeeName || "(ไม่ทราบชื่อ)"}
                  </span>
                  {!done ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-amber-lt text-amber font-bold">
                      กำลังทำ
                    </span>
                  ) : score.passed === null ? (
                    <span className="text-[11px] px-2 py-0.5 rounded-lg bg-cream-dk text-txt-soft font-bold">
                      รอตรวจ
                    </span>
                  ) : (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-lg font-bold ${
                        score.passed
                          ? "bg-green-lt/70 text-green"
                          : "bg-[#FDECEA] text-red"
                      }`}
                    >
                      {score.percent}% · {score.passed ? "ผ่าน" : "ไม่ผ่าน"}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-txt-soft mt-0.5">
                  {fmtThaiDateTime(a.startedAt)}
                  {a.autoSubmitted && " · หมดเวลา"}
                  {done && score.graded > 0 && score.passed === null
                    ? ` · ตรวจไป ${score.graded}/${score.total}`
                    : ""}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
