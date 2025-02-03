import type { ActorsRequest, ActorsResponse } from "@actor-core/manager-protocol";

export interface ManagerDriver {
	queryActor(request: ActorsRequest): Promise<ActorsResponse>;
}
