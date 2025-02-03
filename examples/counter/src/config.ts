import type { Config } from "rivet-core";
import Counter from "./counter";

export default {
	actors: {
		counter: Counter,
	},
} satisfies Config;

