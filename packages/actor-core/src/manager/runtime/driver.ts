import type {
	ActorsRequest,
	ActorsResponse,
} from "@/manager/protocol/mod";

export interface ManagerDriver {
	queryActor(request: ActorsRequest): Promise<ActorsResponse>;
}
