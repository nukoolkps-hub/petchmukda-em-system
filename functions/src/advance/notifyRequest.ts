/**
 * notifyAdvanceRequest — แจ้ง Admin (คำขอเบิกใหม่)
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import type { AdvanceRequestData } from "../types.js";
import { COLOR, TH_NUM, getLineConfig } from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";

export const notifyAdvanceRequest = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "ต้อง login ก่อน");

  const { empName, amount, reason, month, bank, bankAcc, submittedAt, requestId } =
    request.data as AdvanceRequestData;
  if (!empName || !amount) throw new HttpsError("invalid-argument", "missing fields");

  const config = await getLineConfig();
  if (!config.LINE_CHANNEL_ACCESS_TOKEN || !config.ADMIN_LINE_USER_ID) {
    console.warn("LINE config not set");
    return { ok: true, skipped: true };
  }

  const dt = new Date(submittedAt || Date.now());
  const dtStr = dt.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

  const flex = {
    type: "flex" as const,
    altText: `💸 คำขอเบิกเงินล่วงหน้า — ${empName} ฿${TH_NUM(amount)}`,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        backgroundColor: COLOR.maroon,
        paddingAll: "16px",
        contents: [
          { type: "text", text: "💸 คำขอเบิกเงินล่วงหน้า", color: COLOR.goldLt, weight: "bold", size: "lg" },
          { type: "text", text: "ห้างเพชรทองมุกดา", color: COLOR.goldLt, size: "xs", margin: "sm" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          {
            type: "box", layout: "vertical", backgroundColor: COLOR.goldPale, cornerRadius: "8px", paddingAll: "12px",
            contents: [
              { type: "text", text: "จำนวนเงิน", size: "xs", color: COLOR.textMid },
              { type: "text", text: `฿${TH_NUM(amount)}`, size: "xxl", weight: "bold", color: COLOR.maroon },
            ],
          },
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "text", text: "👤 พนักงาน", size: "sm", color: COLOR.textMid, flex: 2 },
            { type: "text", text: empName, size: "sm", weight: "bold", color: COLOR.text, flex: 4, wrap: true },
          ]},
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "text", text: "📅 เดือน", size: "sm", color: COLOR.textMid, flex: 2 },
            { type: "text", text: month || "-", size: "sm", color: COLOR.text, flex: 4 },
          ]},
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "text", text: "📝 เหตุผล", size: "sm", color: COLOR.textMid, flex: 2 },
            { type: "text", text: reason || "-", size: "sm", color: COLOR.text, flex: 4, wrap: true },
          ]},
          { type: "separator", margin: "md" },
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "text", text: "🏦 ธนาคาร", size: "sm", color: COLOR.textMid, flex: 2 },
            { type: "text", text: bank || "-", size: "sm", color: COLOR.text, flex: 4, wrap: true },
          ]},
          { type: "box", layout: "horizontal", spacing: "sm", contents: [
            { type: "text", text: "💳 เลขบัญชี", size: "sm", color: COLOR.textMid, flex: 2 },
            { type: "text", text: bankAcc || "-", size: "sm", color: COLOR.text, flex: 4, weight: "bold" },
          ]},
          { type: "text", text: `⏰ ส่งคำขอ: ${dtStr}`, size: "xs", color: "#B89A72", margin: "md" },
        ],
      },
    },
  };

  await pushLineMessage(config.LINE_CHANNEL_ACCESS_TOKEN, config.ADMIN_LINE_USER_ID, flex);
  return { ok: true, requestId };
});
