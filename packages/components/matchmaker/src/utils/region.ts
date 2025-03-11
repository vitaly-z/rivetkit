import { z } from "zod";
import type { LobbyBackend } from "../config";
import { REGIONS as LOCAL_DEVELOPMENT_REGIONS } from "./lobby/backend/local_development";
import { REGIONS as SERVER_REGIONS } from "./lobby/backend/server";
import { REGIONS as TEST_REGIONS } from "./lobby/backend/test";
import { assertUnreachable } from "actor-core/utils";

export const RegionSchema = z.object({
	slug: z.string(),
	name: z.string(),
	latitude: z.number(),
	longitude: z.number(),
});
export type Region = z.infer<typeof RegionSchema>;

export function regionsForBackend(backend: LobbyBackend): Region[] {
	if ("test" in backend) return TEST_REGIONS;
	else if ("localDevelopment" in backend) return LOCAL_DEVELOPMENT_REGIONS;
	else if ("server" in backend) return SERVER_REGIONS;
	else assertUnreachable(backend);
}
