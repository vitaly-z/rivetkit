import { DurableObject } from "cloudflare:workers";
import type { Actor as CoreActor } from "@actor-core/actor-runtime";
import type { ActorTags } from "@actor-core/common/utils";
import type { ActorDriver } from "@actor-core/actor-runtime/driver";
import Counter from "./counter";
import { logger } from "./log";

const ACTOR_REGISTRY: Record<string, any> = {
	counter: Counter,
};

const KEYS = {
	//SCHEDULE: {
	//	SCHEDULE: ["actor", "schedule", "schedule"],
	//	EVENT_PREFIX: ["actor", "schedule", "event"],
	//	event(id: string): string[] {
	//		return [...this.EVENT_PREFIX, id];
	//	},
	//},
	STATE: {
		INITIALIZED: "actor:state:initialized",
		TAGS: "actor:state:tags",
		DATA: "actor:state:data",
	},
};

export interface ActorInitRequest {
	tags: ActorTags;
}

interface InitializedData {
	tags: ActorTags;
}

/**
 * Startup steps:
 * 1. If not already created call `initialize`, otherwise check KV to ensure it's initialized
 * 2. Load actor
 * 3. Start service requests
 */
export class Actor extends DurableObject {
	#initialized?: InitializedData;
	#initializedPromise?: PromiseWithResolvers<void>;

	#actor?: CoreActor;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async #loadActor(): Promise<CoreActor> {
		// Wait for initi
		if (!this.#initialized) {
			// Wait for init
			if (this.#initializedPromise) {
				await this.#initializedPromise.promise;
			} else {
				this.#initializedPromise = Promise.withResolvers();
				const res = await this.ctx.storage.get([
					KEYS.STATE.INITIALIZED,
					KEYS.STATE.TAGS,
				]);
				if (res.get(KEYS.STATE.INITIALIZED)) {
					const tags = res.get(KEYS.STATE.TAGS) as ActorTags;
					if (!tags) throw new Error("missing actor tags");

					logger().debug("already initialized", { tags });

					this.#initialized = { tags };
					this.#initializedPromise.resolve();
				} else {
					logger().debug("waiting to initialize");
				}
			}
		}

		// Check if already loaded
		if (this.#actor) {
			return this.#actor;
		}

		// Find actor prototype
		if (!this.#initialized) throw new Error("no initialized data");
		const actorName = this.#initialized.tags.name;
		const prototype = ACTOR_REGISTRY[actorName];
		// TODO: Handle error here gracefully by calling destroy
		if (!prototype) throw new Error(`no actor for name ${prototype}`);

		// Create & start actor
		const driver = buildActorDriver(this.ctx);
		this.#actor = new (prototype as any)() as CoreActor;
		await this.#actor.__start(driver);
		return this.#actor;
	}

	async initialize(req: ActorInitRequest) {
		// TODO: Need to add this to a core promise that needs to be resolved before start

		await this.ctx.storage.put({
			[KEYS.STATE.INITIALIZED]: true,
			[KEYS.STATE.TAGS]: req.tags,
		});
		this.#initialized = { tags: req.tags };

		logger().debug("initialized actor", { tags: req.tags });

		// Preemptively actor so the lifecycle hooks are called
		await this.#loadActor();
	}

	async fetch(request: Request): Promise<Response> {
		const actor = await this.#loadActor();
		return await actor.__router.fetch(request);

		// TODO: Serve actor

		//// TODO: Expose Actor hono router
		//
		//// Creates two ends of a WebSocket connection.
		//const webSocketPair = new WebSocketPair();
		//const [client, server] = Object.values(webSocketPair);
		//
		//server.accept();
		//
		////// Upon receiving a message from the client, the server replies with the same message,
		////// and the total number of connections with the "[Durable Object]: " prefix
		////server.addEventListener("message", (event: MessageEvent) => {
		////	server.send(
		////		`[Durable Object] currentlyConnectedWebSockets: ${this.currentlyConnectedWebSockets}`,
		////	);
		////});
		//
		//// If the client closes the connection, the runtime will close the connection too.
		//server.addEventListener("close", (cls: CloseEvent) => {
		//	//this.currentlyConnectedWebSockets -= 1;
		//	server.close(cls.code, "Durable Object is closing WebSocket");
		//});
		//
		//return new Response(null, {
		//	status: 101,
		//	webSocket: client,
		//});
	}
}

function serializeKey(key: any): string {
	return JSON.stringify(key);
}

//function deserializeKey(key: any): string {
//	return JSON.parse(key);
//}

function buildActorDriver(ctx: DurableObjectState): ActorDriver {
	// TODO: Use a better key serialization format
	return {
		async kvPut(key: any, value: any): Promise<void> {
			await ctx.storage.put(serializeKey(key), value);
		},
		async kvGetBatch(keys: any[]): Promise<[any, any][]> {
			const resultMap = await ctx.storage.get(keys.map(serializeKey));
			const resultList = keys.map((key) => {
				return [key, resultMap.get(serializeKey(key))] as [any, any];
			});
			return resultList;
		},
		async kvPutBatch(keys: [any, any][]): Promise<void> {
			await ctx.storage.put(
				Object.fromEntries(keys.map(([k, v]) => [serializeKey(k), v])),
			);
		},
	};
}
