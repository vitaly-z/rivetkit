import type { Encoding } from "@rivetkit/core";
import type { UniversalWebSocket } from "@rivetkit/core/common/websocket";
import {
	type ActorOutput,
	type CreateInput,
	type GetForIdInput,
	type GetOrCreateWithKeyInput,
	type GetWithKeyInput,
	HEADER_AUTH_DATA,
	HEADER_CONN_PARAMS,
	HEADER_ENCODING,
	HEADER_EXPOSE_INTERNAL_ERROR,
	type ManagerDriver,
} from "@rivetkit/core/driver-helpers";
import { ActorAlreadyExists, InternalError } from "@rivetkit/core/errors";
import { getCloudflareAmbientEnv } from "./handler";
import { logger } from "./log";
import type { Bindings } from "./mod";
import { serializeKey, serializeNameAndKey } from "./util";

// Actor metadata structure
interface ActorData {
	name: string;
	key: string[];
}

// Key constants similar to Redis implementation
const KEYS = {
	ACTOR: {
		// Combined key for actor metadata (name and key)
		metadata: (actorId: string) => `actor:${actorId}:metadata`,

		// Key index function for actor lookup
		keyIndex: (name: string, key: string[] = []) => {
			// Use serializeKey for consistent handling of all keys
			return `actor_key:${serializeKey(key)}`;
		},
	},
};

const STANDARD_WEBSOCKET_HEADERS = [
	"connection",
	"upgrade",
	"sec-websocket-key",
	"sec-websocket-version",
	"sec-websocket-protocol",
	"sec-websocket-extensions",
];

export class CloudflareActorsManagerDriver implements ManagerDriver {
	constructor() {}

	async sendRequest(actorId: string, request: Request): Promise<Response> {
		const env = getCloudflareAmbientEnv();

		logger().debug("sending request to durable object", {
			actorId,
			method: request.method,
			url: request.url,
		});

		const id = env.ACTOR_DO.idFromString(actorId);
		const stub = env.ACTOR_DO.get(id);

		return await stub.fetch(request);
	}

	async openWebSocket(
		actorId: string,
		request: Request,
	): Promise<UniversalWebSocket> {
		const env = getCloudflareAmbientEnv();

		logger().debug("opening websocket to durable object", { actorId });

		// Make a fetch request to the Durable Object with WebSocket upgrade
		const id = env.ACTOR_DO.idFromString(actorId);
		const stub = env.ACTOR_DO.get(id);

		// Extract encoding from request headers
		const encoding = request.headers.get(HEADER_ENCODING) || "json";
		const params = request.headers.get(HEADER_CONN_PARAMS);

		const headers: Record<string, string> = {
			Upgrade: "websocket",
			Connection: "Upgrade",
			[HEADER_EXPOSE_INTERNAL_ERROR]: "true",
			[HEADER_ENCODING]: encoding,
		};
		if (params) {
			headers[HEADER_CONN_PARAMS] = params;
		}
		// HACK: See packages/platforms/cloudflare-workers/src/websocket.ts
		headers["sec-websocket-protocol"] = "rivetkit";

		const response = await stub.fetch(request.url, {
			headers,
		});
		const webSocket = response.webSocket;

		if (!webSocket) {
			throw new InternalError(
				"missing websocket connection in response from DO",
			);
		}

		logger().debug("durable object websocket connection open", {
			actorId,
		});

		webSocket.accept();

		// TODO: Is this still needed?
		// HACK: Cloudflare does not call onopen automatically, so we need
		// to call this on the next tick
		setTimeout(() => {
			(webSocket as any).onopen?.(new Event("open"));
		}, 0);

		return webSocket as unknown as UniversalWebSocket;
	}

	async proxyRequest(actorId: string, request: Request): Promise<Response> {
		const env = getCloudflareAmbientEnv();

		logger().debug("forwarding request to durable object", {
			actorId,
			method: request.method,
			url: request.url,
		});

		const id = env.ACTOR_DO.idFromString(actorId);
		const stub = env.ACTOR_DO.get(id);

		return await stub.fetch(request);
	}

	async proxyWebSocket(
		actorId: string,
		request: Request,
		clientSocket: UniversalWebSocket,
	): Promise<void> {
		const env = getCloudflareAmbientEnv();

		logger().debug("forwarding websocket to durable object", {
			actorId,
			url: request.url,
		});

		// Make a fetch request to the Durable Object with WebSocket upgrade
		const id = env.ACTOR_DO.idFromString(actorId);
		const stub = env.ACTOR_DO.get(id);

		// Always build fresh request to prevent forwarding unwanted headers
		// Copy only standard WebSocket headers
		const headers: Record<string, string> = {
			Upgrade: "websocket",
			Connection: "Upgrade",
		};

		// Copy standard WebSocket headers from request
		for (const header of STANDARD_WEBSOCKET_HEADERS) {
			const value = request.headers.get(header);
			if (value) {
				headers[header] = value;
			}
		}

		// Add RivetKit headers
		headers[HEADER_EXPOSE_INTERNAL_ERROR] = "true";
		const encoding = request.headers.get(HEADER_ENCODING);
		if (encoding) {
			headers[HEADER_ENCODING] = encoding;
		}
		const params = request.headers.get(HEADER_CONN_PARAMS);
		if (params) {
			headers[HEADER_CONN_PARAMS] = params;
		}
		const authData = request.headers.get(HEADER_AUTH_DATA);
		if (authData) {
			headers[HEADER_AUTH_DATA] = authData;
		}

		const response = await stub.fetch(request.url, {
			method: request.method,
			headers,
		});

		const actorWebSocket = response.webSocket;
		if (!actorWebSocket) {
			throw new InternalError("missing websocket in response from DO");
		}

		actorWebSocket.accept();

		// Bridge the two WebSockets
		// Forward messages from client to actor
		clientSocket.addEventListener("message", (event: any) => {
			if (actorWebSocket.readyState === WebSocket.OPEN) {
				actorWebSocket.send(event.data);
			}
		});

		// Forward messages from actor to client
		actorWebSocket.addEventListener("message", (event: any) => {
			if (clientSocket.readyState === 1) {
				// OPEN
				clientSocket.send(event.data);
			}
		});

		// Handle client close
		clientSocket.addEventListener("close", (event: any) => {
			if (actorWebSocket.readyState === WebSocket.OPEN) {
				actorWebSocket.close(event.code, event.reason);
			}
		});

		// Handle actor close
		actorWebSocket.addEventListener("close", (event: any) => {
			if (clientSocket.readyState === 1) {
				// OPEN
				clientSocket.close(event.code || 1000, event.reason || "");
			}
		});

		// Handle errors
		clientSocket.addEventListener("error", () => {
			if (actorWebSocket.readyState === WebSocket.OPEN) {
				actorWebSocket.close(1011, "Client error");
			}
		});

		actorWebSocket.addEventListener("error", () => {
			if (clientSocket.readyState === 1) {
				// OPEN
				clientSocket.close(1011, "Actor error");
			}
		});
	}

	async getForId({
		c,
		actorId,
	}: GetForIdInput<{ Bindings: Bindings }>): Promise<ActorOutput | undefined> {
		const env = getCloudflareAmbientEnv();

		// Get actor metadata from KV (combined name and key)
		const actorData = (await env.ACTOR_KV.get(KEYS.ACTOR.metadata(actorId), {
			type: "json",
		})) as ActorData | null;

		// If the actor doesn't exist, return undefined
		if (!actorData) {
			return undefined;
		}

		return {
			actorId,
			name: actorData.name,
			key: actorData.key,
		};
	}

	async getWithKey({
		c,
		name,
		key,
	}: GetWithKeyInput<{ Bindings: Bindings }>): Promise<
		ActorOutput | undefined
	> {
		const env = getCloudflareAmbientEnv();

		logger().debug("getWithKey: searching for actor", { name, key });

		// Generate deterministic ID from the name and key
		// This is aligned with how createActor generates IDs
		const nameKeyString = serializeNameAndKey(name, key);
		const actorId = env.ACTOR_DO.idFromName(nameKeyString).toString();

		// Check if the actor metadata exists
		const actorData = await env.ACTOR_KV.get(KEYS.ACTOR.metadata(actorId), {
			type: "json",
		});

		if (!actorData) {
			logger().debug("getWithKey: no actor found with matching name and key", {
				name,
				key,
				actorId,
			});
			return undefined;
		}

		logger().debug("getWithKey: found actor with matching name and key", {
			actorId,
			name,
			key,
		});
		return this.#buildActorOutput(c, actorId);
	}

	async getOrCreateWithKey(
		input: GetOrCreateWithKeyInput,
	): Promise<ActorOutput> {
		// TODO: Prevent race condition here
		const getOutput = await this.getWithKey(input);
		if (getOutput) {
			return getOutput;
		} else {
			return await this.createActor(input);
		}
	}

	async createActor({
		c,
		name,
		key,
		input,
	}: CreateInput<{ Bindings: Bindings }>): Promise<ActorOutput> {
		const env = getCloudflareAmbientEnv();

		// Check if actor with the same name and key already exists
		const existingActor = await this.getWithKey({ c, name, key });
		if (existingActor) {
			throw new ActorAlreadyExists(name, key);
		}

		// Create a deterministic ID from the actor name and key
		// This ensures that actors with the same name and key will have the same ID
		const nameKeyString = serializeNameAndKey(name, key);
		const doId = env.ACTOR_DO.idFromName(nameKeyString);
		const actorId = doId.toString();

		// Init actor
		const actor = env.ACTOR_DO.get(doId);
		await actor.initialize({
			name,
			key,
			input,
		});

		// Store combined actor metadata (name and key)
		const actorData: ActorData = { name, key };
		await env.ACTOR_KV.put(
			KEYS.ACTOR.metadata(actorId),
			JSON.stringify(actorData),
		);

		// Add to key index for lookups by name and key
		await env.ACTOR_KV.put(KEYS.ACTOR.keyIndex(name, key), actorId);

		return {
			actorId,
			name,
			key,
		};
	}

	// Helper method to build actor output from an ID
	async #buildActorOutput(
		c: any,
		actorId: string,
	): Promise<ActorOutput | undefined> {
		const env = getCloudflareAmbientEnv();

		const actorData = (await env.ACTOR_KV.get(KEYS.ACTOR.metadata(actorId), {
			type: "json",
		})) as ActorData | null;

		if (!actorData) {
			return undefined;
		}

		return {
			actorId,
			name: actorData.name,
			key: actorData.key,
		};
	}
}
