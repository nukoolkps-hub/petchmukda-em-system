/**
 * Duty rotation + substitute logic — server-side port of src/utils/dutyUtils.ts
 *
 * Pure functions: รับ duties + employees + leaves → output assignments
 * Algorithm ตรงกับ client เป๊ะ (admin local compute = server result)
 */

export interface Duty {
	id: string;
	name: string;
	kind?: "rotation" | "coverage";
	period: "weekly" | "monthly";
	roleId: string;
	excludedEmpIds?: string[];
	rotationStartDate: string; // "YYYY-MM-DD"
	coverageRoleId?: string;
	candidateEmpIds?: string[];
	createdAt?: number;
	updatedAt?: number;
}

export interface Employee {
	id: string;
	name: string;
	nickname?: string;
	avatar: string;
	avatarType: "text" | "emoji" | "image";
	avatarImageUrl: string | null;
	roleId: string;
	displayOrder?: number;
	salaryDisabled?: boolean;
}

export interface LeaveEntry {
	employeeId: string;
	start: string;
	end: string;
}

export type DutyReason =
	| "rotation"
	| "substitute_for_leave"
	| "double_up"
	| "all_on_leave"
	| "empty_pool"
	// coverage (kind="coverage")
	| "coverage" // มีคนแทนเรียบร้อย
	| "coverage_no_candidate" // ตำแหน่งเป้าหมายลา แต่หาคนแทนไม่ได้
	| "empty_target_role" // ตำแหน่งเป้าหมายไม่มีคนเลย (admin ตั้งค่าผิด)
	| "target_present"; // ไม่มีคนในตำแหน่งเป้าหมายลาวันนี้

export interface DutyAssignment {
	dutyId: string;
	dutyName: string;
	kind?: "rotation" | "coverage";
	period: "weekly" | "monthly";
	primaryEmpId: string | null;
	actualEmpId: string | null;
	/** coverage: คนในตำแหน่งเป้าหมายที่ลา (คนที่ถูกแทน) */
	targetEmpId?: string | null;
	reason: DutyReason;
	periodStart: string;
	periodEnd: string;
}

function toYMD(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

function daysBetween(startYmd: string, todayYmd: string): number {
	const a = new Date(`${startYmd}T00:00:00`);
	const b = new Date(`${todayYmd}T00:00:00`);
	return Math.floor((b.getTime() - a.getTime()) / 86_400_000);
}

function monthsBetween(startYmd: string, todayYmd: string): number {
	const a = new Date(`${startYmd}T00:00:00`);
	const b = new Date(`${todayYmd}T00:00:00`);
	return (
		(b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
	);
}

export function getPeriodIndex(duty: Duty, todayYmd: string): number {
	if (duty.period === "weekly") {
		return Math.floor(daysBetween(duty.rotationStartDate, todayYmd) / 7);
	}
	return monthsBetween(duty.rotationStartDate, todayYmd);
}

export function getPeriodRange(
	duty: Duty,
	todayYmd: string,
): { start: string; end: string } {
	const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
	const start = new Date(`${duty.rotationStartDate}T00:00:00`);
	if (duty.period === "weekly") {
		start.setDate(start.getDate() + idx * 7);
		const end = new Date(start);
		end.setDate(end.getDate() + 6);
		return { start: toYMD(start), end: toYMD(end) };
	}
	start.setMonth(start.getMonth() + idx);
	start.setDate(1);
	const end = new Date(start);
	end.setMonth(end.getMonth() + 1);
	end.setDate(0);
	return { start: toYMD(start), end: toYMD(end) };
}

function isOnLeave(leaves: LeaveEntry[], empId: string, ymd: string): boolean {
	return leaves.some(
		(l) => l.employeeId === empId && l.start <= ymd && l.end >= ymd,
	);
}

export function resolveDutyPool(duty: Duty, employees: Employee[]): Employee[] {
	const excluded = new Set(duty.excludedEmpIds || []);
	return employees
		.filter(
			(e) =>
				e.roleId === duty.roleId && !e.salaryDisabled && !excluded.has(e.id),
		)
		.sort((a, b) => {
			const ao = typeof a.displayOrder === "number" ? a.displayOrder : null;
			const bo = typeof b.displayOrder === "number" ? b.displayOrder : null;
			if (ao !== null && bo !== null) return ao - bo;
			if (ao !== null) return -1;
			if (bo !== null) return 1;
			return (a.name || "").localeCompare(b.name || "", "th");
		});
}

function activePool(duty: Duty, employees: Employee[]): string[] {
	return resolveDutyPool(duty, employees).map((e) => e.id);
}

export function computeDutyForDay(
	duty: Duty,
	dutyIndex: number,
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
	excludeForPrimary: Set<string>,
	primariesToday: Set<string>,
): DutyAssignment {
	const fullPool = activePool(duty, employees);
	const { start: periodStart, end: periodEnd } = getPeriodRange(duty, todayYmd);

	if (fullPool.length === 0) {
		return {
			dutyId: duty.id,
			dutyName: duty.name,
			period: duty.period,
			primaryEmpId: null,
			actualEmpId: null,
			reason: "empty_pool",
			periodStart,
			periodEnd,
		};
	}

	const preferredPool = fullPool.filter((id) => !excludeForPrimary.has(id));
	const pool = preferredPool.length > 0 ? preferredPool : fullPool;

	const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
	const primary = pool[(idx + dutyIndex) % pool.length];

	if (!isOnLeave(leaves, primary, todayYmd)) {
		return {
			dutyId: duty.id,
			dutyName: duty.name,
			period: duty.period,
			primaryEmpId: primary,
			actualEmpId: primary,
			reason: "rotation",
			periodStart,
			periodEnd,
		};
	}

	const baseOffset = idx + dutyIndex;
	for (let offset = 1; offset < pool.length; offset++) {
		const cand = pool[(baseOffset + offset) % pool.length];
		if (cand === primary) continue;
		if (isOnLeave(leaves, cand, todayYmd)) continue;
		if (primariesToday.has(cand)) continue;
		return {
			dutyId: duty.id,
			dutyName: duty.name,
			period: duty.period,
			primaryEmpId: primary,
			actualEmpId: cand,
			reason: "substitute_for_leave",
			periodStart,
			periodEnd,
		};
	}

	for (let offset = 1; offset < pool.length; offset++) {
		const cand = pool[(baseOffset + offset) % pool.length];
		if (cand === primary) continue;
		if (isOnLeave(leaves, cand, todayYmd)) continue;
		return {
			dutyId: duty.id,
			dutyName: duty.name,
			period: duty.period,
			primaryEmpId: primary,
			actualEmpId: cand,
			reason: "double_up",
			periodStart,
			periodEnd,
		};
	}

	return {
		dutyId: duty.id,
		dutyName: duty.name,
		period: duty.period,
		primaryEmpId: primary,
		actualEmpId: null,
		reason: "all_on_leave",
		periodStart,
		periodEnd,
	};
}

/* ─── Coverage (เวรแทนคนลาของตำแหน่งเป้าหมาย) ───────────────────────
   เลือกคนแทนจาก candidateEmpIds ที่ "เคยแทนน้อยสุด" (ยุติธรรม) →
   tie-break ด้วย displayOrder · ข้ามคนที่ลา/ถูกใช้ไปแล้ววันนั้น
   coverageHistory = empId → จำนวนครั้งที่เคยแทนสะสม (จาก replay)        */
function pickCoverageCandidate(
	duty: Duty,
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
	history: Map<string, number>,
	usedToday: Set<string>,
): string | null {
	const byId = new Map(employees.map((e) => [e.id, e]));
	const eligible = (duty.candidateEmpIds || [])
		.map((id) => byId.get(id))
		.filter(
			(e): e is Employee =>
				!!e &&
				!e.salaryDisabled &&
				!usedToday.has(e.id) &&
				!isOnLeave(leaves, e.id, todayYmd),
		)
		.sort((a, b) => {
			const ca = history.get(a.id) || 0;
			const cb = history.get(b.id) || 0;
			if (ca !== cb) return ca - cb; // เคยแทนน้อยสุดก่อน
			const ao = typeof a.displayOrder === "number" ? a.displayOrder : 1e9;
			const bo = typeof b.displayOrder === "number" ? b.displayOrder : 1e9;
			if (ao !== bo) return ao - bo;
			return (a.name || "").localeCompare(b.name || "", "th");
		});
	return eligible.length > 0 ? eligible[0].id : null;
}

/** คนในตำแหน่งเป้าหมายที่ลาวันนี้ (ต้องหาคนแทน) เรียงตาม displayOrder */
function absentTargets(
	duty: Duty,
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
): string[] {
	return employees
		.filter(
			(e) =>
				e.roleId === duty.coverageRoleId &&
				!e.salaryDisabled &&
				isOnLeave(leaves, e.id, todayYmd),
		)
		.sort(
			(a, b) =>
				(typeof a.displayOrder === "number" ? a.displayOrder : 1e9) -
				(typeof b.displayOrder === "number" ? b.displayOrder : 1e9),
		)
		.map((e) => e.id);
}

/** Replay coverage ทั้งช่วง [startYmd, endYmd) เพื่อนับว่าใครแทนไปกี่ครั้ง
 *  (ใช้สร้าง history สำหรับเลือกคนที่ยุติธรรมในวันนี้)                    */
export function replayCoverageHistory(
	coverageDuties: Duty[],
	employees: Employee[],
	allLeaves: LeaveEntry[],
	startYmd: string,
	endYmd: string,
): Map<string, number> {
	const history = new Map<string, number>();
	if (coverageDuties.length === 0) return history;
	const start = new Date(`${startYmd}T00:00:00`);
	const end = new Date(`${endYmd}T00:00:00`);
	for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
		const ymd = toYMD(d);
		const usedToday = new Set<string>();
		for (const duty of coverageDuties) {
			for (const _t of absentTargets(duty, ymd, employees, allLeaves)) {
				const pick = pickCoverageCandidate(
					duty,
					ymd,
					employees,
					allLeaves,
					history,
					usedToday,
				);
				if (pick) {
					usedToday.add(pick);
					history.set(pick, (history.get(pick) || 0) + 1);
				}
			}
		}
	}
	return history;
}

/** คำนวณ coverage ของวันนี้ + คืน set คนที่ถูกดึงไปแทน (เพื่อให้ rotation
 *  ปล่อย slot weekly ของเขาแล้วหาคนอื่นแทน — cascade)                    */
function computeCoverageForDay(
	coverageDuties: Duty[],
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
	history: Map<string, number>,
): { assignments: DutyAssignment[]; pulled: Set<string> } {
	const assignments: DutyAssignment[] = [];
	const pulled = new Set<string>();
	const usedToday = new Set<string>();
	const nameById = new Map(employees.map((e) => [e.id, e]));
	for (const duty of coverageDuties) {
		// แยกเคส: ตำแหน่งเป้าหมายไม่มีคนเลย (admin ตั้งค่าผิด) vs ทุกคนมาทำงานปกติ
		const hasAnyTarget = employees.some(
			(e) => e.roleId === duty.coverageRoleId && !e.salaryDisabled,
		);
		const targets = absentTargets(duty, todayYmd, employees, leaves);
		if (targets.length === 0) {
			assignments.push({
				dutyId: duty.id,
				dutyName: duty.name,
				kind: "coverage",
				period: "weekly",
				primaryEmpId: null,
				actualEmpId: null,
				targetEmpId: null,
				reason: hasAnyTarget ? "target_present" : "empty_target_role",
				periodStart: todayYmd,
				periodEnd: todayYmd,
			});
			continue;
		}
		for (const targetId of targets) {
			const pick = pickCoverageCandidate(
				duty,
				todayYmd,
				employees,
				leaves,
				history,
				usedToday,
			);
			if (pick) {
				usedToday.add(pick);
				pulled.add(pick);
			}
			assignments.push({
				dutyId: duty.id,
				dutyName: duty.name,
				kind: "coverage",
				period: "weekly",
				primaryEmpId: null,
				actualEmpId: pick,
				targetEmpId: targetId,
				reason: pick ? "coverage" : "coverage_no_candidate",
				periodStart: todayYmd,
				periodEnd: todayYmd,
			});
			// บันทึกเพื่อให้วันถัดไปยุติธรรม (ในการ replay จะนับเองอยู่แล้ว
			// แต่กรณีหลายเป้าหมายวันเดียว เพิ่ม count ทันทีกันเลือกซ้ำคนเดิม)
			if (pick) history.set(pick, (history.get(pick) || 0) + 1);
			void nameById;
		}
	}
	return { assignments, pulled };
}

export function computeAllDutiesForDay(
	duties: Duty[],
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
	coverageHistory?: Map<string, number>,
): DutyAssignment[] {
	// แยก coverage ออกจาก rotation
	const coverageDuties = duties.filter((d) => d.kind === "coverage");
	const rotationDuties = duties.filter((d) => d.kind !== "coverage");

	// 1) coverage ก่อน — รู้ว่าใครถูกดึงไปแทนบัญชี
	const { assignments: coverageAssignments, pulled } = computeCoverageForDay(
		coverageDuties,
		todayYmd,
		employees,
		leaves,
		coverageHistory ?? new Map<string, number>(),
	);

	// 2) คนที่ถูกดึงไปแทน → ถือว่า "ไม่ว่าง" สำหรับ weekly/monthly ของตัวเอง
	//    (cascade: weekly ของเขาจะหาคนอื่นแทนผ่าน substitute logic เดิม)
	const effLeaves =
		pulled.size > 0
			? [
					...leaves,
					...[...pulled].map((id) => ({
						employeeId: id,
						start: todayYmd,
						end: todayYmd,
					})),
				]
			: leaves;

	const rotationAssignments = computeRotationForDay(
		rotationDuties,
		todayYmd,
		employees,
		effLeaves,
	);

	// preserve ลำดับ duties เดิม + coverage ตามตำแหน่งของมัน
	const byId = new Map<string, DutyAssignment[]>();
	for (const a of rotationAssignments)
		byId.set(a.dutyId, [...(byId.get(a.dutyId) || []), a]);
	for (const a of coverageAssignments)
		byId.set(a.dutyId, [...(byId.get(a.dutyId) || []), a]);
	const out: DutyAssignment[] = [];
	for (const duty of duties) {
		const list = byId.get(duty.id);
		if (list) out.push(...list);
	}
	return out;
}

function computeRotationForDay(
	duties: Duty[],
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
): DutyAssignment[] {
	const monthlyDuties = duties.filter((d) => d.period === "monthly");
	const weeklyDuties = duties.filter((d) => d.period === "weekly");

	const lockedByMonthly = new Set<string>();
	const monthlyPrimaries = new Map<string, string>();
	monthlyDuties.forEach((duty, monthlyIdx) => {
		const fullPool = activePool(duty, employees);
		if (fullPool.length === 0) return;
		const remaining = fullPool.filter((id) => !lockedByMonthly.has(id));
		const pool = remaining.length > 0 ? remaining : fullPool;
		const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
		const primary = pool[(idx + monthlyIdx) % pool.length];
		lockedByMonthly.add(primary);
		monthlyPrimaries.set(duty.id, primary);
	});

	const weeklyPrimaries = new Map<string, string>();
	weeklyDuties.forEach((duty, weeklyIdx) => {
		const fullPool = activePool(duty, employees);
		if (fullPool.length === 0) return;
		const preferred = fullPool.filter((id) => !lockedByMonthly.has(id));
		const pool = preferred.length > 0 ? preferred : fullPool;
		const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
		const primary = pool[(idx + weeklyIdx) % pool.length];
		weeklyPrimaries.set(duty.id, primary);
	});

	const primariesToday = new Set<string>([
		...monthlyPrimaries.values(),
		...weeklyPrimaries.values(),
	]);

	let monthlyCounter = 0;
	let weeklyCounter = 0;
	return duties.map((duty) => {
		if (duty.period === "monthly") {
			const dutyIndex = monthlyCounter++;
			return computeDutyForDay(
				duty,
				dutyIndex,
				todayYmd,
				employees,
				leaves,
				new Set<string>(),
				primariesToday,
			);
		}
		const dutyIndex = weeklyCounter++;
		return computeDutyForDay(
			duty,
			dutyIndex,
			todayYmd,
			employees,
			leaves,
			lockedByMonthly,
			primariesToday,
		);
	});
}
