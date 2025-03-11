import { getLogger } from "actor-core/log";

export const LOGGER_NAME = "component-matchmaker";

export function logger() {
	return getLogger(LOGGER_NAME);
}
