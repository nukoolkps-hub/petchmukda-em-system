import { httpsCallable } from "firebase/functions";
import { functions } from "./config";

export interface RetryAdvanceNotifyResult {
  ok: boolean;
  /** error ดิบจาก LINE (หรือ "not_configured") — แปลด้วย diagnoseLineNotifyError */
  error?: string;
  sent?: number;
  total?: number;
}

/** admin กด "ส่งแจ้งเตือนอีกครั้ง" บนป้ายแดงของคำขอเบิก
 *  → callable `retryAdvanceAdminNotify` (สำเร็จ = server ล้างธงให้เอง) */
export async function retryAdvanceAdminNotify(
  advanceId: string,
): Promise<RetryAdvanceNotifyResult> {
  const callable = httpsCallable<
    { advanceId: string },
    RetryAdvanceNotifyResult
  >(functions, "retryAdvanceAdminNotify");
  const res = await callable({ advanceId });
  return res.data;
}
