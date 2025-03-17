import {
	type ActorConfig,
	type Actions,
	type ActorConfigInput,
	ActorConfigSchema,
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

// Allow construction config with either a static object or a function.
//
// The function can be used to define ephemeral state.
export type ActorConfigInputOrBuilder<S, CP, CS, R extends Actions<S, CP, CS>> =
	| ActorConfigInput<S, CP, CS, R>
	| ((c: ActorContext<S, CP, CS>) => ActorConfigInput<S, CP, CS, R>);

export class ActorDefinition<S, CP, CS, R extends Actions<S, CP, CS>> {
	#configOrBuilder: ActorConfigInputOrBuilder<S, CP, CS, R>;

	constructor(config: ActorConfigInputOrBuilder<S, CP, CS, R>) {
		this.#configOrBuilder = config;
	}

	instantiate(): ActorInstance<S, CP, CS> {
		// Create actor before we get the config so we can pass the context to the config builder
		const instance = new ActorInstance<S, CP, CS>();

		// Get conifg
		let configInput: ActorConfigInput<S, CP, CS, R>;
		if (typeof this.#configOrBuilder === "function") {
			configInput = this.#configOrBuilder(instance.actorContext);
		} else {
			configInput = this.#configOrBuilder;
		}

		// Validate config
		const config = ActorConfigSchema.parse(configInput) as ActorConfig<
			S,
			CP,
			CS
		>;

		// Set config lazily
		instance.setConfig(config);

		return instance;
	}
}
