/**
 * แปล error ของการ push LINE (เก็บใน `advance.lineNotifyError`) เป็นสาเหตุ
 * ภาษาไทย + สิ่งที่ admin ต้องทำ — ใช้บนป้ายแดง "LINE แจ้งเตือนแอดมินไม่สำเร็จ"
 *
 * รูปแบบ error มาจาก `pushLineMessage` (functions/src/helpers/line.ts):
 *   "LINE push failed: <HTTP status> <body จาก LINE>"
 * ล้มหลาย admin → หลายข้อความคั่นด้วย " | " (ใช้ข้อความแรกที่แปลได้)
 * error เครือข่าย (fetch failed / timeout) ไม่มี status
 */

export type LineNotifyCause =
  | "token"
  | "quota"
  | "rate_limit"
  | "recipient"
  | "bad_request"
  | "forbidden"
  | "line_down"
  | "not_configured"
  | "unknown";

export interface LineNotifyDiagnosis {
  cause: LineNotifyCause;
  /** สาเหตุสั้นๆ */
  title: string;
  /** ต้องทำอะไร */
  hint: string;
  /** กดส่งซ้ำแล้วมีโอกาสหายไหม (ไม่ต้องแก้ตั้งค่าก่อน) */
  retryable: boolean;
}

const DIAGNOSES: Record<LineNotifyCause, Omit<LineNotifyDiagnosis, "cause">> = {
  token: {
    title: "Access Token ของบอทใช้ไม่ได้",
    hint: "token หมดอายุหรือถูกออกใหม่ — ออก token ใหม่ใน LINE Developers แล้วใส่ใน config/secrets → LINE_CHANNEL_ACCESS_TOKEN",
    retryable: false,
  },
  quota: {
    title: "โควต้าข้อความ LINE เดือนนี้หมดแล้ว",
    hint: "อัปเกรดแพ็กเกจ LINE Official Account หรือรอโควต้ารีเซ็ตต้นเดือน",
    retryable: false,
  },
  rate_limit: {
    title: "ส่งถี่เกินไป LINE ขอให้รอก่อน",
    hint: "รอสักครู่แล้วกดส่งอีกครั้ง",
    retryable: true,
  },
  recipient: {
    title: "ID LINE ของแอดมินไม่ถูกต้อง",
    hint: "ตรวจ ADMIN_LINE_USER_ID ใน config/secrets (หลายคนคั่นด้วย , ได้) และแอดมินต้องยังเป็นเพื่อนกับบอท",
    retryable: false,
  },
  bad_request: {
    title: "LINE ไม่รับรูปแบบข้อความนี้",
    hint: "แจ้งผู้ดูแลระบบพร้อมรายละเอียดด้านล่าง",
    retryable: false,
  },
  forbidden: {
    title: "บัญชี LINE OA ไม่มีสิทธิ์ส่งข้อความนี้",
    hint: "ตรวจสถานะบัญชี/แพ็กเกจใน LINE Official Account Manager",
    retryable: false,
  },
  line_down: {
    title: "LINE ขัดข้องชั่วคราว",
    hint: "กดส่งแจ้งเตือนอีกครั้งได้เลย",
    retryable: true,
  },
  not_configured: {
    title: "ยังไม่ได้ตั้งค่า LINE Bot",
    hint: "ใส่ LINE_CHANNEL_ACCESS_TOKEN และ ADMIN_LINE_USER_ID ใน config/secrets",
    retryable: false,
  },
  unknown: {
    title: "ไม่ทราบสาเหตุแน่ชัด",
    hint: "กดส่งอีกครั้ง ถ้ายังไม่ได้ให้ตรวจ Access Token / การตั้งค่า LINE Bot",
    retryable: true,
  },
};

function causeOf(message: string): LineNotifyCause {
  const msg = message.trim();
  if (!msg) return "unknown";
  if (msg === "not_configured") return "not_configured";

  const status = Number(/LINE push failed:\s*(\d{3})/i.exec(msg)?.[1]);
  if (status === 401) return "token";
  if (status === 429) {
    return /monthly limit|quota/i.test(msg) ? "quota" : "rate_limit";
  }
  if (status === 400) {
    // LINE: "The property, 'to', in the request body is invalid ..."
    return /'to'|\bto\b.*invalid|invalid.*\buser\b/i.test(msg)
      ? "recipient"
      : "bad_request";
  }
  if (status === 403) return "forbidden";
  if (status >= 500) return "line_down";
  if (
    /fetch failed|timed? ?out|ECONNRESET|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket|network/i.test(
      msg,
    )
  ) {
    return "line_down";
  }
  return "unknown";
}

/** สาเหตุที่ควรโชว์ — error หลายตัว (admin หลายคน) เลือกตัวแรกที่ไม่ใช่ unknown */
export function diagnoseLineNotifyError(
  error: string | null | undefined,
): LineNotifyDiagnosis {
  const parts = String(error ?? "")
    .split(" | ")
    .map(causeOf);
  const cause = parts.find((c) => c !== "unknown") ?? "unknown";
  return { cause, ...DIAGNOSES[cause] };
}
