import type { Conn } from "./connection";
import type { ActionContext } from "./action";
import type { ActorContext } from "./context";
import { z } from "zod";

// This schema is used to validate the input at runtime. The generic types are defined below in `ActorConfig`.
//
// We don't use Zod generics with `z.custom` because:
// (a) there seems to be a weird bug in either Zod, tsup, or TSC that causese external packages to have different types from `z.infer` than from within the same package and
// (b) it makes the type definitions incredibly difficult to read as opposed to vanilla TypeScript.
export const ActorConfigSchema = z
	.object({
		onCreate: z.function().optional(),
		onStart: z.function().optional(),
		onStateChange: z.function().optional(),
		onBeforeConnect: z.function().optional(),
		onConnect: z.function().optional(),
		onDisconnect: z.function().optional(),
		onBeforeActionResponse: z.function().optional(),
		// Actions<S, CP, CS>
		actions: z.record(z.function()),
		options: z
			.object({
				state: z
					.object({
						saveInterval: z.number().positive().default(10_000),
					})
					.strict()
					.default({}),
				action: z
					.object({
						timeout: z.number().positive().default(60_000),
					})
					.strict()
					.default({}),
			})
			.strict()
			.default({}),
	})
	.strict()
	.and(
		// CreateState<S, CP, CS>
		z.union([
			z.object({ state: z.any() }).strict(),
			z.object({ createState: z.function() }).strict(),
			z.object({}).strict(),
		]),
	)
	.and(
		// CreateConnState<S, CP, CS>
		z.union([
			z.object({ connState: z.any() }).strict(),
			z.object({ createConnState: z.function() }).strict(),
			z.object({}).strict(),
		]),
	);

export interface OnConnectOptions<CP> {
	/**
	 * The request object associated with the connection.
	 *
	 * @experimental
	 */
	request?: Request;
	params: CP;
}

// Creates state config
//
// This must have only one or the other or else S will not be able to be inferred
type CreateState<S, CP, CS> =
	| { state: S }
	| { createState: (c: ActorContext<undefined, CP, CS>) => S | Promise<S> }
	| Record<never, never>;

// Creates connection state config
//
// This must have only one or the other or else S will not be able to be inferred
type CreateConnState<S, CP, CS> =
	| { connState: CS }
	| {
			createConnState: (
				c: ActorContext<S, CP, CS>,
				opts: OnConnectOptions<CP>,
			) => CS | Promise<CS>;
	  }
	| Record<never, never>;

export interface Actions<S, CP, CS> {
	[Action: string]: (c: ActionContext<S, CP, CS>, ...args: any[]) => any;
}

//export type ActorConfig<S, CP, CS> = BaseActorConfig<S, CP, CS> &
//	ActorConfigLifecycle<S, CP, CS> &
//	CreateState<S, CP, CS> &
//	CreateConnState<S, CP, CS>;

interface BaseActorConfig<S, CP, CS, R extends Actions<S, CP, CS>> {
	/**
	 * Called when the actor is first initialized.
	 *
	 * Use this hook to initialize your actor's state.
	 * This is called before any other lifecycle hooks.
	 */
	onCreate?: (c: ActorContext<S, CP, CS>) => void | Promise<void>;

	/**
	 * Called when the actor is started and ready to receive connections and action.
	 *
	 * Use this hook to initialize resources needed for the actor's operation
	 * (timers, external connections, etc.)
	 *
	 * @returns Void or a Promise that resolves when startup is complete
	 */
	onStart?: (c: ActorContext<S, CP, CS>) => void | Promise<void>;

	/**
	 * Called when the actor's state changes.
	 *
	 * Use this hook to react to state changes, such as updating
	 * external systems or triggering events.
	 *
	 * @param newState The updated state
	 */
	onStateChange?: (c: ActorContext<S, CP, CS>, newState: S) => void;

	/**
	 * Called before a client connects to the actor.
	 *
	 * Use this hook to determine if a connection should be accepted
	 * and to initialize connection-specific state.
	 *
	 * @param opts Connection parameters including client-provided data
	 * @returns The initial connection state or a Promise that resolves to it
	 * @throws Throw an error to reject the connection
	 */
	onBeforeConnect?: (
		c: ActorContext<S, CP, CS>,
		opts: OnConnectOptions<CP>,
	) => void | Promise<void>;

	/**
	 * Called when a client successfully connects to the actor.
	 *
	 * Use this hook to perform actions when a connection is established,
	 * such as sending initial data or updating the actor's state.
	 *
	 * @param conn The connection object
	 * @returns Void or a Promise that resolves when connection handling is complete
	 */
	onConnect?: (
		c: ActorContext<S, CP, CS>,
		conn: Conn<S, CP, CS>,
	) => void | Promise<void>;

	/**
	 * Called when a client disconnects from the actor.
	 *
	 * Use this hook to clean up resources associated with the connection
	 * or update the actor's state.
	 *
	 * @param conn The connection that is being closed
	 * @returns Void or a Promise that resolves when disconnect handling is complete
	 */
	onDisconnect?: (
		c: ActorContext<S, CP, CS>,
		conn: Conn<S, CP, CS>,
	) => void | Promise<void>;

	/**
	 * Called before sending an action response to the client.
	 *
	 * Use this hook to modify or transform the output of an action before it's sent
	 * to the client. This is useful for formatting responses, adding metadata,
	 * or applying transformations to the output.
	 *
	 * @param name The name of the action that was called
	 * @param args The arguments that were passed to the action
	 * @param output The output that will be sent to the client
	 * @returns The modified output to send to the client
	 */
	onBeforeActionResponse?: <Out>(
		c: ActorContext<S, CP, CS>,
		name: string,
		args: unknown[],
		output: Out,
	) => Out | Promise<Out>;

	actions: R;
}

// 1. Infer schema
// 2. Omit keys that we'll manually define (because of generics)
// 3. Define our own types that have generic constraints
export type ActorConfig<S, CP, CS> = Omit<
	z.infer<typeof ActorConfigSchema>,
	| keyof BaseActorConfig<S, CP, CS, Actions<S, CP, CS>>
	| keyof CreateState<S, CP, CS>
	| keyof CreateConnState<S, CP, CS>
> &
	BaseActorConfig<S, CP, CS, Actions<S, CP, CS>> &
	CreateState<S, CP, CS> &
	CreateConnState<S, CP, CS>;

// See description on `ActorConfig`
export type ActorConfigInput<S, CP, CS, R extends Actions<S, CP, CS>> = Omit<
	z.input<typeof ActorConfigSchema>,
	| keyof BaseActorConfig<S, CP, CS, R>
	| keyof CreateState<S, CP, CS>
	| keyof CreateConnState<S, CP, CS>
> &
	BaseActorConfig<S, CP, CS, R> &
	CreateState<S, CP, CS> &
	CreateConnState<S, CP, CS>;

// For testing type definitions:
export function test<S, CP, CS, R extends Actions<S, CP, CS>>(
	input: ActorConfigInput<S, CP, CS, R>,
): ActorConfig<S, CP, CS> {
	const config = ActorConfigSchema.parse(input) as ActorConfig<S, CP, CS>;
	return config;
}

export const testActor = test({
	state: { count: 0 },
	// createState: () => ({ count: 0 }),
	actions: {
		increment: (c, x: number) => {
			c.state.count += x;
			c.broadcast("newCount", c.state.count);
			return c.state.count;
		},
	},
});
