import type { ActorsRequest, ActorsResponse } from "@rivet-gg/manager-protocol";

export interface ManagerDriver {
	queryActor(request: ActorsRequest): Promise<ActorsResponse>;
}
