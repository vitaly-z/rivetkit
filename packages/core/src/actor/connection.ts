import type * as messageToClient from "@/actor/protocol/message/to-client";
import type * as wsToClient from "@/actor/protocol/message/to-client";
import type { AnyDatabaseProvider } from "./database";
import { type ConnDriver, ConnectionReadyState } from "./driver";
import * as errors from "./errors";
import type { ActorInstance } from "./instance";
import { logger } from "./log";
import type { PersistedConn } from "./persisted";
import { CachedSerializer } from "./protocol/serde";
import { generateSecureToken } from "./utils";

export function generateConnId(): string {
	return crypto.randomUUID();
}

export function generateConnToken(): string {
	return generateSecureToken(32);
}

export type ConnId = string;

export type AnyConn = Conn<any, any, any, any, any, any, any>;

export const CONNECTION_DRIVER_WEBSOCKET = "webSocket";
export const CONNECTION_DRIVER_SSE = "sse";
export const CONNECTION_DRIVER_HTTP = "http";

export type ConnectionDriver =
	| typeof CONNECTION_DRIVER_WEBSOCKET
	| typeof CONNECTION_DRIVER_SSE
	| typeof CONNECTION_DRIVER_HTTP;

export type ConnectionStatus = "connected" | "reconnecting";

export const CONNECTION_CHECK_LIVENESS_SYMBOL = Symbol("checkLiveness");

/**
 * Represents a client connection to a actor.
 *
 * Manages connection-specific data and controls the connection lifecycle.
 *
 * @see {@link https://rivet.gg/docs/connections|Connection Documentation}
 */
export class Conn<S, CP, CS, V, I, AD, DB extends AnyDatabaseProvider> {
	subscriptions: Set<string> = new Set<string>();

	#stateEnabled: boolean;

	// TODO: Remove this cyclical reference
	#actor: ActorInstance<S, CP, CS, V, I, AD, DB>;

	#status: ConnectionStatus = "connected";

	/**
	 * The proxied state that notifies of changes automatically.
	 *
	 * Any data that should be stored indefinitely should be held within this object.
	 */
	__persist: PersistedConn<CP, CS>;

	/**
	 * Driver used to manage realtime connection communication.
	 *
	 * @protected
	 */
	#driver: ConnDriver;

	public get params(): CP {
		return this.__persist.p;
	}

	public get auth(): AD {
		return this.__persist.a as AD;
	}

	public get driver(): ConnectionDriver {
		return this.__persist.d as ConnectionDriver;
	}

	public get _stateEnabled() {
		return this.#stateEnabled;
	}

	/**
	 * Gets the current state of the connection.
	 *
	 * Throws an error if the state is not enabled.
	 */
	public get state(): CS {
		this.#validateStateEnabled();
		if (!this.__persist.s) throw new Error("state should exists");
		return this.__persist.s;
	}

	/**
	 * Sets the state of the connection.
	 *
	 * Throws an error if the state is not enabled.
	 */
	public set state(value: CS) {
		this.#validateStateEnabled();
		this.__persist.s = value;
	}

	/**
	 * Unique identifier for the connection.
	 */
	public get id(): ConnId {
		return this.__persist.i;
	}

	/**
	 * Token used to authenticate this request.
	 */
	public get _token(): string {
		return this.__persist.t;
	}

	/**
	 * Status of the connection.
	 */
	public get status(): ConnectionStatus {
		return this.#status;
	}

	/**
	 * Timestamp of the last time the connection was seen, i.e. the last time the connection was active and checked for liveness.
	 */
	public get lastSeen(): number {
		return this.__persist.l;
	}

	/**
	 * Initializes a new instance of the Connection class.
	 *
	 * This should only be constructed by {@link Actor}.
	 *
	 * @protected
	 */
	public constructor(
		actor: ActorInstance<S, CP, CS, V, I, AD, DB>,
		persist: PersistedConn<CP, CS>,
		driver: ConnDriver,
		stateEnabled: boolean,
	) {
		this.#actor = actor;
		this.__persist = persist;
		this.#driver = driver;
		this.#stateEnabled = stateEnabled;
	}

	#validateStateEnabled() {
		if (!this.#stateEnabled) {
			throw new errors.ConnStateNotEnabled();
		}
	}

	/**
	 * Sends a WebSocket message to the client.
	 *
	 * @param message - The message to send.
	 *
	 * @protected
	 */
	public _sendMessage(message: CachedSerializer<messageToClient.ToClient>) {
		this.#driver.sendMessage?.(this.#actor, this, this.__persist.ds, message);
	}

	/**
	 * Sends an event with arguments to the client.
	 *
	 * @param eventName - The name of the event.
	 * @param args - The arguments for the event.
	 * @see {@link https://rivet.gg/docs/events|Events Documentation}
	 */
	public send(eventName: string, ...args: unknown[]) {
		this.#actor.inspector.emitter.emit("eventFired", {
			type: "event",
			eventName,
			args,
			connId: this.id,
		});
		this._sendMessage(
			new CachedSerializer<wsToClient.ToClient>({
				b: {
					ev: {
						n: eventName,
						a: args,
					},
				},
			}),
		);
	}

	/**
	 * Disconnects the client with an optional reason.
	 *
	 * @param reason - The reason for disconnection.
	 */
	public async disconnect(reason?: string) {
		this.#status = "reconnecting";
		await this.#driver.disconnect(this.#actor, this, this.__persist.ds, reason);
	}

	/**
	 * This method checks the connection's liveness by querying the driver for its ready state.
	 * If the connection is not closed, it updates the last liveness timestamp and returns `true`.
	 * Otherwise, it returns `false`.
	 * @internal
	 */
	[CONNECTION_CHECK_LIVENESS_SYMBOL]() {
		const readyState = this.#driver.getConnectionReadyState?.(
			this.#actor,
			this,
		);

		const isConnectionClosed =
			readyState === ConnectionReadyState.CLOSED ||
			readyState === ConnectionReadyState.CLOSING ||
			readyState === undefined;

		const newLastSeen = Date.now();
		const newStatus = isConnectionClosed ? "reconnecting" : "connected";

		logger().debug("liveness probe for connection", {
			connId: this.id,
			actorId: this.#actor.id,
			readyState,

			status: this.#status,
			newStatus,

			lastSeen: this.__persist.l,
			currentTs: newLastSeen,
		});

		if (!isConnectionClosed) {
			this.__persist.l = newLastSeen;
		}

		this.#status = newStatus;
		return {
			status: this.#status,
			lastSeen: this.__persist.l,
		};
	}
}
