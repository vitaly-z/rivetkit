import * as cbor from "cbor-x";
import invariant from "invariant";
import onChange from "on-change";
import type { ActorKey } from "@/actor/mod";
import type * as wsToClient from "@/actor/protocol/message/to-client";
import type * as wsToServer from "@/actor/protocol/message/to-server";
import type { Client } from "@/client/client";
import type { Logger } from "@/common/log";
import { isCborSerializable, stringifyError } from "@/common/utils";
import type { UniversalWebSocket } from "@/common/websocket-interface";
import { ActorInspector } from "@/inspector/actor";
import type { Registry } from "@/mod";
import type { ActionContext } from "./action";
import type { ActorConfig } from "./config";
import {
	CONNECTION_CHECK_LIVENESS_SYMBOL,
	Conn,
	type ConnectionDriver,
	type ConnId,
} from "./connection";
import { ActorContext } from "./context";
import type { AnyDatabaseProvider, InferDatabaseClient } from "./database";
import type { ActorDriver, ConnDriver, ConnectionDriversMap } from "./driver";
import * as errors from "./errors";
import { instanceLogger, logger } from "./log";
import type {
	PersistedActor,
	PersistedConn,
	PersistedScheduleEvent,
} from "./persisted";
import { processMessage } from "./protocol/message/mod";
import { CachedSerializer } from "./protocol/serde";
import { Schedule, type ScheduledEvent } from "./schedule";
import { DeadlineError, deadline, Lock } from "./utils";

/**
 * Options for the `_saveState` method.
 */
export interface SaveStateOptions {
	/**
	 * Forces the state to be saved immediately. This function will return when the state has saved successfully.
	 */
	immediate?: boolean;
}

/** Actor type alias with all `any` types. Used for `extends` in classes referencing this actor. */
export type AnyActorInstance = ActorInstance<
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	any,
	// biome-ignore lint/suspicious/noExplicitAny: Needs to be used in `extends`
	any
>;

export type ExtractActorState<A extends AnyActorInstance> =
	A extends ActorInstance<
		infer State,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any
	>
		? State
		: never;

export type ExtractActorConnParams<A extends AnyActorInstance> =
	A extends ActorInstance<
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		infer ConnParams,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any
	>
		? ConnParams
		: never;

export type ExtractActorConnState<A extends AnyActorInstance> =
	A extends ActorInstance<
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		infer ConnState,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any,
		// biome-ignore lint/suspicious/noExplicitAny: Must be used for `extends`
		any
	>
		? ConnState
		: never;

export class ActorInstance<
	S,
	CP,
	CS,
	V,
	I,
	AD,
	DB extends AnyDatabaseProvider,
> {
	// Shared actor context for this instance
	actorContext: ActorContext<S, CP, CS, V, I, AD, DB>;
	isStopping = false;

	#persistChanged = false;

	/**
	 * The proxied state that notifies of changes automatically.
	 *
	 * Any data that should be stored indefinitely should be held within this object.
	 */
	#persist!: PersistedActor<S, CP, CS, I>;

	/** Raw state without the proxy wrapper */
	#persistRaw!: PersistedActor<S, CP, CS, I>;

	#writePersistLock = new Lock<void>(void 0);

	#lastSaveTime = 0;
	#pendingSaveTimeout?: NodeJS.Timeout;

	#vars?: V;

	#backgroundPromises: Promise<void>[] = [];
	#config: ActorConfig<S, CP, CS, V, I, AD, DB>;
	#connectionDrivers!: ConnectionDriversMap;
	#actorDriver!: ActorDriver;
	#inlineClient!: Client<Registry<any>>;
	#actorId!: string;
	#name!: string;
	#key!: ActorKey;
	#region!: string;
	#ready = false;

	#connections = new Map<ConnId, Conn<S, CP, CS, V, I, AD, DB>>();
	#subscriptionIndex = new Map<string, Set<Conn<S, CP, CS, V, I, AD, DB>>>();

	#schedule!: Schedule;
	#db!: InferDatabaseClient<DB>;

	#inspector = new ActorInspector(() => {
		return {
			isDbEnabled: async () => {
				return this.#db !== undefined;
			},
			getDb: async () => {
				return this.db;
			},
			isStateEnabled: async () => {
				return this.stateEnabled;
			},
			getState: async () => {
				this.#validateStateEnabled();

				// Must return from `#persistRaw` in order to not return the `onchange` proxy
				return this.#persistRaw.s as Record<string, any> as unknown;
			},
			getRpcs: async () => {
				return Object.keys(this.#config.actions);
			},
			getConnections: async () => {
				return Array.from(this.#connections.entries()).map(([id, conn]) => ({
					id,
					stateEnabled: conn._stateEnabled,
					params: conn.params as {},
					state: conn._stateEnabled ? conn.state : undefined,
					auth: conn.auth as {},
				}));
			},
			setState: async (state: unknown) => {
				this.#validateStateEnabled();

				// Must set on `#persist` instead of `#persistRaw` in order to ensure that the `Proxy` is correctly configured
				//
				// We have to use `...` so `on-change` recognizes the changes to `state` (i.e. set #persistChanged` to true). This is because:
				// 1. In `getState`, we returned the value from `persistRaw`, which does not have the Proxy to monitor state changes
				// 2. If we were to assign `state` to `#persist.s`, `on-change` would assume nothing changed since `state` is still === `#persist.s` since we returned a reference in `getState`
				this.#persist.s = { ...(state as S) };
				await this.saveState({ immediate: true });
			},
		};
	});

	get id() {
		return this.#actorId;
	}

	get inlineClient(): Client<Registry<any>> {
		return this.#inlineClient;
	}

	get inspector() {
		return this.#inspector;
	}

	/**
	 * This constructor should never be used directly.
	 *
	 * Constructed in {@link ActorInstance.start}.
	 *
	 * @private
	 */
	constructor(config: ActorConfig<S, CP, CS, V, I, AD, DB>) {
		this.#config = config;
		this.actorContext = new ActorContext(this);
	}

	async start(
		connectionDrivers: ConnectionDriversMap,
		actorDriver: ActorDriver,
		inlineClient: Client<Registry<any>>,
		actorId: string,
		name: string,
		key: ActorKey,
		region: string,
	) {
		this.#connectionDrivers = connectionDrivers;
		this.#actorDriver = actorDriver;
		this.#inlineClient = inlineClient;
		this.#actorId = actorId;
		this.#name = name;
		this.#key = key;
		this.#region = region;
		this.#schedule = new Schedule(this);

		// Initialize server
		//
		// Store the promise so network requests can await initialization
		await this.#initialize();

		// TODO: Exit process if this errors
		if (this.#varsEnabled) {
			let vars: V | undefined;
			if ("createVars" in this.#config) {
				const dataOrPromise = this.#config.createVars(
					this.actorContext as unknown as ActorContext<
						undefined,
						undefined,
						undefined,
						undefined,
						undefined,
						undefined,
						any
					>,
					this.#actorDriver.getContext(this.#actorId),
				);
				if (dataOrPromise instanceof Promise) {
					vars = await deadline(
						dataOrPromise,
						this.#config.options.lifecycle.createVarsTimeout,
					);
				} else {
					vars = dataOrPromise;
				}
			} else if ("vars" in this.#config) {
				vars = structuredClone(this.#config.vars);
			} else {
				throw new Error("Could not variables from 'createVars' or 'vars'");
			}
			this.#vars = vars;
		}

		// TODO: Exit process if this errors
		logger().info("actor starting");
		if (this.#config.onStart) {
			const result = this.#config.onStart(this.actorContext);
			if (result instanceof Promise) {
				await result;
			}
		}

		// Setup Database
		if ("db" in this.#config && this.#config.db) {
			const client = await this.#config.db.createClient({
				getDatabase: () => actorDriver.getDatabase(this.#actorId),
			});
			logger().info("database migration starting");
			await this.#config.db.onMigrate?.(client);
			logger().info("database migration complete");
			this.#db = client;
		}

		// Set alarm for next scheduled event if any exist after finishing initiation sequence
		if (this.#persist.e.length > 0) {
			await this.#actorDriver.setAlarm(this, this.#persist.e[0].t);
		}

		logger().info("actor ready");
		this.#ready = true;

		this.#scheduleLivenessCheck();
	}

	async #scheduleEventInner(timestamp: number, event: ScheduledEvent) {
		// Build event
		let newEvent: PersistedScheduleEvent;
		if ("checkConnectionLiveness" in event) {
			newEvent = {
				ccl: event.checkConnectionLiveness,
				t: timestamp,
			};
		} else {
			newEvent = {
				e: crypto.randomUUID(),
				t: timestamp,
				a: event.fn,
				ar: event.args,
			};
		}

		this.actorContext.log.info("scheduling event", newEvent);

		// remove old ccl event
		if ("ccl" in newEvent) {
			const existingIndex = this.#persist.e.findIndex(
				(event) => "ccl" in event,
			);
			if (existingIndex !== -1) {
				this.#persist.e.splice(existingIndex, 1);
			}
		}

		// Insert event in to index
		const insertIndex = this.#persist.e.findIndex((x) => x.t > newEvent.t);
		if (insertIndex === -1) {
			this.#persist.e.push(newEvent);
		} else {
			this.#persist.e.splice(insertIndex, 0, newEvent);
		}

		// Update alarm if:
		// - this is the newest event (i.e. at beginning of array) or
		// - this is the only event (i.e. the only event in the array)
		if (insertIndex === 0 || this.#persist.e.length === 1) {
			this.actorContext.log.info("setting alarm", { timestamp });
			await this.#actorDriver.setAlarm(this, newEvent.t);
		}
	}

	async onAlarm() {
		const now = Date.now();
		this.actorContext.log.debug("alarm triggered", {
			now,
			events: this.#persist.e.length,
		});

		// Remove events from schedule that we're about to run
		const runIndex = this.#persist.e.findIndex((x) => x.t <= now);
		if (runIndex === -1) {
			this.actorContext.log.debug("no events to run", { now });
			return;
		}
		const scheduleEvents = this.#persist.e.splice(0, runIndex + 1);
		this.actorContext.log.debug("running events", {
			count: scheduleEvents.length,
		});

		// Set alarm for next event
		if (this.#persist.e.length > 0) {
			await this.#actorDriver.setAlarm(this, this.#persist.e[0].t);
		}

		// Iterate by event key in order to ensure we call the events in order
		for (const event of scheduleEvents) {
			try {
				if ("ccl" in event) {
					this.#checkConnectionsLiveness();
				} else {
					this.actorContext.log.info("running action for event", {
						event: event.e,
						timestamp: event.t,
						action: event.a,
						args: event.ar,
					});

					// Look up function
					const fn: unknown = this.#config.actions[event.a];

					if (!fn) throw new Error(`Missing action for alarm ${event.a}`);
					if (typeof fn !== "function")
						throw new Error(
							`Alarm function lookup for ${event.a} returned ${typeof fn}`,
						);

					// Call function
					try {
						await fn.call(undefined, this.actorContext, ...(event.ar || []));
					} catch (error) {
						this.actorContext.log.error("error while running event", {
							error: stringifyError(error),
							event: event.e,
							timestamp: event.t,
							action: event.a,
							args: event.ar,
						});
					}
				}
			} catch (error) {
				this.actorContext.log.error("internal error while running event", {
					error: stringifyError(error),
					...event,
				});
			}
		}
	}

	async scheduleEvent(
		timestamp: number,
		fn: string,
		args: unknown[],
	): Promise<void> {
		return this.#scheduleEventInner(timestamp, { fn, args });
	}

	get stateEnabled() {
		return "createState" in this.#config || "state" in this.#config;
	}

	#validateStateEnabled() {
		if (!this.stateEnabled) {
			throw new errors.StateNotEnabled();
		}
	}

	get #connStateEnabled() {
		return "createConnState" in this.#config || "connState" in this.#config;
	}

	get #varsEnabled() {
		return "createVars" in this.#config || "vars" in this.#config;
	}

	#validateVarsEnabled() {
		if (!this.#varsEnabled) {
			throw new errors.VarsNotEnabled();
		}
	}

	/** Promise used to wait for a save to complete. This is required since you cannot await `#saveStateThrottled`. */
	#onPersistSavedPromise?: PromiseWithResolvers<void>;

	/** Throttled save state method. Used to write to KV at a reasonable cadence. */
	#savePersistThrottled() {
		const now = Date.now();
		const timeSinceLastSave = now - this.#lastSaveTime;
		const saveInterval = this.#config.options.state.saveInterval;

		// If we're within the throttle window and not already scheduled, schedule the next save.
		if (timeSinceLastSave < saveInterval) {
			if (this.#pendingSaveTimeout === undefined) {
				this.#pendingSaveTimeout = setTimeout(() => {
					this.#pendingSaveTimeout = undefined;
					this.#savePersistInner();
				}, saveInterval - timeSinceLastSave);
			}
		} else {
			// If we're outside the throttle window, save immediately
			this.#savePersistInner();
		}
	}

	/** Saves the state to KV. You probably want to use #saveStateThrottled instead except for a few edge cases. */
	async #savePersistInner() {
		try {
			this.#lastSaveTime = Date.now();

			if (this.#persistChanged) {
				// Use a lock in order to avoid race conditions with multiple
				// parallel promises writing to KV. This should almost never happen
				// unless there are abnormally high latency in KV writes.
				await this.#writePersistLock.lock(async () => {
					logger().debug("saving persist");

					// There might be more changes while we're writing, so we set this
					// before writing to KV in order to avoid a race condition.
					this.#persistChanged = false;

					// Write to KV
					await this.#actorDriver.writePersistedData(
						this.#actorId,
						cbor.encode(this.#persistRaw),
					);

					logger().debug("persist saved");
				});
			}

			this.#onPersistSavedPromise?.resolve();
		} catch (error) {
			this.#onPersistSavedPromise?.reject(error);
			throw error;
		}
	}

	/**
	 * Creates proxy for `#persist` that handles automatically flagging when state needs to be updated.
	 */
	#setPersist(target: PersistedActor<S, CP, CS, I>) {
		// Set raw persist object
		this.#persistRaw = target;

		// TODO: Only validate this for conn state
		// TODO: Allow disabling in production
		// If this can't be proxied, return raw value
		if (target === null || typeof target !== "object") {
			let invalidPath = "";
			if (
				!isCborSerializable(
					target,
					(path) => {
						invalidPath = path;
					},
					"",
				)
			) {
				throw new errors.InvalidStateType({ path: invalidPath });
			}
			return target;
		}

		// Unsubscribe from old state
		if (this.#persist) {
			onChange.unsubscribe(this.#persist);
		}

		// Listen for changes to the object in order to automatically write state
		this.#persist = onChange(
			target,
			// biome-ignore lint/suspicious/noExplicitAny: Don't know types in proxy
			(path: string, value: any, _previousValue: any, _applyData: any) => {
				let invalidPath = "";
				if (
					!isCborSerializable(
						value,
						(invalidPathPart) => {
							invalidPath = invalidPathPart;
						},
						"",
					)
				) {
					throw new errors.InvalidStateType({
						path: path + (invalidPath ? `.${invalidPath}` : ""),
					});
				}
				this.#persistChanged = true;

				// Inform the inspector about state changes
				this.inspector.emitter.emit("stateUpdated", this.#persist.s);

				// Call onStateChange if it exists
				if (this.#config.onStateChange && this.#ready) {
					try {
						this.#config.onStateChange(this.actorContext, this.#persistRaw.s);
					} catch (error) {
						logger().error("error in `_onStateChange`", {
							error: stringifyError(error),
						});
					}
				}

				// State will be flushed at the end of the action
			},
			{ ignoreDetached: true },
		);
	}

	async #initialize() {
		// Read initial state
		const persistDataBuffer = await this.#actorDriver.readPersistedData(
			this.#actorId,
		);
		invariant(
			persistDataBuffer !== undefined,
			"persist data has not been set, it should be set when initialized",
		);
		const persistData = cbor.decode(persistDataBuffer) as PersistedActor<
			S,
			CP,
			CS,
			I
		>;

		if (persistData.hi) {
			logger().info("actor restoring", {
				connections: persistData.c.length,
			});

			// Set initial state
			this.#setPersist(persistData);

			// Load connections
			for (const connPersist of this.#persist.c) {
				// Create connections
				const driver = this.__getConnDriver(connPersist.d);
				const conn = new Conn<S, CP, CS, V, I, AD, DB>(
					this,
					connPersist,
					driver,
					this.#connStateEnabled,
				);
				this.#connections.set(conn.id, conn);

				// Register event subscriptions
				for (const sub of connPersist.su) {
					this.#addSubscription(sub.n, conn, true);
				}
			}
		} else {
			logger().info("actor creating");

			// Initialize actor state
			let stateData: unknown;
			if (this.stateEnabled) {
				logger().info("actor state initializing");

				if ("createState" in this.#config) {
					this.#config.createState;

					// Convert state to undefined since state is not defined yet here
					stateData = await this.#config.createState(
						this.actorContext as unknown as ActorContext<
							undefined,
							undefined,
							undefined,
							undefined,
							undefined,
							undefined,
							undefined
						>,
						{ input: persistData.i },
					);
				} else if ("state" in this.#config) {
					stateData = structuredClone(this.#config.state);
				} else {
					throw new Error("Both 'createState' or 'state' were not defined");
				}
			} else {
				logger().debug("state not enabled");
			}

			// Save state and mark as initialized
			persistData.s = stateData as S;
			persistData.hi = true;

			// Update state
			logger().debug("writing state");
			await this.#actorDriver.writePersistedData(
				this.#actorId,
				cbor.encode(persistData),
			);

			this.#setPersist(persistData);

			// Notify creation
			if (this.#config.onCreate) {
				await this.#config.onCreate(this.actorContext, {
					input: persistData.i,
				});
			}
		}
	}

	__getConnForId(id: string): Conn<S, CP, CS, V, I, AD, DB> | undefined {
		return this.#connections.get(id);
	}

	/**
	 * Removes a connection and cleans up its resources.
	 */
	__removeConn(conn: Conn<S, CP, CS, V, I, AD, DB> | undefined) {
		if (!conn) {
			logger().warn("`conn` does not exist");
			return;
		}

		// Remove from persist & save immediately
		const connIdx = this.#persist.c.findIndex((c) => c.i === conn.id);
		if (connIdx !== -1) {
			this.#persist.c.splice(connIdx, 1);
			this.saveState({ immediate: true });
		} else {
			logger().warn("could not find persisted connection to remove", {
				connId: conn.id,
			});
		}

		// Remove from state
		this.#connections.delete(conn.id);

		// Remove subscriptions
		for (const eventName of [...conn.subscriptions.values()]) {
			this.#removeSubscription(eventName, conn, true);
		}

		this.inspector.emitter.emit("connectionUpdated");
		if (this.#config.onDisconnect) {
			try {
				const result = this.#config.onDisconnect(this.actorContext, conn);
				if (result instanceof Promise) {
					// Handle promise but don't await it to prevent blocking
					result.catch((error) => {
						logger().error("error in `onDisconnect`", {
							error: stringifyError(error),
						});
					});
				}
			} catch (error) {
				logger().error("error in `onDisconnect`", {
					error: stringifyError(error),
				});
			}
		}
	}

	async prepareConn(
		// biome-ignore lint/suspicious/noExplicitAny: TypeScript bug with ExtractActorConnParams<this>,
		params: any,
		request?: Request,
	): Promise<CS> {
		// Authenticate connection
		let connState: CS | undefined;

		const onBeforeConnectOpts = {
			request,
			params,
		};

		if (this.#config.onBeforeConnect) {
			await this.#config.onBeforeConnect(
				this.actorContext,
				onBeforeConnectOpts,
			);
		}

		if (this.#connStateEnabled) {
			if ("createConnState" in this.#config) {
				const dataOrPromise = this.#config.createConnState(
					this.actorContext as unknown as ActorContext<
						undefined,
						undefined,
						undefined,
						undefined,
						undefined,
						undefined,
						undefined
					>,
					onBeforeConnectOpts,
				);
				if (dataOrPromise instanceof Promise) {
					connState = await deadline(
						dataOrPromise,
						this.#config.options.lifecycle.createConnStateTimeout,
					);
				} else {
					connState = dataOrPromise;
				}
			} else if ("connState" in this.#config) {
				connState = structuredClone(this.#config.connState);
			} else {
				throw new Error(
					"Could not create connection state from 'createConnState' or 'connState'",
				);
			}
		}

		return connState as CS;
	}

	__getConnDriver(driverId: ConnectionDriver): ConnDriver {
		// Get driver
		const driver = this.#connectionDrivers[driverId];
		if (!driver) throw new Error(`No connection driver: ${driverId}`);
		return driver;
	}

	/**
	 * Called after establishing a connection handshake.
	 */
	async createConn(
		connectionId: string,
		connectionToken: string,
		params: CP,
		state: CS,
		driverId: ConnectionDriver,
		driverState: unknown,
		authData: unknown,
	): Promise<Conn<S, CP, CS, V, I, AD, DB>> {
		this.#assertReady();

		if (this.#connections.has(connectionId)) {
			throw new Error(`Connection already exists: ${connectionId}`);
		}

		// Create connection
		const driver = this.__getConnDriver(driverId);
		const persist: PersistedConn<CP, CS> = {
			i: connectionId,
			t: connectionToken,
			d: driverId,
			ds: driverState,
			p: params,
			s: state,
			a: authData,
			l: Date.now(),
			su: [],
		};
		const conn = new Conn<S, CP, CS, V, I, AD, DB>(
			this,
			persist,
			driver,
			this.#connStateEnabled,
		);
		this.#connections.set(conn.id, conn);

		// Add to persistence & save immediately
		this.#persist.c.push(persist);
		this.saveState({ immediate: true });

		// Handle connection
		if (this.#config.onConnect) {
			try {
				const result = this.#config.onConnect(this.actorContext, conn);
				if (result instanceof Promise) {
					deadline(
						result,
						this.#config.options.lifecycle.onConnectTimeout,
					).catch((error) => {
						logger().error("error in `onConnect`, closing socket", {
							error,
						});
						conn?.disconnect("`onConnect` failed");
					});
				}
			} catch (error) {
				logger().error("error in `onConnect`", {
					error: stringifyError(error),
				});
				conn?.disconnect("`onConnect` failed");
			}
		}

		this.inspector.emitter.emit("connectionUpdated");

		// Send init message
		conn._sendMessage(
			new CachedSerializer<wsToClient.ToClient>({
				b: {
					i: {
						ai: this.id,
						ci: conn.id,
						ct: conn._token,
					},
				},
			}),
		);

		return conn;
	}

	// MARK: Messages
	async processMessage(
		message: wsToServer.ToServer,
		conn: Conn<S, CP, CS, V, I, AD, DB>,
	) {
		await processMessage(message, this, conn, {
			onExecuteAction: async (ctx, name, args) => {
				this.inspector.emitter.emit("eventFired", {
					type: "action",
					name,
					args,
					connId: conn.id,
				});
				return await this.executeAction(ctx, name, args);
			},
			onSubscribe: async (eventName, conn) => {
				this.inspector.emitter.emit("eventFired", {
					type: "subscribe",
					eventName,
					connId: conn.id,
				});
				this.#addSubscription(eventName, conn, false);
			},
			onUnsubscribe: async (eventName, conn) => {
				this.inspector.emitter.emit("eventFired", {
					type: "unsubscribe",
					eventName,
					connId: conn.id,
				});
				this.#removeSubscription(eventName, conn, false);
			},
		});
	}

	// MARK: Events
	#addSubscription(
		eventName: string,
		connection: Conn<S, CP, CS, V, I, AD, DB>,
		fromPersist: boolean,
	) {
		if (connection.subscriptions.has(eventName)) {
			logger().debug("connection already has subscription", { eventName });
			return;
		}

		// Persist subscriptions & save immediately
		//
		// Don't update persistence if already restoring from persistence
		if (!fromPersist) {
			connection.__persist.su.push({ n: eventName });
			this.saveState({ immediate: true });
		}

		// Update subscriptions
		connection.subscriptions.add(eventName);

		// Update subscription index
		let subscribers = this.#subscriptionIndex.get(eventName);
		if (!subscribers) {
			subscribers = new Set();
			this.#subscriptionIndex.set(eventName, subscribers);
		}
		subscribers.add(connection);
	}

	#removeSubscription(
		eventName: string,
		connection: Conn<S, CP, CS, V, I, AD, DB>,
		fromRemoveConn: boolean,
	) {
		if (!connection.subscriptions.has(eventName)) {
			logger().warn("connection does not have subscription", { eventName });
			return;
		}

		// Persist subscriptions & save immediately
		//
		// Don't update the connection itself if the connection is already being removed
		if (!fromRemoveConn) {
			connection.subscriptions.delete(eventName);

			const subIdx = connection.__persist.su.findIndex(
				(s) => s.n === eventName,
			);
			if (subIdx !== -1) {
				connection.__persist.su.splice(subIdx, 1);
			} else {
				logger().warn("subscription does not exist with name", { eventName });
			}

			this.saveState({ immediate: true });
		}

		// Update scriptions index
		const subscribers = this.#subscriptionIndex.get(eventName);
		if (subscribers) {
			subscribers.delete(connection);
			if (subscribers.size === 0) {
				this.#subscriptionIndex.delete(eventName);
			}
		}
	}

	#assertReady() {
		if (!this.#ready) throw new errors.InternalError("Actor not ready");
	}

	/**
	 * Check the liveness of all connections.
	 * Sets up a recurring check based on the configured interval.
	 * @internal
	 */
	#checkConnectionsLiveness() {
		logger().debug("checking connections liveness");

		for (const conn of this.#connections.values()) {
			const liveness = conn[CONNECTION_CHECK_LIVENESS_SYMBOL]();
			if (liveness.status === "connected") {
				logger().debug("connection is alive", { connId: conn.id });
			} else {
				const lastSeen = liveness.lastSeen;
				const sinceLastSeen = Date.now() - lastSeen;
				if (
					sinceLastSeen <
					this.#config.options.lifecycle.connectionLivenessTimeout
				) {
					logger().debug("connection might be alive, will check later", {
						connId: conn.id,
						lastSeen,
						sinceLastSeen,
					});
					continue;
				}
				// Connection is dead, remove it
				logger().warn("connection is dead, removing", {
					connId: conn.id,
					lastSeen,
				});
				// we might disconnect the connection here?
				// conn.disconnect("liveness check failed");
				this.__removeConn(conn);
			}
		}

		this.#scheduleLivenessCheck();
	}

	/**
	 * Schedule a liveness check for the connections.
	 * This will check if the liveness check is already scheduled and skip scheduling if it is.
	 * @internal
	 */
	#scheduleLivenessCheck() {
		if (this.isStopping) {
			logger().debug("actor is stopping, skipping liveness check");
			return;
		}

		this.#scheduleEventInner(
			Date.now() + this.#config.options.lifecycle.connectionLivenessInterval,
			{ checkConnectionLiveness: true },
		);
	}

	/**
	 * Check if the actor is ready to handle requests.
	 */
	isReady(): boolean {
		return this.#ready;
	}

	/**
	 * Execute an action call from a client.
	 *
	 * This method handles:
	 * 1. Validating the action name
	 * 2. Executing the action function
	 * 3. Processing the result through onBeforeActionResponse (if configured)
	 * 4. Handling timeouts and errors
	 * 5. Saving state changes
	 *
	 * @param ctx The action context
	 * @param actionName The name of the action being called
	 * @param args The arguments passed to the action
	 * @returns The result of the action call
	 * @throws {ActionNotFound} If the action doesn't exist
	 * @throws {ActionTimedOut} If the action times out
	 * @internal
	 */
	async executeAction(
		ctx: ActionContext<S, CP, CS, V, I, AD, DB>,
		actionName: string,
		args: unknown[],
	): Promise<unknown> {
		invariant(this.#ready, "executing action before ready");

		// Prevent calling private or reserved methods
		if (!(actionName in this.#config.actions)) {
			logger().warn("action does not exist", { actionName });
			throw new errors.ActionNotFound(actionName);
		}

		// Check if the method exists on this object
		const actionFunction = this.#config.actions[actionName];
		if (typeof actionFunction !== "function") {
			logger().warn("action is not a function", {
				actionName: actionName,
				type: typeof actionFunction,
			});
			throw new errors.ActionNotFound(actionName);
		}

		// TODO: pass abortable to the action to decide when to abort
		// TODO: Manually call abortable for better error handling
		// Call the function on this object with those arguments
		try {
			// Log when we start executing the action
			logger().debug("executing action", { actionName: actionName, args });

			const outputOrPromise = actionFunction.call(undefined, ctx, ...args);
			let output: unknown;
			if (outputOrPromise instanceof Promise) {
				// Log that we're waiting for an async action
				logger().debug("awaiting async action", { actionName: actionName });

				output = await deadline(
					outputOrPromise,
					this.#config.options.action.timeout,
				);

				// Log that async action completed
				logger().debug("async action completed", { actionName: actionName });
			} else {
				output = outputOrPromise;
			}

			// Process the output through onBeforeActionResponse if configured
			if (this.#config.onBeforeActionResponse) {
				try {
					const processedOutput = this.#config.onBeforeActionResponse(
						this.actorContext,
						actionName,
						args,
						output,
					);
					if (processedOutput instanceof Promise) {
						logger().debug("awaiting onBeforeActionResponse", {
							actionName: actionName,
						});
						output = await processedOutput;
						logger().debug("onBeforeActionResponse completed", {
							actionName: actionName,
						});
					} else {
						output = processedOutput;
					}
				} catch (error) {
					logger().error("error in `onBeforeActionResponse`", {
						error: stringifyError(error),
					});
				}
			}

			// Log the output before returning
			logger().debug("action completed", {
				actionName: actionName,
				outputType: typeof output,
				isPromise: output instanceof Promise,
			});

			// This output *might* reference a part of the state (using onChange), but
			// that's OK since this value always gets serialized and sent over the
			// network.
			return output;
		} catch (error) {
			if (error instanceof DeadlineError) {
				throw new errors.ActionTimedOut();
			}
			logger().error("action error", {
				actionName: actionName,
				error: stringifyError(error),
			});
			throw error;
		} finally {
			this.#savePersistThrottled();
		}
	}

	/**
	 * Returns a list of action methods available on this actor.
	 */
	get actions(): string[] {
		return Object.keys(this.#config.actions);
	}

	/**
	 * Handles raw HTTP requests to the actor.
	 */
	async handleFetch(request: Request, opts: { auth: AD }): Promise<Response> {
		this.#assertReady();

		if (!this.#config.onFetch) {
			throw new errors.FetchHandlerNotDefined();
		}

		try {
			const response = await this.#config.onFetch(
				this.actorContext,
				request,
				opts,
			);
			if (!response) {
				throw new errors.InvalidFetchResponse();
			}
			return response;
		} catch (error) {
			logger().error("onFetch error", {
				error: stringifyError(error),
			});
			throw error;
		} finally {
			this.#savePersistThrottled();
		}
	}

	/**
	 * Handles raw WebSocket connections to the actor.
	 */
	async handleWebSocket(
		websocket: UniversalWebSocket,
		opts: { request: Request; auth: AD },
	): Promise<void> {
		this.#assertReady();

		if (!this.#config.onWebSocket) {
			throw new errors.InternalError("onWebSocket handler not defined");
		}

		try {
			// Set up state tracking to detect changes during WebSocket handling
			const stateBeforeHandler = this.#persistChanged;

			await this.#config.onWebSocket(this.actorContext, websocket, opts);

			// If state changed during the handler, save it
			if (this.#persistChanged && !stateBeforeHandler) {
				await this.saveState({ immediate: true });
			}
		} catch (error) {
			logger().error("onWebSocket error", {
				error: stringifyError(error),
			});
			throw error;
		} finally {
			this.#savePersistThrottled();
		}
	}

	// MARK: Lifecycle hooks

	// MARK: Exposed methods
	/**
	 * Gets the logger instance.
	 */
	get log(): Logger {
		return instanceLogger();
	}

	/**
	 * Gets the name.
	 */
	get name(): string {
		return this.#name;
	}

	/**
	 * Gets the key.
	 */
	get key(): ActorKey {
		return this.#key;
	}

	/**
	 * Gets the region.
	 */
	get region(): string {
		return this.#region;
	}

	/**
	 * Gets the scheduler.
	 */
	get schedule(): Schedule {
		return this.#schedule;
	}

	/**
	 * Gets the map of connections.
	 */
	get conns(): Map<ConnId, Conn<S, CP, CS, V, I, AD, DB>> {
		return this.#connections;
	}

	/**
	 * Gets the current state.
	 *
	 * Changing properties of this value will automatically be persisted.
	 */
	get state(): S {
		this.#validateStateEnabled();
		return this.#persist.s;
	}

	/**
	 * Gets the database.
	 * @experimental
	 * @throws {DatabaseNotEnabled} If the database is not enabled.
	 */
	get db(): InferDatabaseClient<DB> {
		if (!this.#db) {
			throw new errors.DatabaseNotEnabled();
		}
		return this.#db;
	}

	/**
	 * Sets the current state.
	 *
	 * This property will automatically be persisted.
	 */
	set state(value: S) {
		this.#validateStateEnabled();
		this.#persist.s = value;
	}

	get vars(): V {
		this.#validateVarsEnabled();
		invariant(this.#vars !== undefined, "vars not enabled");
		return this.#vars;
	}

	/**
	 * Broadcasts an event to all connected clients.
	 * @param name - The name of the event.
	 * @param args - The arguments to send with the event.
	 */
	_broadcast<Args extends Array<unknown>>(name: string, ...args: Args) {
		this.#assertReady();

		this.inspector.emitter.emit("eventFired", {
			type: "broadcast",
			eventName: name,
			args,
		});

		// Send to all connected clients
		const subscriptions = this.#subscriptionIndex.get(name);
		if (!subscriptions) return;

		const toClientSerializer = new CachedSerializer<wsToClient.ToClient>({
			b: {
				ev: {
					n: name,
					a: args,
				},
			},
		});

		// Send message to clients
		for (const connection of subscriptions) {
			connection._sendMessage(toClientSerializer);
		}
	}

	/**
	 * Runs a promise in the background.
	 *
	 * This allows the actor runtime to ensure that a promise completes while
	 * returning from an action request early.
	 *
	 * @param promise - The promise to run in the background.
	 */
	_runInBackground(promise: Promise<void>) {
		this.#assertReady();

		// TODO: Should we force save the state?
		// Add logging to promise and make it non-failable
		const nonfailablePromise = promise
			.then(() => {
				logger().debug("background promise complete");
			})
			.catch((error) => {
				logger().error("background promise failed", {
					error: stringifyError(error),
				});
			});
		this.#backgroundPromises.push(nonfailablePromise);
	}

	/**
	 * Forces the state to get saved.
	 *
	 * This is helpful if running a long task that may fail later or when
	 * running a background job that updates the state.
	 *
	 * @param opts - Options for saving the state.
	 */
	async saveState(opts: SaveStateOptions) {
		this.#assertReady();

		if (this.#persistChanged) {
			if (opts.immediate) {
				// Save immediately
				await this.#savePersistInner();
			} else {
				// Create callback
				if (!this.#onPersistSavedPromise) {
					this.#onPersistSavedPromise = Promise.withResolvers();
				}

				// Save state throttled
				this.#savePersistThrottled();

				// Wait for save
				await this.#onPersistSavedPromise.promise;
			}
		}
	}

	async stop() {
		if (this.isStopping) {
			logger().warn("already stopping actor");
			return;
		}
		this.isStopping = true;

		// Write state
		await this.saveState({ immediate: true });

		// Disconnect existing connections
		const promises: Promise<unknown>[] = [];
		for (const connection of this.#connections.values()) {
			promises.push(connection.disconnect());

			// TODO: Figure out how to abort HTTP requests on shutdown
		}

		// Await all `close` event listeners with 1.5 second timeout
		const res = Promise.race([
			Promise.all(promises).then(() => false),
			new Promise<boolean>((res) =>
				globalThis.setTimeout(() => res(true), 1500),
			),
		]);

		if (await res) {
			logger().warn(
				"timed out waiting for connections to close, shutting down anyway",
			);
		}

		// TODO:
		//Deno.exit(0);
	}
}
