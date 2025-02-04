import type { UpgradeWebSocket } from "hono/ws";

export interface LoadOutput {
	actor: {
		id: string;
		tags: Record<string, string>;
		createdAt: Date;
	};
	region: string;
}

export interface ActorDriver {
	upgradeWebSocket: UpgradeWebSocket<WebSocket>;
	//load(): Promise<LoadOutput>;

	// HACK: Clean these up
	kvGet(key: any): Promise<any>;
	kvGetBatch(key: any[]): Promise<[any, any][]>;
	kvPut(key: any, value: any): Promise<void>;
	kvPutBatch(key: [any, any][]): Promise<void>;
	kvDelete(key: any): Promise<void>;
	kvDeleteBatch(key: any[]): Promise<void>;

	// Schedule
	setAlarm(timestamp: number): Promise<void>;

	// TODO:
	//destroy(): Promise<void>;
	//readState(): void;
}
