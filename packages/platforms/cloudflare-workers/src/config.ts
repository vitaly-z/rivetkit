export interface Config {
	actors: ActorRegistry;
}

export type ActorRegistry = Record<string, any>;
