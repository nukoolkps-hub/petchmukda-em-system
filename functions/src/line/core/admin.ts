import { getAuth } from "firebase-admin/auth";
import type { LineConfig } from "../../types.js";

export async function isAuthorizedLineAdmin(
	lineUserId: string,
	config: LineConfig,
): Promise<boolean> {
	if (isConfiguredAdminLineUser(lineUserId, config.ADMIN_LINE_USER_ID)) {
		return true;
	}

	try {
		const user = await getAuth().getUser(lineUserId);
		return user.customClaims?.admin === true;
	} catch (error) {
		if ((error as { code?: string }).code === "auth/user-not-found") {
			return false;
		}
		throw error;
	}
}

function isConfiguredAdminLineUser(
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
