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
	/** (weekly) ข้ามวันอาทิตย์ — focus ขายแทน */
	skipSundays?: boolean;
	/** Primary cache (B) — pool เปลี่ยนกลาง period ไม่กระทบคนทำหน้าที่ */
	cachedPrimary?: {
		periodIndex: number;
		empId: string;
	} | null;
	createdAt?: number;
	updatedAt?: number;
}

/** วันอาทิตย์ของวันที่ ymd ("YYYY-MM-DD") — parse แบบ local-date เลี่ยง TZ
 *  ⚠️ ต้องเหมือน src/utils/dutyUtils.ts เป๊ะ                              */
export function isSunday(ymd: string): boolean {
	const [y, m, d] = ymd.split("-").map(Number);
	return new Date(y, m - 1, d).getDay() === 0;
}

/** filter หน้าที่ที่ "applicable วันนี้" — weekly + skipSundays + วันอาทิตย์
 *  → ถูกตัดออก · ใช้ก่อนเข้า phase ใด                                    */
export function applicableDuties(duties: Duty[], todayYmd: string): Duty[] {
	if (!isSunday(todayYmd)) return duties;
	return duties.filter((d) => !(d.period === "weekly" && d.skipSundays));
}

/** FNV-1a 32-bit hash (A) — stable slot per duty.id แทนตำแหน่งใน array
 *  ⚠️ ต้องเหมือน src/utils/dutyUtils.ts เป๊ะ (client/server compute ตรงกัน) */
export function hashDutyId(id: string): number {
	let h = 2166136261;
	for (let i = 0; i < id.length; i++) {
		h ^= id.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}

/** เลือก primary (A+B) — cache → hash base → skip-collision (กระจายคน)
 *  used = คนที่เป็น primary ของหน้าที่อื่นในรอบนี้แล้ว · คืน null เมื่อ pool
 *  ว่าง (safety net) · ⚠️ ต้องตรงกับ src/utils/dutyUtils.ts เป๊ะ           */
export function pickPrimary(
	duty: Duty,
	pool: string[],
	periodIdx: number,
	used: Set<string>,
): string | null {
	if (pool.length === 0) return null; // กัน % 0 = NaN
	const cache = duty.cachedPrimary;
	if (
		cache &&
		cache.periodIndex === periodIdx &&
		pool.includes(cache.empId) &&
		!used.has(cache.empId)
	) {
		return cache.empId;
	}
	const base = (periodIdx + hashDutyId(duty.id)) % pool.length;
	for (let off = 0; off < pool.length; off++) {
		const cand = pool[(base + off) % pool.length];
		if (!used.has(cand)) return cand;
	}
	return pool[base]; // ทุกคนถูกใช้หมด → ยอมซ้ำ
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
	poolExclusion?: "sell" | "buy" | "both" | "" | null;
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
	// คน poolExclusion="both" ห้ามทำ monthly duty (ติดทั้งเดือนเสี่ยงหลุดเกณฑ์
	// 50% เงินเดือนพื้นฐาน โดย exemption ช่วยไม่ได้)
	const blockBoth = duty.period === "monthly";
	return employees
		.filter(
			(e) =>
				e.roleId === duty.roleId &&
				!e.salaryDisabled &&
				!excluded.has(e.id) &&
				!(blockBoth && e.poolExclusion === "both"),
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
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
	excludeForPrimary: Set<string>,
	primariesToday: Set<string>,
	precomputedPrimary?: string,
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
	// ใช้ primary ที่ Phase 1/2 คำนวณไว้ (cache + hash + de-collide) ถ้ายัง
	// อยู่ใน pool · ไม่งั้น compute เอง — ใช้ primariesToday เป็น used set
	// เพื่อเคารพ skip-collision แม้ใน fallback
	const primary =
		precomputedPrimary && pool.includes(precomputedPrimary)
			? precomputedPrimary
			: pickPrimary(duty, pool, idx, primariesToday);
	if (!primary) {
		// pool ว่างหลัง filter ทุกชั้น (ไม่ควรถึง — fullPool guard ด้านบน)
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

	// substitute scan เริ่มจากตำแหน่ง primary ใน pool (deterministic)
	const startIdx = Math.max(0, pool.indexOf(primary));
	for (let offset = 1; offset < pool.length; offset++) {
		const cand = pool[(startIdx + offset) % pool.length];
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
		const cand = pool[(startIdx + offset) % pool.length];
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
	// ตัด weekly+skipSundays ออกตั้งแต่ต้น ถ้าวันนี้เป็นวันอาทิตย์
	// (assignment ของหน้าที่นั้นจะไม่ปรากฏใน snapshot เลย → หน้าจอพนักงาน
	// สะอาด ไม่ต้องโชว์ "พักวันอาทิตย์")
	const todayDuties = applicableDuties(duties, todayYmd);
	// แยก coverage ออกจาก rotation
	const coverageDuties = todayDuties.filter((d) => d.kind === "coverage");
	const rotationDuties = todayDuties.filter((d) => d.kind !== "coverage");

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
	// ใช้ todayDuties (หลัง filter Sunday-off) เพื่อไม่ให้หน้าที่ที่ถูกข้าม
	// โผล่ใน output เพราะอยู่ใน outer duties array
	for (const duty of todayDuties) {
		const list = byId.get(duty.id);
		if (list) out.push(...list);
	}
	return out;
}

/** assign primary ให้หน้าที่กลุ่มหนึ่ง — ลูปเดียวใช้ทั้ง monthly (lockPicked)
 *  และ weekly · ⚠️ ต้องตรงกับ src/utils/dutyUtils.ts เป๊ะ                  */
function assignPrimaries(
	duties: Duty[],
	todayYmd: string,
	poolOf: (duty: Duty) => string[],
	assigned: Set<string>,
	locked: Set<string>,
	lockPicked: boolean,
	out: Map<string, string>,
): void {
	for (const duty of duties) {
		const fullPool = poolOf(duty);
		if (fullPool.length === 0) continue;
		const remaining = fullPool.filter((id) => !locked.has(id));
		const pool = remaining.length > 0 ? remaining : fullPool;
		const idx = Math.max(0, getPeriodIndex(duty, todayYmd));
		const primary = pickPrimary(duty, pool, idx, assigned);
		if (!primary) continue;
		assigned.add(primary);
		if (lockPicked) locked.add(primary);
		out.set(duty.id, primary);
	}
}

function computeRotationForDay(
	duties: Duty[],
	todayYmd: string,
	employees: Employee[],
	leaves: LeaveEntry[],
): DutyAssignment[] {
	const monthlyDuties = duties.filter((d) => d.period === "monthly");
	const weeklyDuties = duties.filter((d) => d.period === "weekly");

	// assigned = คนที่เป็น primary แล้วรอบนี้ (pickPrimary skip-collision)
	const assigned = new Set<string>();
	const lockedByMonthly = new Set<string>();
	const primaryByDuty = new Map<string, string>();
	const poolOf = (duty: Duty) => activePool(duty, employees);

	assignPrimaries(
		monthlyDuties,
		todayYmd,
		poolOf,
		assigned,
		lockedByMonthly,
		true,
		primaryByDuty,
	);
	assignPrimaries(
		weeklyDuties,
		todayYmd,
		poolOf,
		assigned,
		lockedByMonthly,
		false,
		primaryByDuty,
	);

	const primariesToday = new Set<string>(primaryByDuty.values());

	return duties.map((duty) =>
		computeDutyForDay(
			duty,
			todayYmd,
			employees,
			leaves,
			duty.period === "monthly" ? new Set<string>() : lockedByMonthly,
			primariesToday,
			primaryByDuty.get(duty.id),
		),
	);
}
