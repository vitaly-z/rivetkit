import * as crypto from "node:crypto";
import { Hono } from "hono";
import { ActorAlreadyExists, InternalError } from "@/actor/errors";
import { logger } from "@/actor/log";
import type { UniversalWebSocket } from "@/common/websocket-interface";
import type {
	ActorOutput,
	CreateInput,
	GetForIdInput,
	GetOrCreateWithKeyInput,
	GetWithKeyInput,
	ManagerDriver,
} from "@/driver-helpers/mod";
import type { RegistryConfig } from "@/registry/config";
import type { MemoryGlobalState } from "./global-state";

export class MemoryManagerDriver implements ManagerDriver {
	#state: MemoryGlobalState;
	#registryConfig?: RegistryConfig;

	// inspector: ManagerInspector = new ManagerInspector(this, {
	// 	getAllActors: () => this.#state.getAllActors(),
	// 	getAllTypesOfActors: () => Object.keys(this.registry.config.actors),
	// });

	constructor(state: MemoryGlobalState, registryConfig?: RegistryConfig) {
		this.#state = state;
		this.#registryConfig = registryConfig;
	}

	async getForId({ actorId }: GetForIdInput): Promise<ActorOutput | undefined> {
		// Validate the actor exists
		const actor = this.#state.getActor(actorId);
		if (!actor) {
			return undefined;
		}

		return {
			actorId: actor.id,
			name: actor.name,
			key: actor.key,
		};
	}

	async getWithKey({
		name,
		key,
	}: GetWithKeyInput): Promise<ActorOutput | undefined> {
		// NOTE: This is a slow implementation that checks each actor individually.
		// This can be optimized with an index in the future.

		// Search through all actors to find a match
		const actor = this.#state.findActor((actor) => {
			if (actor.name !== name) return false;

			// If actor doesn't have a key, it's not a match
			if (!actor.key || actor.key.length !== key.length) {
				return false;
			}

			// Check if all elements in key are in actor.key
			for (let i = 0; i < key.length; i++) {
				if (key[i] !== actor.key[i]) {
					return false;
				}
			}
			return true;
		});

		if (actor) {
			return {
				actorId: actor.id,
				name,
				key: actor.key,
			};
		}

		return undefined;
	}

	async getOrCreateWithKey(
		input: GetOrCreateWithKeyInput,
	): Promise<ActorOutput> {
		const getOutput = await this.getWithKey(input);
		if (getOutput) {
			return getOutput;
		} else {
			return await this.createActor(input);
		}
	}

	async createActor({ name, key, input }: CreateInput): Promise<ActorOutput> {
		// Check if actor with the same name and key already exists
		const existingActor = await this.getWithKey({ name, key });
		if (existingActor) {
			throw new ActorAlreadyExists(name, key);
		}

		const actorId = crypto.randomUUID();
		this.#state.createActor(actorId, name, key, input);

		// this.inspector.onActorsChange(this.#state.getAllActors());

		return { actorId, name, key };
	}

	// Routing methods - These route requests to local actor instances
	async sendRequest(actorId: string, request: Request): Promise<Response> {
		logger().debug("memory driver: sending request to actor", {
			actorId,
			url: request.url,
		});

		const router = await this.#getOrCreateActorRouter(actorId);
		if (!router) {
			return new Response("Actor not found", { status: 404 });
		}

		return await router.fetch(request);
	}

	async openWebSocket(
		actorId: string,
		request: Request,
	): Promise<UniversalWebSocket> {
		logger().debug("memory driver: opening websocket to actor", { actorId });

		// For the memory driver, we need to handle WebSocket connections through the router
		// This is a simplified implementation that assumes the platform handles WebSocket upgrades
		throw new InternalError(
			"MemoryManagerDriver.openWebSocket is not fully implemented. " +
				"WebSocket connections in memory driver require platform-specific handling.",
		);
	}

	async proxyRequest(actorId: string, request: Request): Promise<Response> {
		logger().debug("memory driver: proxying request to actor", {
			actorId,
			url: request.url,
		});

		const router = await this.#getOrCreateActorRouter(actorId);
		if (!router) {
			return new Response("Actor not found", { status: 404 });
		}

		return await router.fetch(request);
	}

	async proxyWebSocket(
		actorId: string,
		request: Request,
		socket: UniversalWebSocket,
	): Promise<void> {
		logger().debug("memory driver: proxying websocket to actor", { actorId });

		// For the memory driver, WebSocket proxying requires platform-specific handling
		throw new InternalError(
			"MemoryManagerDriver.proxyWebSocket is not fully implemented. " +
				"WebSocket proxying in memory driver requires platform-specific handling.",
		);
	}

	async #getOrCreateActorRouter(actorId: string): Promise<Hono | undefined> {
		// Check if we already have a router for this actor
		let router = this.#state.getActorRouter(actorId);
		if (router) {
			return router;
		}

		// Check if the actor exists
		const actorState = this.#state.getActor(actorId);
		if (!actorState) {
			return undefined;
		}

		// For the memory driver, we create a minimal router that returns appropriate responses
		// Full actor instantiation would require dependencies not available at driver creation time
		// (runConfig, inlineClient, etc.)

		// Create a minimal router
		router = new Hono();

		// Route all requests to indicate the actor exists but full routing is not implemented
		router.all("*", (c) => {
			const path = c.req.path;

			// Return different responses based on the path
			if (path.includes("/action/")) {
				return c.json(
					{
						error:
							"Memory driver does not support action calls. Use a distributed driver for full functionality.",
					},
					501,
				);
			} else if (path.includes("/connect/")) {
				return c.json(
					{
						error:
							"Memory driver does not support connections. Use a distributed driver for full functionality.",
					},
					501,
				);
			} else if (path.includes("/http/") || path.includes("/websocket/")) {
				return c.json(
					{
						error:
							"Memory driver does not support raw HTTP/WebSocket handlers. Use a distributed driver for full functionality.",
					},
					501,
				);
			}

			return c.json(
				{
					error: "Memory driver routing not fully implemented",
					actorId,
					actorName: actorState.name,
					message:
						"The memory driver is designed for single-process testing. For full actor functionality, use a distributed driver.",
				},
				501,
			);
		});

		// Store the router
		this.#state.setActorRouter(actorId, router);

		return router;
	}

	// Hook called when manager router is created
	modifyManagerRouter(registryConfig: RegistryConfig, router: Hono): void {
		this.#registryConfig = registryConfig;
	}
}
