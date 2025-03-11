import { z } from "zod";
import type { RegionSchema } from "../../region";
import * as rivetTypes from "../../rivet/types";

// MARK: Config
export const BackendServerConfigPortSchema = z.object({
	protocol: rivetTypes.PortProtocolSchema,
	internalPort: z.number().optional(),
	routing: rivetTypes.PortRoutingSchema.optional(),
});
export type BackendServerConfigPort = z.infer<
	typeof BackendServerConfigPortSchema
>;

export const BackendServerConfigSchema = z.object({
	resources: rivetTypes.ResourcesSchema,
	arguments: z.array(z.string()).optional(),
	environment: z.record(z.string(), z.string()).optional(),
	networkMode: rivetTypes.NetworkModeSchema.optional(),
	ports: z.record(z.string(), BackendServerConfigPortSchema),
});
export type BackendServerConfig = z.infer<typeof BackendServerConfigSchema>;

// MARK: Response
export const LobbyBackendServerPortResponseSchema = z.object({
	protocol: rivetTypes.PortProtocolSchema,
	internalPort: z.number().optional(),
	publicHostname: z.string().optional(),
	publicPort: z.number().optional(),
	routing: rivetTypes.PortRoutingSchema,
});
export type LobbyBackendServerPortResponse = z.infer<
	typeof LobbyBackendServerPortResponseSchema
>;

export const LobbyBackendServerResponseSchema = z.object({
	serverId: z.string(),
	ports: z.record(z.string(), LobbyBackendServerPortResponseSchema).optional(),
});
export type LobbyBackendServerResponse = z.infer<
	typeof LobbyBackendServerResponseSchema
>;

// TODO: Return dynamic regions instead of hardcoded
export const REGIONS: z.infer<typeof RegionSchema>[] = [
	{
		slug: "atl",
		name: "Atlanta",
		latitude: 33.749,
		longitude: -84.388,
	},
	{
		slug: "lax",
		name: "Los Angeles",
		latitude: 34.0522,
		longitude: -118.2437,
	},
	{
		slug: "fra",
		name: "Frankfurt",
		latitude: 50.1109,
		longitude: 8.6821,
	},
	{
		slug: "syd",
		name: "Sydney",
		latitude: -33.8688,
		longitude: 151.2093,
	},
	{
		slug: "osa",
		name: "Osaka",
		latitude: 34.6937,
		longitude: 135.5023,
	},
	{
		slug: "gru",
		name: "São Paulo",
		latitude: -23.5505,
		longitude: -46.6333,
	},
	{
		slug: "bom",
		name: "Mumbai",
		latitude: 19.076,
		longitude: 72.8777,
	},
	{
		slug: "sin",
		name: "Singapore",
		latitude: 1.3521,
		longitude: 103.8198,
	},

	{
		slug: "lnd-atl",
		name: "Atlanta",
		latitude: 33.749,
		longitude: -84.388,
	},
	{
		slug: "lnd-fra",
		name: "Frankfurt",
		latitude: 50.1109,
		longitude: 8.6821,
	},
];
