import type { ActorContext } from "@rivet-gg/actor-core";

export interface RivetHandler {
	start(ctx: ActorContext): Promise<void>;
}

