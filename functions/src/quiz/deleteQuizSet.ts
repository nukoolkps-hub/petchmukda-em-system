/**
 * ลบชุดข้อสอบ — callable (admin เท่านั้น)
 *
 * `firestore.rules` ปิดการลบชุดที่เผยแพร่แล้วไว้สนิท เพราะใบที่สอบไปแล้ว
 * อ้าง `attempt.quizId` มาที่ชุดนั้น — ลบทิ้งแล้วหน้าตรวจจะอ่านโจทย์/เกณฑ์
 * ของชุดนั้นไม่ได้อีกเลย (ขึ้นกล่องแดงผ่าน `isKnownQuizId`)
 *
 * แต่ชุดที่ **ไม่มีใบสอบอ้างถึงเลย** (เช่น เผยแพร่ผิด/ลองระบบ) ลบได้โดยไม่มี
 * อะไรเสียหาย · rules query ข้าม collection ไม่ได้ → เช็คตรงนี้ด้วย Admin SDK
 * แล้วค่อยลบ · client ยังลบชุดที่เผยแพร่แล้วตรงๆ ไม่ได้เหมือนเดิม
 *
 * เงื่อนไขที่ต้องผ่านครบ:
 * 1. ไม่ใช่ชุดที่ตั้งเป็น "ใช้สอบอยู่" (`/config/quizActive`)
 * 2. ไม่มี `quizAttempts` ใบไหนอ้างถึง — แม้แต่ใบที่ยกเลิกไปแล้วก็นับ
 *    (ประวัติต้องอ่านโจทย์ของชุดนั้นได้)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { getAppFirestore } from "../helpers/config.js";

export const deleteQuizSet = onCall(
	async (req): Promise<{ deleted: boolean }> => {
		if (req.auth?.token?.admin !== true) {
			throw new HttpsError("permission-denied", "admin only");
		}
		const quizId = String(
			(req.data as { quizId?: unknown } | undefined)?.quizId ?? "",
		).trim();
		if (!quizId) {
			throw new HttpsError("invalid-argument", "ต้องระบุ quizId");
		}

		const db = getAppFirestore();
		const ref = db.doc(`quizSets/${quizId}`);
		const snap = await ref.get();
		if (!snap.exists) {
			throw new HttpsError("not-found", "ไม่พบชุดข้อสอบนี้");
		}

		const activeSnap = await db.doc("config/quizActive").get();
		if (String(activeSnap.data()?.quizId ?? "") === quizId) {
			throw new HttpsError(
				"failed-precondition",
				"ชุดนี้กำลังใช้สอบอยู่ — เปลี่ยนไปใช้ชุดอื่นก่อนถึงจะลบได้",
			);
		}

		// นับใบสอบที่อ้างถึงชุดนี้ — count aggregate ไม่ต้องดึงคำตอบทั้งก้อนมา
		const used = await db
			.collection("quizAttempts")
			.where("quizId", "==", quizId)
			.count()
			.get();
		const attempts = used.data().count;
		if (attempts > 0) {
			throw new HttpsError(
				"failed-precondition",
				`มีใบสอบอ้างถึงชุดนี้อยู่ ${attempts} ใบ — ลบแล้วใบพวกนั้นจะอ่านโจทย์เดิมไม่ได้`,
			);
		}

		await ref.delete();
		console.log(`[deleteQuizSet] ${quizId} by ${req.auth?.uid}`);
		return { deleted: true };
	},
);
