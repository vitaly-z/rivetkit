import { Hono, type Context as HonoContext } from "hono";
import { upgradeWebSocket } from "hono/cloudflare-workers";
import invariant from "invariant";
import type { UniversalWebSocket } from "@/common/websocket-interface";
import type { RegistryConfig } from "@/registry/config";
import type { RunConfig } from "@/registry/run-config";
import type { AnyConn } from "./connection";
import type { ActorContext } from "./context";
import type { ActorDriver, ConnDrivers } from "./driver";
import * as errors from "./errors";
import type { AnyActorInstance } from "./instance";
import { logger } from "./log";
import {
	type ActionOpts,
	type ActionOutput,
	type ConnectSseOpts,
	type ConnectSseOutput,
	type ConnectWebSocketOpts,
	type ConnectWebSocketOutput,
	type ConnsMessageOpts,
	type FetchOpts,
	getRequestConnParams,
	getRequestEncoding,
	HEADER_ACTOR_ID,
	HEADER_AUTH_DATA,
	HEADER_CONN_ID,
	HEADER_CONN_PARAMS,
	HEADER_CONN_TOKEN,
	HEADER_ENCODING,
	handleAction,
	handleConnectionMessage,
	handleSseConnect,
	handleWebSocketConnect,
	type WebSocketOpts,
} from "./router-endpoints";

/**
 * Creates a router that handles requests for a specific actor instance.
 * This router is used by drivers to process incoming requests.
 */
export function createActorRouter(
	registryConfig: RegistryConfig,
	runConfig: RunConfig,
	actorDriver: ActorDriver,
	getActorInstance: (actorId: string) => Promise<AnyActorInstance | undefined>,
): Hono {
	const router = new Hono();

	// SSE connection handler
	const onConnectSse = async (
		opts: ConnectSseOpts,
	): Promise<ConnectSseOutput> => {
		const actor = await getActorInstance(opts.actorId);
		if (!actor) {
			throw new errors.ActorNotFound(opts.actorId);
		}

		// Prepare connection state
		const { connectionState, authData } = await actor.prepareConn(
			opts.params,
			opts.req?.raw,
		);

		// Generate connection ID and token
		const connId = crypto.randomUUID();
		const connToken = crypto.randomUUID();

		// SSE driver info
		const driverId = "sse";
		const driverState = {};

		return {
			onOpen: async (stream) => {
				// Create the connection
				const conn = await actor.createConn(
					connId,
					connToken,
					opts.params,
					connectionState,
					driverId,
					driverState,
					authData || opts.authData,
				);

				// Store the stream in driver state
				conn.__persist.ds = { stream, conn };
			},
			onClose: async () => {
				// Connection cleanup is handled automatically by the actor
			},
		};
	};

	// WebSocket connection handler
	const onConnectWebSocket = async (
		opts: ConnectWebSocketOpts,
	): Promise<ConnectWebSocketOutput> => {
		const actor = await getActorInstance(opts.actorId);
		if (!actor) {
			throw new errors.ActorNotFound(opts.actorId);
		}

		// Prepare connection state
		const { connectionState, authData } = await actor.prepareConn(
			opts.params,
			opts.req?.raw,
		);

		// Generate connection ID and token
		const connId = crypto.randomUUID();
		const connToken = crypto.randomUUID();

		// WebSocket driver info
		const driverId = "websocket";
		const driverState = {};

		return {
			onOpen: async (ws) => {
				// Create the connection
				const conn = await actor.createConn(
					connId,
					connToken,
					opts.params,
					connectionState,
					driverId,
					driverState,
					authData || opts.authData,
				);

				// Store the connection in driver state for message handling
				conn.__persist.ds = { ws, conn };
			},
			onMessage: async (message) => {
				// Find the connection by ID and process message
				const conn = actor.__getConnForId(connId);
				if (conn) {
					await actor.processMessage(message, conn);
				}
			},
			onClose: async () => {
				// Connection cleanup is handled automatically by the actor
			},
		};
	};

	// Action handler
	const onAction = async (opts: ActionOpts): Promise<ActionOutput> => {
		const actor = await getActorInstance(opts.actorId);
		if (!actor) {
			throw new errors.ActorNotFound(opts.actorId);
		}
		// For direct HTTP action calls, we need to handle the action without a connection.
		// We'll use the actor's processMessage method by creating a synthetic action request message.

		// Generate a unique request ID
		const requestId = crypto.randomUUID();

		// Create a synthetic action request message
		const actionMessage: any = {
			b: {
				ar: {
					i: requestId,
					n: opts.actionName,
					a: opts.actionArgs,
				},
			},
		};

		// Create a temporary connection-like object that can capture the response
		let responseOutput: unknown;
		let responseError: Error | undefined;
		const responsePromise = new Promise((resolve, reject) => {
			// Override the message handler to capture the response
			const tempConn = {
				_sendMessage: (message: any) => {
					if (message.value?.b?.ar?.i === requestId) {
						responseOutput = message.value.b.ar.o;
						resolve(responseOutput);
					} else if (message.value?.b?.e) {
						responseError = new Error(message.value.b.e.m);
						reject(responseError);
					}
				},
				__persist: {
					p: opts.params,
					a: opts.authData,
				},
				params: opts.params,
				authData: opts.authData,
			} as any;

			// Process the message
			actor.processMessage(actionMessage, tempConn).catch(reject);
		});

		// Wait for the response
		const output = await responsePromise;
		return { output };
	};

	// Connection message handler
	const onConnMessage = async (opts: ConnsMessageOpts): Promise<void> => {
		const actor = await getActorInstance(opts.actorId);
		if (!actor) {
			throw new errors.ActorNotFound(opts.actorId);
		}
		// Get the connection
		const conn = actor.__getConnForId(opts.connId);
		if (!conn) {
			throw new errors.ConnNotFound(opts.connId);
		}

		// Validate token
		if (conn._token !== opts.connToken) {
			throw new errors.IncorrectConnToken();
		}

		// Process the message through the actor
		await actor.processMessage(opts.message, conn);
	};

	// Raw HTTP handler
	const onFetch = async (opts: FetchOpts): Promise<Response> => {
		const actor = await getActorInstance(opts.actorId);
		if (!actor) {
			throw new errors.ActorNotFound(opts.actorId);
		}
		// Handle raw HTTP request
		const response = await actor.handleFetch(opts.request);
		if (!response) {
			// If the actor doesn't return a response, return a 404
			return new Response("Not found", { status: 404 });
		}
		return response;
	};

	// Raw WebSocket handler
	const onWebSocket = async (opts: WebSocketOpts): Promise<void> => {
		const actor = await getActorInstance(opts.actorId);
		if (!actor) {
			throw new errors.ActorNotFound(opts.actorId);
		}
		// Handle raw WebSocket
		await actor.handleWebSocket(opts.websocket, opts.request);
	};

	// SSE connection endpoint
	router.get("/connect/sse", async (c: HonoContext) => {
		logger().debug("actor router: sse connection request");

		const actorId = c.req.header(HEADER_ACTOR_ID);
		if (!actorId) {
			throw new errors.InvalidRequest("Missing actor ID");
		}

		const authData = c.req.header(HEADER_AUTH_DATA);
		const parsedAuthData = authData ? JSON.parse(authData) : undefined;

		return handleSseConnect(
			c,
			registryConfig,
			runConfig,
			onConnectSse,
			actorId,
			parsedAuthData,
		);
	});

	// WebSocket connection endpoint
	router.get(
		"/connect/websocket",
		upgradeWebSocket((c: HonoContext) => {
			logger().debug("actor router: websocket connection request");

			const actorId = c.req.header(HEADER_ACTOR_ID);
			if (!actorId) {
				throw new errors.InvalidRequest("Missing actor ID");
			}

			const encoding = getRequestEncoding(c.req);
			const params = getRequestConnParams(c.req, registryConfig, runConfig);
			const authData = c.req.header(HEADER_AUTH_DATA);
			const parsedAuthData = authData ? JSON.parse(authData) : undefined;

			return handleWebSocketConnect(
				c,
				registryConfig,
				runConfig,
				onConnectWebSocket,
				actorId,
				encoding,
				params,
				parsedAuthData,
			);
		}),
	);

	// Action endpoint
	router.post("/action/:action", async (c: HonoContext) => {
		const actionName = c.req.param("action");
		logger().debug("actor router: action request", { actionName });

		const actorId = c.req.header(HEADER_ACTOR_ID);
		if (!actorId) {
			throw new errors.InvalidRequest("Missing actor ID");
		}

		const authData = c.req.header(HEADER_AUTH_DATA);
		const parsedAuthData = authData ? JSON.parse(authData) : undefined;

		return handleAction(
			c,
			registryConfig,
			runConfig,
			onAction,
			actionName || "",
			actorId,
			parsedAuthData,
		);
	});

	// Connection message endpoint
	router.post("/connections/message", async (c: HonoContext) => {
		logger().debug("actor router: connection message");

		const actorId = c.req.header(HEADER_ACTOR_ID);
		if (!actorId) {
			throw new errors.InvalidRequest("Missing actor ID");
		}

		const connId = c.req.header(HEADER_CONN_ID);
		const connToken = c.req.header(HEADER_CONN_TOKEN);
		if (!connId || !connToken) {
			throw new errors.InvalidRequest("Missing connection ID or token");
		}

		return handleConnectionMessage(
			c,
			registryConfig,
			runConfig,
			onConnMessage,
			connId,
			connToken,
			actorId,
		);
	});

	// Raw HTTP handler
	router.all("/http/*", async (c: HonoContext) => {
		logger().debug("actor router: raw http request");

		const actorId = c.req.header(HEADER_ACTOR_ID);
		if (!actorId) {
			throw new errors.InvalidRequest("Missing actor ID");
		}

		const authData = c.req.header(HEADER_AUTH_DATA);
		const parsedAuthData = authData ? JSON.parse(authData) : undefined;

		return onFetch({
			request: c.req.raw,
			actorId,
			authData: parsedAuthData,
		});
	});

	// Raw WebSocket handler
	router.get(
		"/websocket/*",
		upgradeWebSocket((c: HonoContext) => {
			logger().debug("actor router: raw websocket request");

			const actorId = c.req.header(HEADER_ACTOR_ID);
			if (!actorId) {
				throw new errors.InvalidRequest("Missing actor ID");
			}

			const authData = c.req.header(HEADER_AUTH_DATA);
			const parsedAuthData = authData ? JSON.parse(authData) : undefined;

			// Return WebSocket handlers
			return {
				onOpen: async (_evt: any, ws: any) => {
					logger().debug("raw websocket open");
					await onWebSocket({
						request: c.req.raw,
						websocket: ws as UniversalWebSocket,
						actorId,
						authData: parsedAuthData,
					});
				},
				onMessage: async (_evt: any) => {
					// Raw WebSocket handler manages its own messages
				},
				onClose: async () => {
					logger().debug("raw websocket closed");
				},
				onError: async (error: unknown) => {
					logger().error("raw websocket error", { error });
				},
			};
		}),
	);

	// Fallback for unmatched routes
	router.all("*", (c) => {
		logger().warn("actor router: unmatched route", { path: c.req.path });
		return c.text("Not found", 404);
	});

	return router;
}
