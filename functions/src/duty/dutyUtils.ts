/**
 * Duty rotation + substitute logic — server-side port of src/utils/dutyUtils.ts
 *
 * Pure functions: รับ duties + employees + leaves → output assignments
 * Algorithm ตรงกับ client เป๊ะ (admin local compute = server result)
 */

export interface Duty {
	id: string;
	name: string;
	period: "weekly" | "monthly";
	roleId: string;
	excludedEmpIds?: string[];
	rotationStartDate: string; // "YYYY-MM-DD"
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
	| "empty_pool";

export interface DutyAssignment {
	dutyId: string;
	dutyName: string;
	period: "weekly" | "monthly";
	primaryEmpId: string | null;
	actualEmpId: string | null;
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

export function computeAllDutiesForDay(
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
