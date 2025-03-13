import { setupLogging } from "actor-core/log";
import type { ActorContext } from "@rivet-gg/actor-core";
import type { ActorTags } from "actor-core";
import { upgradeWebSocket } from "hono/deno";
import { logger } from "./log";
import type { RivetHandler } from "./util";
import { PartitionTopologyActor } from "actor-core/topologies/partition";
import { ConfigSchema, type InputConfig } from "./config";
import { RivetActorDriver } from "./actor_driver";
import { rivetRequest } from "./rivet_client";

export function createActorHandler(inputConfig: InputConfig): RivetHandler {
	const config = ConfigSchema.parse(inputConfig);

	const handler = {
		async start(ctx: ActorContext): Promise<void> {
			setupLogging();

			const portStr = Deno.env.get("PORT_HTTP");
			if (!portStr) {
				throw "Missing port";
			}
			const port = Number.parseInt(portStr);
			if (!Number.isFinite(port)) {
				throw "Invalid port";
			}

			// Setup actor driver
			if (!config.drivers) config.drivers = {};
			if (!config.drivers.actor) {
				config.drivers.actor = new RivetActorDriver(ctx);
			}

			// Setup inspector
			config.inspector = {
				enabled: true,
				async validateRequest(c) {
					const token = c.req.query("token");

					if (!token) {
						return false;
					}

					try {
						await rivetRequest(
							{
								endpoint: "http://rivet-server:8080",
								token,
								project: ctx.metadata.project.slug,
								environment: ctx.metadata.environment.slug,
							},
							"GET",
							"/cloud/auth/inspect",
						);
						return true;
					} catch (e) {
						console.log("error", e);
						return false;
					}
				},
			};

			// Setup WebSocket upgrader
			if (!config.getUpgradeWebSocket) {
				config.getUpgradeWebSocket = () => upgradeWebSocket;
			}

			// Create actor topology
			config.topology = config.topology ?? "partition";
			const actorTopology = new PartitionTopologyActor(config);

			// Set a catch-all route
			const router = actorTopology.router;

			// Start server
			logger().info("server running", { port });
			const server = Deno.serve(
				{
					port,
					hostname: "0.0.0.0",
					// Remove "Listening on ..." message
					onListen() {},
				},
				router.fetch,
			);

			// Start actor
			await actorTopology.start(
				ctx.metadata.actor.id,
				ctx.metadata.actor.tags as ActorTags,
				ctx.metadata.region.id,
			);

			// Wait for server
			await server.finished;
		},
	} satisfies RivetHandler;

	return handler;
}
