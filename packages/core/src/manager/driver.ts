import type { Env, Hono, Context as HonoContext } from "hono";
import type { ActorKey } from "@/actor/mod";
import type { UniversalWebSocket } from "@/common/websocket-interface";
import type { RegistryConfig } from "@/registry/config";
import type { UpgradeWebSocket } from "@/utils";

export interface ManagerDriver {
	// Actor management methods
	getForId(input: GetForIdInput): Promise<ActorOutput | undefined>;
	getWithKey(input: GetWithKeyInput): Promise<ActorOutput | undefined>;
	getOrCreateWithKey(input: GetOrCreateWithKeyInput): Promise<ActorOutput>;
	createActor(input: CreateInput): Promise<ActorOutput>;

	// New routing methods (from ConnRoutingHandlerCustom)
	sendRequest(actorId: string, request: Request): Promise<Response>;
	openWebSocket(actorId: string, request: Request): Promise<UniversalWebSocket>;
	proxyRequest(actorId: string, request: Request): Promise<Response>;
	proxyWebSocket(
		actorId: string,
		request: Request,
		socket: UniversalWebSocket,
	): Promise<void>;

	modifyManagerRouter?: (registryConfig: RegistryConfig, router: Hono) => void;

	// inspector?: ManagerInspector;
}
export interface GetForIdInput<E extends Env = any> {
	c?: HonoContext | undefined;
	actorId: string;
}

export interface GetWithKeyInput<E extends Env = any> {
	c?: HonoContext | undefined;
	name: string;
	key: ActorKey;
}

export interface GetOrCreateWithKeyInput<E extends Env = any> {
	c?: HonoContext | undefined;
	name: string;
	key: ActorKey;
	input?: unknown;
	region?: string;
}

export interface CreateInput<E extends Env = any> {
	c?: HonoContext | undefined;
	name: string;
	key: ActorKey;
	input?: unknown;
	region?: string;
}

export interface ActorOutput {
	actorId: string;
	name: string;
	key: ActorKey;
}
