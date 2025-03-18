import {
	type ActorConfig,
	type Actions,
} from "./config";
import { ActorInstance } from "./instance";
import { ActorContext } from "./context";

export type AnyActorDefinition = ActorDefinition<any, any, any, any>;

/**
 * Extracts the context type from an ActorDefinition
 */
export type ActorContextOf<AD extends AnyActorDefinition> = 
	AD extends ActorDefinition<infer S, infer CP, infer CS, any> 
		? ActorContext<S, CP, CS> 
		: never;

export class ActorDefinition<S, CP, CS, R extends Actions<S, CP, CS>> {
	#config: ActorConfig<S, CP, CS>;

	constructor(config: ActorConfig<S, CP, CS>) {
		this.#config = config;
	}

	instantiate(): ActorInstance<S, CP, CS> {
		return new ActorInstance(this.#config);
	}
}
