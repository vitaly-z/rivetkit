import type { cors } from "hono/cors";
import { z } from "zod";
import { HEADER_ACTOR_QUERY } from "@/driver-helpers/mod";
import { getEnvUniversal } from "@/utils";

type CorsOptions = NonNullable<Parameters<typeof cors>[0]>;

const defaultTokenFn = () => {
	const envToken = getEnvUniversal("RIVETKIT_STUDIO_TOKEN");

	if (envToken) {
		return envToken;
	}

	return "";
};

const defaultEnabled = () => {
	return (
		getEnvUniversal("NODE_ENV") !== "production" ||
		!getEnvUniversal("RIVETKIT_STUDIO_DISABLE")
	);
};

const defaultCors: CorsOptions = {
	origin: (origin) =>
		["http://localhost:43708", "https://studio.rivet.gg/"].includes(origin) ||
		(origin.startsWith("https://") && origin.endsWith("rivet-studio.pages.dev"))
			? origin
			: "https://studio.rivet.gg/",
	allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowHeaders: ["Content-Type", "Authorization", HEADER_ACTOR_QUERY],
	maxAge: 3600,
	credentials: true,
};

export const InspectorConfigSchema = z
	.object({
		enabled: z.boolean().optional().default(defaultEnabled),
		/** CORS configuration for the router. Uses Hono's CORS middleware options. */
		cors: z
			.custom<CorsOptions>()
			.optional()
			.default(() => defaultCors),

		/**
		 * Token used to access the Studio.
		 */
		token: z
			.function()
			.returns(z.string())
			.optional()
			.default(() => defaultTokenFn),

		/**
		 * Default RivetKit server endpoint for Rivet Studio to connect to. This should be the same endpoint as what you use for your Rivet client to connect to RivetKit.
		 *
		 * This is a convenience property just for printing out the studio URL.
		 */
		defaultEndpoint: z.string().optional(),
	})
	.optional()
	.default(() => ({
		enabled: defaultEnabled(),
		token: defaultTokenFn,
		cors: defaultCors,
	}));
export type InspectorConfig = z.infer<typeof InspectorConfigSchema>;
