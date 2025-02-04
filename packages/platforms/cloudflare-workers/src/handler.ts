import type { Config } from "@actor-core/actor-runtime";
import { Manager } from "@actor-core/manager-runtime";
import {
	type DurableObjectConstructor,
	createActorDurableObject,
} from "./actor";
import type { Env } from "./env";
import { logger } from "./log";
import { buildManager } from "./manager";

export interface Handler {
	handler: ExportedHandler<Env>;
	ActorHandler: DurableObjectConstructor;
}

export function createHandler(config: Config): Handler {
	const ActorHandler = createActorDurableObject(config);

	const handler = {
		async fetch(request, env: Env, ctx: ExecutionContext): Promise<Response> {
			const url = new URL(request.url);
			const origin = url.origin;

			const manager = new Manager(buildManager(env, origin));

			const app = manager.router;

			app.get("/actors/:actorId/:path{.+}", (c) => {
				// Reject requests that don't require upgrade
				if (c.req.header("upgrade") !== "websocket") {
					return c.text("Expected Upgrade: websocket", 426);
				}

				const actorId = c.req.param("actorId");
				const subpath = `/${c.req.param("path")}`;
				logger().debug("forwarding request", { actorId, subpath });

				const id = env.ACTOR_DO.idFromString(actorId);
				const stub = env.ACTOR_DO.get(id);

				// Modify the path tor emove the prefix
				const url = new URL(request.url);
				url.pathname = subpath;
				const actorRequest = new Request(url.toString(), c.req.raw);

				return stub.fetch(actorRequest);
			});

			app.all("*", (c) => {
				return c.text("Not Found (manager)", 404);
			});

			return await app.fetch(request, env, ctx);
		},
	} satisfies ExportedHandler<Env>;

	return { handler, ActorHandler };
}
