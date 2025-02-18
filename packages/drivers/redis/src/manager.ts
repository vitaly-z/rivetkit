import type {
	CreateActorInput,
	GetActorOutput,
	GetForIdInput,
	GetWithTagsInput,
	ManagerDriver,
} from "actor-core/driver-helpers";
import type Redis from "ioredis";
import { KEYS } from "./keys";
import { randomUUID } from "crypto";

export class RedisManagerDriver implements ManagerDriver {
	#redis: Redis;

	constructor(redis: Redis) {
		this.#redis = redis;
	}

	async getForId({ origin, actorId }: GetForIdInput): Promise<GetActorOutput> {
		// TODO: Error handling

		//// Validate actor
		//if ((res.actor.tags as ActorTags).access !== "public") {
		//	// TODO: Throw 404 that matches the 404 from Fern if the actor is not found
		//	throw new Error(`Actor with ID ${query.getForId.actorId} is private`);
		//}
		//if (res.actor.destroyedAt) {
		//	throw new Error(
		//		`Actor with ID ${query.getForId.actorId} already destroyed`,
		//	);
		//}
		//
		//return res.actor;

		return {
			endpoint: buildActorEndpoint(origin, actorId),
		};
	}

	async getWithTags({
		origin,
		tags,
	}: GetWithTagsInput): Promise<GetActorOutput | undefined> {
		// TODO: use an inverse tree for correct tag looups

		const actorId = await this.#redis.get(
			`actor_tags:${JSON.stringify(tags)}:id`,
		);
		if (actorId) {
			return {
				endpoint: buildActorEndpoint(origin, actorId),
			};
		}
		return undefined;

		//// TODO(RVT-4248): Don't return actors that aren't networkable yet
		//actors = actors.filter((a) => {
		//	// This should never be triggered. This assertion will leak if private actors exist if it's ever triggered.
		//	if ((a.tags as ActorTags).access !== "public") {
		//		throw new Error("unreachable: actor tags not public");
		//	}
		//
		//	for (const portName in a.network.ports) {
		//		const port = a.network.ports[portName];
		//		if (!port.hostname || !port.port) return false;
		//	}
		//	return true;
		//});
		//
		//if (actors.length === 0) {
		//	return undefined;
		//}
		//
		//// Make the chosen actor consistent
		//if (actors.length > 1) {
		//	actors.sort((a, b) => a.id.localeCompare(b.id));
		//}
		//
		//return actors[0];
	}

	async createActor({
		origin,
		region: _,
		tags,
	}: CreateActorInput): Promise<GetActorOutput> {
		const actorId = randomUUID();

		await this.#redis.mset({
			[KEYS.ACTOR.initialized(actorId)]: "1",
			[KEYS.ACTOR.tags(actorId)]: JSON.stringify(tags),
			[`actor_tags:${JSON.stringify(tags)}:id`]: actorId,
		});

		return {
			endpoint: buildActorEndpoint(origin, actorId.toString()),
		};
	}
}

function buildActorEndpoint(origin: string, actorId: string) {
	return `${origin}/actors/${actorId}`;
}
