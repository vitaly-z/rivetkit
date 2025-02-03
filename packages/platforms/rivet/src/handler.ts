import { logger } from "./log";
import type { Actor } from "actor-core";
import type { ActorContext } from "@rivet-gg/actor-core";
import { setupLogging } from "@actor-core/common/log";
import type { RivetHandler } from "./util";

export type AnyActorConstructor = new (
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	...args: ConstructorParameters<typeof Actor<any, any, any>>
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
) => Actor<any, any, any>;

export function createHandler(
	actorPrototype: AnyActorConstructor,
): RivetHandler {
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

			//// Create inspector after receiving `ActorContext`
			//const inspection = new ActorInspection(this.#config, this.#ctx.metadata, {
			//	state: () => ({
			//		enabled: this.#stateEnabled,
			//		state: this.#stateProxy,
			//	}),
			//	connections: () => this.#connections.values(),
			//	rpcs: () => this.#rpcNames,
			//	setState: (state) => {
			//		this.#validateStateEnabled();
			//		this.#setStateWithoutChange(state);
			//	},
			//	onRpcCall: (ctx, rpc, args) => this.#executeRpc(ctx, rpc, args),
			//});

			const actor = new actorPrototype();
			actor.__start({
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				async kvPut(key: any, value: any) {
					await ctx.kv.put(key, value);
				},
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				async kvGetBatch(key: any[]) {
					const response = await ctx.kv.getBatch(key);
					const resultList = key.map((key) => {
						return [key, response.get(key)] as [any, any];
					});
					console.log("responseList", key, resultList);
					return resultList;
				},
				// biome-ignore lint/suspicious/noExplicitAny: <explanation>
				async kvPutBatch(key: [any, any][]) {
					await ctx.kv.putBatch(new Map(key));
				},
				//async onShutdown() {
				//	if (server) await server.shutdown();
				//	Deno.exit(0);
				//}
			});

			const app = actor.__router;

			//app.get(
			//	"/__inspect/connect",
			//	upgradeWebSocket((c) => this.#inspection.handleWebsocketConnection(c)),
			//);

			app.all("*", (c) => {
				return c.text("Not Found (actor)", 404);
			});

			logger().info("server running", { port });
			const server = Deno.serve(
				{
					port,
					hostname: "0.0.0.0",
					// Remove "Listening on ..." message
					onListen() {},
				},
				app.fetch,
			);
			await server.finished;
		},
	} satisfies RivetHandler;

	return handler;
}
