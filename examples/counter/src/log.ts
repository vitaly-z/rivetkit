// @ts-types="../../common/dist/log.d.ts"
import { getLogger } from "@rivet-gg/actor-common/log";

export const LOGGER_NAME = "driver-cloudflare-workers";

export function logger() {
	return getLogger(LOGGER_NAME);
}
