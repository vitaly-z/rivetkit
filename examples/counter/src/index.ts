import { DurableObject } from "cloudflare:workers";
import Manager from "@rivet-gg/actor-manager";

interface Env {
	//ACTOR: DurableObjectNamespace<Actor>;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const manager = new Manager({
			async queryActor(request) {
				console.log('query');
				return {} as any;
			},
			// TODO:
			//actorRouter: {
			//	connect() {
			//		// TODO:
			//	}
			//}
		});

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

export class Actor extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async fetch(request: Request): Promise<Response> {
		// TODO: Expose Actor hono router

		// Creates two ends of a WebSocket connection.
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);

		server.accept();

		//// Upon receiving a message from the client, the server replies with the same message,
		//// and the total number of connections with the "[Durable Object]: " prefix
		//server.addEventListener("message", (event: MessageEvent) => {
		//	server.send(
		//		`[Durable Object] currentlyConnectedWebSockets: ${this.currentlyConnectedWebSockets}`,
		//	);
		//});

		// If the client closes the connection, the runtime will close the connection too.
		server.addEventListener("close", (cls: CloseEvent) => {
			//this.currentlyConnectedWebSockets -= 1;
			server.close(cls.code, "Durable Object is closing WebSocket");
		});

		return new Response(null, {
			status: 101,
			webSocket: client,
		});
	}
}
