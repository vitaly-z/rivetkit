import { Client } from "actor-core/client";
import type Counter from "../src/counter.ts";

async function main() {
	const client = new Client("http://localhost:8787");

	const counter = await client.get<Counter>({ name: "counter" });

	counter.on("newCount", (count: number) => console.log("Event:", count));

	const out = await counter.increment(5);
	console.log("RPC:", out);

	await counter.disconnect();
}

main();
