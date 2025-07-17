import type { Hono } from "hono";
import type { AnyActorInstance } from "@/actor/instance";
import type { ActorKey } from "@/actor/mod";
import { serializeEmptyPersistData } from "@/driver-helpers/mod";

export interface ActorState {
	id: string;
	name: string;
	key: ActorKey;
	persistedData: Uint8Array;
}

export class MemoryGlobalState {
	#actors: Map<string, ActorState> = new Map();
	#actorInstances: Map<string, AnyActorInstance> = new Map();
	#actorRouters: Map<string, Hono> = new Map();

	#getActor(actorId: string): ActorState {
		const actor = this.#actors.get(actorId);
		if (!actor) {
			throw new Error(`Actor does not exist for ID: ${actorId}`);
		}
		return actor;
	}

	readPersistedData(actorId: string): Uint8Array | undefined {
		return this.#getActor(actorId).persistedData;
	}

	writePersistedData(actorId: string, data: Uint8Array) {
		this.#getActor(actorId).persistedData = data;
	}

	createActor(
		actorId: string,
		name: string,
		key: ActorKey,
		input: unknown | undefined,
	): void {
		// Create actor state if it doesn't exist
		if (!this.#actors.has(actorId)) {
			this.#actors.set(actorId, {
				id: actorId,
				name,
				key,
				persistedData: serializeEmptyPersistData(input),
			});
		} else {
			throw new Error(`Actor already exists for ID: ${actorId}`);
		}
	}

	findActor(filter: (actor: ActorState) => boolean): ActorState | undefined {
		for (const actor of this.#actors.values()) {
			if (filter(actor)) {
				return actor;
			}
		}
		return undefined;
	}

	getActor(actorId: string): ActorState | undefined {
		return this.#actors.get(actorId);
	}

	getAllActors(): ActorState[] {
		return Array.from(this.#actors.values());
	}

	deleteActor(actorId: string): void {
		this.#actors.delete(actorId);
		this.#actorInstances.delete(actorId);
		this.#actorRouters.delete(actorId);
	}

	getActorInstance(actorId: string): AnyActorInstance | undefined {
		return this.#actorInstances.get(actorId);
	}

	setActorInstance(actorId: string, instance: AnyActorInstance): void {
		this.#actorInstances.set(actorId, instance);
	}

	getActorRouter(actorId: string): Hono | undefined {
		return this.#actorRouters.get(actorId);
	}

	setActorRouter(actorId: string, router: Hono): void {
		this.#actorRouters.set(actorId, router);
	}
}
