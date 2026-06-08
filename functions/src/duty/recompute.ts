/**
 * Recompute daily duty assignments + write self-contained snapshot to
 * /dutyAssignmentsToday/snapshot.
 *
 * ทำไม:
 * - Client-side compute ฝั่งพนักงานเห็นแค่ employee/leave ของตัวเอง
 *   (Firestore rules ปิดไว้) → activePool() เหลือแค่ตัวเอง → rotation ผิด
 * - แก้: Cloud Function อ่านด้วย admin SDK (เห็นทุก collection) → compute
 *   ทั้ง assignments + safe employee directory ใส่ลง 1 doc public
 *
 * Snapshot ออกแบบเป็น "self-contained" — ไม่ต้องอ่าน employees/leaves เพิ่ม
 * client แค่ subscribe doc เดียวแล้ว render ตรงๆ
 *
 * Trigger:
 * - HTTP callable (client เรียกหลัง CRUD ทุกอันที่มีผลกับ rotation)
 * - Scheduled daily 00:01 Bangkok (refresh ตอนวันเปลี่ยน)
 */

import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { bangkokYmd } from "../dailySummary/dateUtils.js";
import { getAppFirestore } from "../helpers/config.js";
import {
	computeAllDutiesForDay,
	type Duty,
	type Employee,
	type LeaveEntry,
	resolveDutyPool,
} from "./dutyUtils.js";

const APP_TIMEZONE = "Asia/Bangkok";

/** Safe employee projection — เปิดอ่านได้ทั่ว ไม่มี sensitive field
 *  (lineUserId, bank, baseSalary, piece rates ฯลฯ) */
interface SafeEmployee {
	id: string;
	name: string;
	nickname: string;
	avatar: string;
	avatarType: "text" | "emoji" | "image";
	avatarImageUrl: string | null;
	displayOrder: number | null;
}

interface AssignmentItem {
	dutyId: string;
	dutyName: string;
	period: "weekly" | "monthly";
	primaryEmpId: string | null;
	actualEmpId: string | null;
	reason:
		| "rotation"
		| "substitute_for_leave"
		| "double_up"
		| "all_on_leave"
		| "empty_pool";
	periodStart: string;
	periodEnd: string;
	pool: SafeEmployee[]; // pool members สำหรับ display ใน admin DutyCard
	excludedCount: number;
}

interface Snapshot {
	date: string;
	assignments: AssignmentItem[];
	updatedAt: number;
}

function toSafe(e: Employee): SafeEmployee {
	return {
		id: e.id,
		name: e.name || "",
		nickname: e.nickname || "",
		avatar: e.avatar || "",
		avatarType: e.avatarType || "text",
		avatarImageUrl: e.avatarImageUrl || null,
		displayOrder: typeof e.displayOrder === "number" ? e.displayOrder : null,
	};
}

async function buildSnapshot(): Promise<Snapshot> {
	const db = getAppFirestore();
	const ymd = bangkokYmd(new Date());

	const [dutiesSnap, employeesSnap, leavesSnap] = await Promise.all([
		db.collection("duties").get(),
		db.collection("employees").get(),
		// only leaves ที่ยังไม่จบ → filter start <= today ใน memory
		db.collection("leaves").where("end", ">=", ymd).get(),
	]);

	const duties: Duty[] = dutiesSnap.docs
		.map((d) => ({ id: d.id, ...d.data() }) as Duty)
		.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

	const employees: Employee[] = employeesSnap.docs.map(
		(d) => ({ id: d.id, ...d.data() }) as Employee,
	);

	const leaves: LeaveEntry[] = leavesSnap.docs
		.map((d) => d.data() as LeaveEntry)
		.filter((l) => l.start <= ymd && l.end >= ymd);

	const assignments = computeAllDutiesForDay(duties, ymd, employees, leaves);

	// dutyId → resolved pool members (safe projection)
	const items: AssignmentItem[] = assignments.map((a) => {
		const duty = duties.find((d) => d.id === a.dutyId);
		const pool = duty ? resolveDutyPool(duty, employees).map(toSafe) : [];
		const excludedCount = duty?.excludedEmpIds?.length || 0;
		return {
			dutyId: a.dutyId,
			dutyName: a.dutyName,
			period: a.period,
			primaryEmpId: a.primaryEmpId,
			actualEmpId: a.actualEmpId,
			reason: a.reason,
			periodStart: a.periodStart,
			periodEnd: a.periodEnd,
			pool,
			excludedCount,
		};
	});

	return {
		date: ymd,
		assignments: items,
		updatedAt: Date.now(),
	};
}

async function writeSnapshot(): Promise<Snapshot> {
	const snap = await buildSnapshot();
	const db = getAppFirestore();
	await db.doc("dutyAssignmentsToday/snapshot").set(snap);
	return snap;
}

/** HTTP callable — client เรียกหลัง duty/employee/leave CRUD เพื่อ refresh
 *  snapshot real-time · ต้อง signed-in (auth.uid ใดๆ ก็ได้)               */
export const recomputeDutyAssignments = onCall(async (request) => {
	if (!request.auth?.uid) {
		throw new HttpsError("unauthenticated", "ต้อง sign-in ก่อน");
	}
	try {
		const snap = await writeSnapshot();
		return { ok: true, date: snap.date, count: snap.assignments.length };
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.error("[recomputeDutyAssignments] error:", msg);
		throw new HttpsError("internal", msg);
	}
});

/** Scheduled daily 00:01 Bangkok — refresh ตอนวันเปลี่ยน · period index
 *  ของ weekly/monthly เปลี่ยน → primary หมุน                                */
export const recomputeDutyAssignmentsDaily = onSchedule(
	{
		schedule: "1 0 * * *",
		timeZone: APP_TIMEZONE,
		timeoutSeconds: 60,
	},
	async () => {
		try {
			const snap = await writeSnapshot();
			console.log(
				`[recomputeDutyAssignmentsDaily] wrote ${snap.assignments.length} assignments for ${snap.date}`,
			);
		} catch (err) {
			console.error("[recomputeDutyAssignmentsDaily] error:", err);
			throw err;
		}
	},
);
