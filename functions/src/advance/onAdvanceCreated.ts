/**
 * onAdvanceCreated — Firestore trigger (auto-notify admin on new advance)
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import {
	FIRESTORE_DATABASE_ID,
	getLineConfig,
	isNotificationEnabled,
} from "../helpers/config.js";
import { pushLineMessage } from "../helpers/line.js";

export const onAdvanceCreated = onDocumentCreated(
	{ document: "advances/{advanceId}", database: FIRESTORE_DATABASE_ID },
	async (event) => {
		const advance = event.data?.data();
		if (!advance) return;
		console.log(`[onAdvanceCreated] New advance: ${event.params.advanceId}`);

		// Admin toggle: /admin → LINE BOT → การแจ้งเตือน
		if (!(await isNotificationEnabled("advanceRequestEnabled"))) {
			console.log("[onAdvanceCreated] disabled in admin config, skipping");
			return;
		}

		const config = await getLineConfig();
		if (!config.LINE_CHANNEL_ACCESS_TOKEN || !config.ADMIN_LINE_USER_ID) {
			console.warn("LINE config not set in /config/secrets");
			return;
		}

		const flexMessage = {
			type: "flex" as const,
			altText: `💸 คำขอเบิก ฿${advance.amount} — ${advance.employeeName}`,
			contents: {
				type: "bubble",
				body: {
					type: "box",
					layout: "vertical",
					contents: [
						{
							type: "text",
							text: "💸 คำขอเบิกล่วงหน้า",
							weight: "bold",
							size: "md",
							color: "#7B1C1C",
						},
						{ type: "separator", margin: "md" },
						{
							type: "text",
							text: advance.employeeName as string,
							weight: "bold",
							size: "lg",
							margin: "md",
						},
						{
							type: "text",
							text: `จำนวน: ฿${(advance.amount as number).toLocaleString("th-TH")}`,
							size: "sm",
							margin: "sm",
						},
						{
							type: "text",
							text: `เหตุผล: ${advance.reason}`,
							size: "sm",
							wrap: true,
							color: "#7A5C3A",
						},
					],
				},
			},
		};

		await pushLineMessage(
			config.LINE_CHANNEL_ACCESS_TOKEN,
			config.ADMIN_LINE_USER_ID,
			flexMessage,
		);
	},
);
