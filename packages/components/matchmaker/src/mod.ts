import type { AnyActorConstructor } from "actor-core";
import { Matchmaker } from "./actor";
import { type InputConfig, ConfigSchema } from "./config";

export { Matchmaker };

export function matchmaker(inputConfig: InputConfig): AnyActorConstructor {
	const config = ConfigSchema.parse(inputConfig);
	return class extends Matchmaker {
		constructor() {
			super(config);
		}
	};
}
