import { UpgradeWebSocket } from "hono/ws";

export interface LoadOutput {
	actor: {
		id: string;
		tags: Record<string, string>;
		createdAt: Date;
	};
	region: string;
}

export interface ActorDriver {
	upgradeWebSocket: UpgradeWebSocket<WebSocket>,
	//load(): Promise<LoadOutput>;

	// HACK: Clean these up
	kvPut(key: any, value: any): Promise<void>;
	kvGetBatch(key: any[]): Promise<[any, any][]>;
	kvPutBatch(key: [any, any][]): Promise<void>;

	// TODO:
	//destroy(): Promise<void>;
	//readState(): void;
}
