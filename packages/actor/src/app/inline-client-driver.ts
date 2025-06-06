import * as errors from "@/actor/errors";
import { logger } from "./log";
import type { EventSource } from "eventsource";
import type * as wsToServer from "@/actor/protocol/message/to-server";
import { type Encoding, serialize } from "@/actor/protocol/serde";
import { type ConnectionHandlers } from "@/actor/router-endpoints";
import { HonoRequest, type Context as HonoContext, type Next } from "hono";
import invariant from "invariant";
import { ClientDriver } from "@/client/client";
import { ManagerDriver } from "@/manager/driver";
import { ActorQuery } from "@/manager/protocol/query";

/**
 * Client driver that calls the manager driver inline.
 *
 * This driver can access private resources.
 *
 * This driver serves a double purpose as:
 * - Providing the client for the internal requests
 * - Provide the driver for the manager HTTP router (see manager/router.ts)
 */
export function createInlineClientDriver(
	managerDriver: ManagerDriver,
	connHandlers: ConnectionHandlers,
): ClientDriver {
	//// Lazily import the dynamic imports so we don't have to turn `createClient` in to an aysnc fn
	//const dynamicImports = (async () => {
	//	// Import dynamic dependencies
	//	const [WebSocket, EventSource] = await Promise.all([
	//		importWebSocket(),
	//		importEventSource(),
	//	]);
	//	return {
	//		WebSocket,
	//		EventSource,
	//	};
	//})();

	const driver: ClientDriver = {
		action: async <Args extends Array<unknown> = unknown[], Response = unknown>(
			req: HonoRequest | undefined,
			actorQuery: ActorQuery,
			encoding: Encoding,
			params: unknown,
			actionName: string,
			...args: Args
		): Promise<Response> => {
			// Get the actor ID and meta
			const { actorId, meta } = await queryActor(
				req,
				actorQuery,
				managerDriver,
			);
			logger().debug("found actor for action", { actorId, meta });
			invariant(actorId, "Missing actor ID");

			logger().debug("handling action", { actionName, encoding });

			// Invoke the action
			const { output } = await connHandlers.onAction({
				req,
				params,
				actionName,
				actionArgs: args,
				actorId,
			});

			return output as Response;
		},

		resolveActorId: async (
			req: HonoRequest | undefined,
			actorQuery: ActorQuery,
			_encodingKind: Encoding,
		): Promise<string> => {
			// Get the actor ID and meta
			const { actorId } = await queryActor(req, actorQuery, managerDriver);
			logger().debug("resolved actor", { actorId });
			invariant(actorId, "Missing actor ID");

			return actorId;
		},

		connectWebSocket: async (
			req: HonoRequest | undefined,
			actorQuery: ActorQuery,
			encodingKind: Encoding,
		): Promise<WebSocket> => {
			throw "UNIMPLEMENTED";
		},

		connectSse: async (
			req: HonoRequest | undefined,
			actorQuery: ActorQuery,
			encodingKind: Encoding,
			params: unknown,
		): Promise<EventSource> => {
			throw "UNIMPLEMENTED";
		},

		sendHttpMessage: async (
			req: HonoRequest | undefined,
			actorId: string,
			encoding: Encoding,
			connectionId: string,
			connectionToken: string,
			message: wsToServer.ToServer,
		): Promise<Response> => {
			throw "UNIMPLEMENTED";
		},
	};

	return driver;
}

/**
 * Query the manager driver to get or create an actor based on the provided query
 */
export async function queryActor(
	req: HonoRequest | undefined,
	query: ActorQuery,
	driver: ManagerDriver,
): Promise<{ actorId: string; meta?: unknown }> {
	logger().debug("querying actor", { query });
	let actorOutput: { actorId: string; meta?: unknown };
	if ("getForId" in query) {
		const output = await driver.getForId({
			req,
			actorId: query.getForId.actorId,
		});
		if (!output) throw new errors.ActorNotFound(query.getForId.actorId);
		actorOutput = output;
	} else if ("getForKey" in query) {
		const existingActor = await driver.getWithKey({
			req,
			name: query.getForKey.name,
			key: query.getForKey.key,
		});
		if (!existingActor) {
			throw new errors.ActorNotFound(
				`${query.getForKey.name}:${JSON.stringify(query.getForKey.key)}`,
			);
		}
		actorOutput = existingActor;
	} else if ("getOrCreateForKey" in query) {
		const getOrCreateOutput = await driver.getOrCreateWithKey({
			req,
			name: query.getOrCreateForKey.name,
			key: query.getOrCreateForKey.key,
			input: query.getOrCreateForKey.input,
			region: query.getOrCreateForKey.region,
		});
		actorOutput = {
			actorId: getOrCreateOutput.actorId,
			meta: getOrCreateOutput.meta,
		};
	} else if ("create" in query) {
		const createOutput = await driver.createActor({
			req,
			name: query.create.name,
			key: query.create.key,
			input: query.create.input,
			region: query.create.region,
		});
		actorOutput = {
			actorId: createOutput.actorId,
			meta: createOutput.meta,
		};
	} else {
		throw new errors.InvalidRequest("Invalid query format");
	}

	logger().debug("actor query result", {
		actorId: actorOutput.actorId,
		meta: actorOutput.meta,
	});
	return { actorId: actorOutput.actorId, meta: actorOutput.meta };
}
