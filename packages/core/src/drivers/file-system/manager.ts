import { ActorAlreadyExists } from "@/actor/errors";
import type { UniversalWebSocket } from "@/common/websocket-interface";
import type {
	ActorOutput,
	CreateInput,
	GetForIdInput,
	GetOrCreateWithKeyInput,
	GetWithKeyInput,
	ManagerDriver,
} from "@/driver-helpers/mod";
import type { FileSystemGlobalState } from "./global-state";
import { logger } from "./log";
import { generateActorId } from "./utils";

export class FileSystemManagerDriver implements ManagerDriver {
	#state: FileSystemGlobalState;

	// inspector: ManagerInspector = new ManagerInspector(this, {
	// 	getAllActors: () => this.#state.getAllActors(),
	// 	getAllTypesOfActors: () => Object.keys(this.registry.config.actors),
	// });

	constructor(state: FileSystemGlobalState) {
		this.#state = state;
	}

	async getForId({ actorId }: GetForIdInput): Promise<ActorOutput | undefined> {
		// Validate the actor exists
		if (!this.#state.hasActor(actorId)) {
			return undefined;
		}

		try {
			// Load actor state
			const state = this.#state.loadActorState(actorId);

			return {
				actorId,
				name: state.name,
				key: state.key,
			};
		} catch (error) {
			logger().error("failed to read actor state", { actorId, error });
			return undefined;
		}
	}

	async getWithKey({
		name,
		key,
	}: GetWithKeyInput): Promise<ActorOutput | undefined> {
		// Generate the deterministic actor ID
		const actorId = generateActorId(name, key);

		// Check if actor exists
		if (this.#state.hasActor(actorId)) {
			return {
				actorId,
				name,
				key,
			};
		}

		return undefined;
	}

	async getOrCreateWithKey(
		input: GetOrCreateWithKeyInput,
	): Promise<ActorOutput> {
		// First try to get the actor without locking
		const getOutput = await this.getWithKey(input);
		if (getOutput) {
			return getOutput;
		} else {
			return await this.createActor(input);
		}
	}

	async createActor({ name, key, input }: CreateInput): Promise<ActorOutput> {
		// Generate the deterministic actor ID
		const actorId = generateActorId(name, key);

		// Check if actor already exists
		if (this.#state.hasActor(actorId)) {
			throw new ActorAlreadyExists(name, key);
		}

		await this.#state.createActor(actorId, name, key, input);

		// Notify inspector about actor changes
		// this.inspector.onActorsChange(this.#state.getAllActors());

		return {
			actorId,
			name,
			key,
		};
	}

	// Routing methods - Not implemented for file system driver
	// The file system driver is designed for single-process testing/development scenarios
	// where the inline client driver communicates directly with actors through the
	// manager router. These methods are only needed for distributed deployments.

	async sendRequest(actorId: string, request: Request): Promise<Response> {
		throw new Error(
			"FileSystemManagerDriver.sendRequest is not implemented. " +
				"The file system driver is designed for single-process testing/development where " +
				"the inline client driver communicates directly with actors. " +
				"For distributed scenarios, use a different driver like Redis or Cloudflare Workers.",
		);
	}

	async openWebSocket(
		actorId: string,
		request: Request,
	): Promise<UniversalWebSocket> {
		throw new Error(
			"FileSystemManagerDriver.openWebSocket is not implemented. " +
				"The file system driver is designed for single-process testing/development where " +
				"WebSocket connections are handled directly by the platform. " +
				"For distributed scenarios, use a different driver like Redis or Cloudflare Workers.",
		);
	}

	async proxyRequest(actorId: string, request: Request): Promise<Response> {
		throw new Error(
			"FileSystemManagerDriver.proxyRequest is not implemented. " +
				"The file system driver is designed for single-process testing/development where " +
				"requests are routed directly through the manager router. " +
				"For distributed scenarios, use a different driver like Redis or Cloudflare Workers.",
		);
	}

	async proxyWebSocket(
		actorId: string,
		request: Request,
		socket: UniversalWebSocket,
	): Promise<void> {
		throw new Error(
			"FileSystemManagerDriver.proxyWebSocket is not implemented. " +
				"The file system driver is designed for single-process testing/development where " +
				"WebSocket connections are handled directly by the platform. " +
				"For distributed scenarios, use a different driver like Redis or Cloudflare Workers.",
		);
	}
}
