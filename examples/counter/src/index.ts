import { createHandler } from "@actor-core/cloudflare-workers";
import Counter from "./counter";

const { Actor, handler } = createHandler({
	actors: {
		counter: Counter,
	},
});

export { handler as default, Actor };
