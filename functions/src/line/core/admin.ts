import type { LineConfig } from "../../types.js";

export async function isAuthorizedLineAdmin(
	lineUserId: string,
	config: LineConfig,
): Promise<boolean> {
	return isConfiguredAdminLineUser(lineUserId, config.ADMIN_LINE_USER_ID);
}

export function isConfiguredAdminLineUser(
	lineUserId: string,
	configValue: string | undefined,
): boolean {
	return (
		configValue
			?.split(/[,\s]+/)
			.map((value) => value.trim())
			.filter(Boolean)
			.includes(lineUserId) || false
	);
}
