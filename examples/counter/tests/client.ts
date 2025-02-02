import { Client } from "@actor-core/client";
import { setupLogging } from "@actor-core/common/log";
import type Counter from "../src/counter.ts";

async function main() {
	setupLogging();

	const client = new Client("http://localhost:8787");

	// Get-or-create a counter actor
	const counter = await client.get<Counter>({ name: "counter" });

	// Listen for update count events (https://rivet.gg/docs/events)
	counter.on("countUpdate", (count: number) =>
		console.log("New count:", count),
	);

	// Increment the count over remote procedure call (https://rivet.gg/docs/rpc)
	const count1 = await counter.increment(1);
	console.log(count1);
	const count2 = await counter.increment(2);
	console.log(count2);

	// Disconnect from the actor when finished (https://rivet.gg/docs/connections)
	await counter.disconnect();
}

main();
