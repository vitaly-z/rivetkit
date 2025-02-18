import { serveSse } from "./router/sse";
import { serveWebSocket } from "./router/websocket";
import { Node } from "./node/mod";
import type { ActorPeer } from "./actor_peer";
import * as errors from "@/actor/errors";
import * as events from "node:events";
import { publishMessageToLeader } from "./node/message";
import type { RelayConnection } from "./conn/mod";
import type { Hono } from "hono";
import { createActorRouter } from "@/actor/runtime/actor_router";
import { BaseConfig } from "@/actor/runtime/config";
import { Manager } from "@/manager/runtime/manager";

export type { P2PDriver } from "./driver";

export interface GlobalState {
	nodeId: string;
	/** Actors currently running on this instance. */
	actorPeers: Map<string, ActorPeer>;
	/** Connections that are connected to this node. */
	relayConnections: Map<string, RelayConnection>;
	/** Resolvers for when a message is acknowledged by the peer. */
	messageAckResolvers: Map<string, () => void>;
}

export class P2PTopology {
	public readonly router: Hono;

	constructor(config: BaseConfig) {
		const {
			manager: managerDriver,
			actor: actorDriver,
			p2p: p2pDriver,
		} = config.drivers;
		if (!p2pDriver) throw new Error("P2P driver not defined.");

		// Allow usage of a lot of AbortSignals (which are EventEmitters)
		//events.defaultMaxListeners = 100_000;
		events.setMaxListeners(100_000);

		const globalState: GlobalState = {
			nodeId: crypto.randomUUID(),
			actorPeers: new Map(),
			relayConnections: new Map(),
			messageAckResolvers: new Map(),
		};

		const node = new Node(p2pDriver, globalState);
		node.start();

		const manager = new Manager(managerDriver);

		// Build router
		const app = manager.router;

		// Forward requests to actor
		const actorRouter = createActorRouter(config, {
			upgradeWebSocket: config.router?.getUpgradeWebSocket?.(app),
			onConnectWebSocket: async (opts) => {
				const actorId = opts.req.param("actorId");
				if (!actorId) throw new errors.InternalError("Missing actor ID");
				return await serveWebSocket(
					config,
					actorDriver,
					p2pDriver,
					globalState,
					actorId,
					opts,
				);
			},
			onConnectSse: async (opts) => {
				const actorId = opts.req.param("actorId");
				if (!actorId) throw new errors.InternalError("Missing actor ID");
				return await serveSse(
					config,
					actorDriver,
					p2pDriver,
					globalState,
					actorId,
					opts,
				);
			},
			onRpc: async () => {
				// TODO:
				throw new errors.InternalError("UNIMPLEMENTED");
			},
			onConnectionsMessage: async ({ req, connId, connToken, message }) => {
				const actorId = req.param("actorId");
				if (!actorId) throw new errors.InternalError("Missing actor ID");

				await publishMessageToLeader(
					config,
					p2pDriver,
					globalState,
					actorId,
					{
						b: {
							lm: {
								ai: actorId,
								ci: connId,
								ct: connToken,
								m: message,
							},
						},
					},
					req.raw.signal,
				);
			},
		});

		app.route("/actors/:actorId", actorRouter);

		app.all("*", (c) => {
			return c.text("Not Found (ActorCore)", 404);
		});

		this.router = app;
	}
}
