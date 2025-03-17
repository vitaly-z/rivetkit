import type { Actions } from "./config";
import { type ActorConfigInputOrBuilder, ActorDefinition } from "./definition";

export type { ActorContext } from "./context";
export { UserError, type UserErrorOptions } from "./errors";
export type { Conn } from "./connection";
export type { ActionContext } from "./action";
export type { ActorConfig, OnConnectOptions } from "./config";
export type { Encoding } from "@/actor/protocol/serde";
export type { ActorTags } from "@/common/utils";
export type { ActorDefinition, ActorContextOf } from "./definition";

export function actor<S, CP, CS, R extends Actions<S, CP, CS>>(
	input: ActorConfigInputOrBuilder<S, CP, CS, R>,
): ActorDefinition<S, CP, CS, R> {
	return new ActorDefinition(input);
}
