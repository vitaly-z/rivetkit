import { z } from "zod";

export const GameGuardRoutingSchema = z.any();
export type GameGuardRouting = z.infer<typeof GameGuardRoutingSchema>;

export const HostRoutingSchema = z.any();
export type HostRouting = z.infer<typeof HostRoutingSchema>;

export const NetworkModeSchema = z.enum(["bridge", "host"]);
export type NetworkMode = z.infer<typeof NetworkModeSchema>;

export const PortProtocolSchema = z.enum([
	"http",
	"https",
	"tcp",
	"tcp_tls",
	"udp",
]);
export type PortProtocol = z.infer<typeof PortProtocolSchema>;

export const PortRoutingSchema = z.object({
	game_guard: GameGuardRoutingSchema.optional(),
	host: HostRoutingSchema.optional(),
});
export type PortRouting = z.infer<typeof PortRoutingSchema>;

export const PortSchema = z.object({
	protocol: PortProtocolSchema,
	internal_port: z.number().optional(),
	public_hostname: z.string().optional(),
	public_port: z.number().optional(),
	routing: PortRoutingSchema,
});
export type Port = z.infer<typeof PortSchema>;

export const NetworkSchema = z.object({
	mode: NetworkModeSchema.optional(),
	ports: z.record(z.string(), PortSchema),
});
export type Network = z.infer<typeof NetworkSchema>;

export const ResourcesSchema = z.object({
	cpu: z.number(),
	memory: z.number(),
});
export type Resources = z.infer<typeof ResourcesSchema>;

export const RuntimeSchema = z.object({
	build: z.string(),
	arguments: z.array(z.string()).optional(),
	environment: z.record(z.string(), z.string()).optional(),
});
export type Runtime = z.infer<typeof RuntimeSchema>;

export const LifecycleSchema = z.object({
	kill_timeout: z.number().optional(),
});
export type Lifecycle = z.infer<typeof LifecycleSchema>;

export const ServerSchema = z.object({
	id: z.string(),
	environment: z.string(),
	datacenter: z.string(),
	tags: z.unknown().optional(),
	runtime: RuntimeSchema,
	network: NetworkSchema,
	resources: ResourcesSchema,
	lifecycle: LifecycleSchema,
	created_at: z.number(),
	started_at: z.number().optional(),
	destroyed_at: z.number().optional(),
});
export type Server = z.infer<typeof ServerSchema>;

export const BuildKindSchema = z.enum(["docker_image", "oci_bundle"]);
export type BuildKind = z.infer<typeof BuildKindSchema>;

export const BuildCompressionSchema = z.enum(["none", "lz4"]);
export type BuildCompression = z.infer<typeof BuildCompressionSchema>;

export const BuildSchema = z.object({
	id: z.string(),
	name: z.string(),
	created_at: z.string(),
	content_length: z.number(),
	tags: z.record(z.string(), z.string()),
});
export type Build = z.infer<typeof BuildSchema>;

export const DatacenterSchema = z.object({
	id: z.string(),
	slug: z.string(),
	name: z.string(),
});
export type Datacenter = z.infer<typeof DatacenterSchema>;
