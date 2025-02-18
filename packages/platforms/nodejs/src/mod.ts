import { serve as honoServe } from "@hono/node-server";
import { createNodeWebSocket, type NodeWebSocket } from "@hono/node-ws";
import { assertUnreachable } from "actor-core/utils";
import { P2PTopology } from "actor-core/topologies/p2p";
import type { Config } from "./config";

export function serve(config: Config) {
	// Setup WebSocket routing for Node
	let injectWebSocket: NodeWebSocket["injectWebSocket"] | undefined;
	if (!injectWebSocket) throw new Error("injectWebSocket not defined");
	if (!config.router) config.router = {};
	config.router.getUpgradeWebSocket = (app) => {
		const nodeWs = createNodeWebSocket({ app });
		injectWebSocket = nodeWs.injectWebSocket;
		return nodeWs.upgradeWebSocket;
	};

	if (config.topology === "single") {
		throw new Error("TODO");
	} else if (config.topology === "isolated") {
		throw new Error("Node.js only supports standalone & p2p topologies.");
	} else if (config.topology === "p2p") {
		const topology = new P2PTopology(config);

		const server = honoServe({
			fetch: topology.router.fetch,
			hostname: config.server?.hostname ?? process.env.HOSTNAME,
			port: config.server?.port ?? Number.parseInt(process.env.PORT ?? "8787"),
		});

		injectWebSocket(server);
	} else {
		assertUnreachable(config.topology);
	}
}
