import { actor, ActorDefinition } from "actor-core";
import { type InputConfig, ConfigSchema } from "./config";
import { Actor, type OnBeforeConnectOptions, type Rpc } from "actor-core";
import { assertUnreachable } from "actor-core/utils";
import invariant from "invariant";
import { createNanoEvents } from "nanoevents";
import type { Config, LobbyConfig } from "./config";
import {
	type LobbyBackendResponse,
	type LobbyResponse,
	lobbyTagsMatch,
} from "./utils/lobby/mod";
import {
	acceptAnyRegion,
	acceptAnyVersion,
	canCallLobbyReadyMultipleTimes,
	canMutateLobbies,
	getLobbyConfig,
	requiresLobbyToken,
} from "./utils/lobby_config";
import * as RpcSchema from "./utils/lobby_manager/rpc";
import { parseRequest } from "./utils/lobby_manager/rpc";
import type * as State from "./utils/lobby_manager/state/mod";
import type { PlayerResponseWithToken } from "./utils/player";
import { regionsForBackend } from "./utils/region";
import {
	CannotMutateLobbiesError,
	ForbiddenError,
	LobbyAbortedError,
	LobbyAlreadyReadyError,
	LobbyCreateMissingPlayersError,
	LobbyFullError,
	LobbyNotFoundError,
	LobbyTokenInvalidError,
	LobbyTokenRequiredError,
	MorePlayersThanMaxError,
	NoMatchingLobbiesError,
	PlayerAlreadyConnectedError,
	PlayerDisconnectedError,
	PlayerTokenInvalidError,
	RegionNotFoundError,
	TooManyPlayersForIpError,
} from "./errors";
import { ActorError } from "actor-core/errors";
import { generateToken } from "./utils/token";
import type { Rivet } from "@rivet-gg/api";
import { createRivetClient } from "./utils/lobby/backend/rivet";

const OWNER_TAG = "owner";
const OWNER_TAG_VALUE = "lobby-manager";

//const VERSION_BUILD_TAG = "version";
//const ENABLED_BUILD_TAG = "enabled";
const CURRENT_BUILD_TAG = "current";

// TODO: replace this with the config
const TEMP_GAME_BUILD_TAG_VALUE = "game";

const LOCAL_LOBBY_ID = "00000000-0000-0000-0000-000000000000";

interface ConnState {
	remoteAddress?: string;
}

export function lobbyManager(inputConfig: InputConfig) {
	const config = ConfigSchema.parse(inputConfig);

	return actor<State.StateVersioned, undefined, ConnState>({
		createState: () => {
			// TODO: This doesn't handle lobbyRules correctly
			// Create default lobbies if needed
			const lobbies: Record<string, State.Lobby> = {};
			if ("localDevelopment" in config.lobbies.backend) {
				const devConfig = config.lobbies.backend.localDevelopment;
				const localLobbyId = LOCAL_LOBBY_ID;

				const ports: Record<string, State.LobbyBackendLocalDevelopmentPort> =
					{};
				for (const [portName, port] of Object.entries(devConfig.ports)) {
					ports[portName] = {
						protocol: port.protocol,
						hostname: port.hostname ?? "127.0.0.1",
						port: port.port,
					};
				}

				lobbies[localLobbyId] = {
					id: localLobbyId,
					token: generateToken("lobby"),
					version: devConfig.version ?? "default",
					region: "local",
					tags: devConfig.tags ?? {},
					createdAt: Date.now(),
					readyAt: Date.now(),
					emptyAt: Date.now(),
					players: {},
					maxPlayers: devConfig.maxPlayers ?? 32,
					maxPlayersDirect: devConfig.maxPlayersDirect ?? 32,
					backend: {
						localDevelopment: { ports },
					},
				};
			}

			return {
				version: 1,
				state: {
					lobbies,
					servers: {},
					lastGcAt: 0,
					lastServerPollAt: 0,
				},
			};
		},
		onCreate: (c) => {
			// TODO: Make this private
			c.schedule.after(config.tickInterval, "tick");
		},
		actions: {
			// TODO:
		},
	});
}
