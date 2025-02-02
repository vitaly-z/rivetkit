import { Manager } from "@rivet-gg/actor-manager";
import { buildManager } from "./manager";

export { Actor } from "./actor";

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const manager = new Manager(buildManager(env));

		const router = manager.router();

		// TODO: Mount router for actor under /actor/xxxx/*

		return await router.fetch(request, env, ctx);

		//env.ACTOR.idFromName()

		// TODO: Implement manager API
		//if (request.url.endsWith("/websocket")) {
		//  // Expect to receive a WebSocket Upgrade request.
		//  // If there is one, accept the request and return a WebSocket Response.
		//  const upgradeHeader = request.headers.get('Upgrade');
		//  if (!upgradeHeader || upgradeHeader !== 'websocket') {
		//    return new Response('Durable Object expected Upgrade: websocket', { status: 426 });
		//  }
		//
		//  // This example will refer to the same Durable Object,
		//  // since the name "foo" is hardcoded.
		//  let id = env.WEBSOCKET_SERVER.idFromName("foo");
		//  let stub = env.WEBSOCKET_SERVER.get(id);
		//
		//  return stub.fetch(request);
		//}
		//
		//return new Response(null, {
		//  status: 400,
		//  statusText: 'Bad Request',
		//  headers: {
		//    'Content-Type': 'text/plain',
		//  },
		//});
	},
} satisfies ExportedHandler<Env>;

