import { describe, expect, test } from "vitest";
import type { DriverTestConfig } from "../mod";
import { FAKE_TIME, setupDriverTest, waitFor } from "../utils";

export function runActorConnTests(driverTestConfig: DriverTestConfig) {
	describe("Actor Connection Tests", () => {
		describe("Connection Methods", () => {
			test("should connect using .get().connect()", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create actor
				await client.counter.create(["test-get"]);

				// Get a handle and connect
				const handle = client.counter.get(["test-get"]);
				const connection = handle.connect();

				// Verify connection by performing an action
				const count = await connection.increment(5);
				expect(count).toBe(5);

				// Clean up
				await connection.dispose();
			});

			test("should connect using .getForId().connect()", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create a actor first to get its ID
				const handle = client.counter.getOrCreate(["test-get-for-id"]);
				await handle.increment(3);
				const actorId = await handle.resolve();

				// Get a new handle using the actor ID and connect
				const idHandle = client.counter.getForId(actorId);
				const connection = idHandle.connect();

				// Verify connection works and state is preserved
				const count = await connection.getCount();
				expect(count).toBe(3);

				// Clean up
				await connection.dispose();
			});

			test("should connect using .getOrCreate().connect()", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Get or create actor and connect
				const handle = client.counter.getOrCreate(["test-get-or-create"]);
				const connection = handle.connect();

				// Verify connection works
				const count = await connection.increment(7);
				expect(count).toBe(7);

				// Clean up
				await connection.dispose();
			});

			test("should connect using (await create()).connect()", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create actor and connect
				const handle = await client.counter.create(["test-create"]);
				const connection = handle.connect();

				// Verify connection works
				const count = await connection.increment(9);
				expect(count).toBe(9);

				// Clean up
				await connection.dispose();
			});
		});

		describe("Event Communication", () => {
			test("should mix RPC calls and WebSocket events", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create actor
				const handle = client.counter.getOrCreate(["test-mixed-rpc-ws"]);
				const connection = handle.connect();

				// Set up event listener
				const receivedEvents: number[] = [];
				connection.on("newCount", (count: number) => {
					receivedEvents.push(count);
				});

				// Send one RPC call over the connection to ensure it's open
				await connection.increment(1);

				// Now use stateless RPC calls through the handle (no connection)
				// These should still trigger events that the connection receives
				await handle.increment(5);
				await handle.increment(3);

				// Verify events were received from both connection and handle calls
				expect(receivedEvents).toContain(1); // From connection call
				expect(receivedEvents).toContain(6); // From first handle call (1+5)
				expect(receivedEvents).toContain(9); // From second handle call (6+3)

				// Clean up
				await connection.dispose();
			});

			test("should receive events via broadcast", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create actor and connect
				const handle = client.counter.getOrCreate(["test-broadcast"]);
				const connection = handle.connect();

				// Set up event listener
				const receivedEvents: number[] = [];
				connection.on("newCount", (count: number) => {
					receivedEvents.push(count);
				});

				// Trigger broadcast events
				await connection.increment(5);
				await connection.increment(3);

				// Verify events were received
				expect(receivedEvents).toContain(5);
				expect(receivedEvents).toContain(8);

				// Clean up
				await connection.dispose();
			});

			test("should handle one-time events with once()", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create actor and connect
				const handle = client.counter.getOrCreate(["test-once"]);
				const connection = handle.connect();

				// Set up one-time event listener
				const receivedEvents: number[] = [];
				connection.once("newCount", (count: number) => {
					receivedEvents.push(count);
				});

				// Trigger multiple events, but should only receive the first one
				await connection.increment(5);
				await connection.increment(3);

				// Verify only the first event was received
				expect(receivedEvents).toEqual([5]);
				expect(receivedEvents).not.toContain(8);

				// Clean up
				await connection.dispose();
			});

			test("should unsubscribe from events", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create actor and connect
				const handle = client.counter.getOrCreate(["test-unsubscribe"]);
				const connection = handle.connect();

				// Set up event listener with unsubscribe
				const receivedEvents: number[] = [];
				const unsubscribe = connection.on("newCount", (count: number) => {
					receivedEvents.push(count);
				});

				// Trigger first event
				await connection.increment(5);

				// Unsubscribe
				unsubscribe();

				// Trigger second event, should not be received
				await connection.increment(3);

				// Verify only the first event was received
				expect(receivedEvents).toEqual([5]);
				expect(receivedEvents).not.toContain(8);

				// Clean up
				await connection.dispose();
			});
		});

		describe("Connection Parameters", () => {
			test("should pass connection parameters", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create two connections with different params
				const handle1 = client.counterWithParams.getOrCreate(["test-params"], {
					params: { name: "user1" },
				});
				const handle2 = client.counterWithParams.getOrCreate(["test-params"], {
					params: { name: "user2" },
				});

				const conn1 = handle1.connect();
				const conn2 = handle2.connect();

				// HACK: Call an action to wait for the connections to be established
				await conn1.getInitializers();
				await conn2.getInitializers();

				// Get initializers to verify connection params were used
				const initializers = await conn1.getInitializers();

				// Verify both connection names were recorded
				expect(initializers).toContain("user1");
				expect(initializers).toContain("user2");

				// Clean up
				await conn1.dispose();
				await conn2.dispose();
			});
		});

		describe("Lifecycle Hooks", () => {
			test("should trigger lifecycle hooks", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create and connect
				const connHandle = client.counterWithLifecycle.getOrCreate(
					["test-lifecycle"],
					{
						params: { trackLifecycle: true },
					},
				);
				const connection = connHandle.connect();

				// Verify lifecycle events were triggered
				const events = await connection.getEvents();
				expect(events).toEqual(["onStart", "onBeforeConnect", "onConnect"]);

				// Disconnect should trigger onDisconnect
				await connection.dispose();

				// Reconnect to check if onDisconnect was called
				const handle = client.counterWithLifecycle.getOrCreate([
					"test-lifecycle",
				]);
				const finalEvents = await handle.getEvents();
				expect(finalEvents).toBeOneOf([
					// Still active
					["onStart", "onBeforeConnect", "onConnect", "onDisconnect"],
					// Went to sleep and woke back up
					[
						"onStart",
						"onBeforeConnect",
						"onConnect",
						"onDisconnect",
						"onStart",
					],
				]);
			});
		});

		describe("Connection Liveness", () => {
			test("should return correct liveness status for connections", async (c) => {
				const { client } = await setupDriverTest(c, driverTestConfig);

				// Create actor and connection
				const handle = client.connLivenessActor.getOrCreate([
					"test-liveness-status",
				]);
				const connA = handle.connect();
				const connB = handle.connect();

				const connAId = await connA.getConnectionId();
				const connBId = await connB.getConnectionId();

				// Verify connection works initially
				await connA.increment(5);
				await connB.increment(5);

				const counter = await handle.getCounter();
				expect(counter).toBe(10);

				const connectionsStatusBeforeKill =
					await handle.getWsConnectionsLiveness();
				expect(connectionsStatusBeforeKill).toHaveLength(2);
				expect(connectionsStatusBeforeKill).toContainEqual(
					expect.objectContaining({
						id: connAId,
						status: "connected",
						lastSeen: FAKE_TIME.getTime(),
					}),
				);
				expect(connectionsStatusBeforeKill).toContainEqual(
					expect.objectContaining({
						id: connBId,
						status: "connected",
						lastSeen: FAKE_TIME.getTime(),
					}),
				);

				// Kill one connection
				await handle.kill(connAId); // instead of dispose, we use kill to simulate a disconnection (e.g. network failure)
				// connA.dispose();
				// we killed the connection, but the actor instance does not know about it yet
				// it should still be in the list of connections, but with a status of "reconnecting"
				const connectionsStatusAfterKill =
					await handle.getWsConnectionsLiveness();
				expect(connectionsStatusAfterKill).toEqual(
					expect.arrayContaining([
						expect.objectContaining({
							id: connAId,
							status: "reconnecting",
							lastSeen: FAKE_TIME.getTime(),
						}),
						expect.objectContaining({
							id: connBId,
							status: "connected",
							lastSeen: FAKE_TIME.getTime(),
						}),
					]),
				);

				// default time to wait for cleanup is 5 seconds
				// check actor options
				await waitFor(driverTestConfig, 5_000);

				// After timeout, the killed connection should be unavailable, since the manager has cleaned it up
				const connectionsStatusAfterCleanup =
					await handle.getWsConnectionsLiveness();
				expect(connectionsStatusAfterCleanup).not.toContainEqual(
					expect.objectContaining({
						id: connAId,
					}),
				);
				expect(connectionsStatusAfterCleanup).toContainEqual(
					expect.objectContaining({
						id: connBId,
					}),
				);
			});
		});
	});
}
