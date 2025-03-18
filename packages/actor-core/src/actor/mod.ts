import { ActorConfigInput, ActorConfigSchema, type Actions, type ActorConfig } from "./config";
import { ActorDefinition } from "./definition";

export type { ActorContext } from "./context";
export { UserError, type UserErrorOptions } from "./errors";
export type { Conn } from "./connection";
export type { ActionContext } from "./action";
export type { ActorConfig, OnConnectOptions } from "./config";
export type { Encoding } from "@/actor/protocol/serde";
export type { ActorTags } from "@/common/utils";
export type { ActorDefinition, ActorContextOf } from "./definition";

export function actor<S, CP, CS, R extends Actions<S, CP, CS>>(
	input: ActorConfigInput<S, CP, CS, R>,
): ActorDefinition<S, CP, CS, R> {
	const config = ActorConfigSchema.parse(input) as ActorConfig<S, CP, CS>;
	return new ActorDefinition(config);
}
