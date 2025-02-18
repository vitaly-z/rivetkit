import type { GlobalState } from "@/topologies/p2p/topology";
import type { WSContext } from "hono/ws";
import { logger } from "../log";
import { serialize } from "@/actor/protocol/serde";
import type * as messageToServer from "@/actor/protocol/message/to_server";
import * as errors from "@/actor/errors";
import type { P2PDriver } from "../driver";
import { RelayConnection } from "../conn/mod";
import { publishMessageToLeader } from "../node/message";
import type { ActorDriver } from "@/actor/runtime/driver";
import type { BaseConfig } from "@/actor/runtime/config";
import type { ConnectWebSocketOpts, ConnectWebSocketOutput } from "@/actor/runtime/actor_router";

export async function serveWebSocket(
	config: BaseConfig,
	actorDriver: ActorDriver,
	p2pDriver: P2PDriver,
	globalState: GlobalState,
	actorId: string,
	{ req, encoding, parameters }: ConnectWebSocketOpts,
): Promise<ConnectWebSocketOutput> {
	let conn: RelayConnection | undefined;
	return {
		onOpen: async (ws: WSContext) => {
			conn = new RelayConnection(
				config,
				actorDriver,
				p2pDriver,
				globalState,
				{
					sendMessage: (message) => {
						ws.send(serialize(message, encoding));
					},
					disconnect: async (reason) => {
						logger().debug("closing follower stream", { reason });
						ws.close();
					},
				},
				actorId,
				parameters,
			);
			await conn.start();
		},
		onMessage: async (message: messageToServer.ToServer) => {
			if (!conn) {
				throw new errors.InternalError("Connection not created yet");
			}

			await publishMessageToLeader(
				config,
				p2pDriver,
				globalState,
				actorId,
				{
					b: {
						lm: {
							ai: actorId,
							ci: conn.connId,
							ct: conn.connToken,
							m: message,
						},
					},
				},
				req.raw.signal,
			);
		},
		onClose: async () => {
			if (!conn) {
				throw new errors.InternalError("Connection not created yet");
			}

			conn.disconnect(false);
		},
	};
}
