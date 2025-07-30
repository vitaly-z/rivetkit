import { z } from "zod";

const ActionRequestSchema = z.object({
	// ID
	i: z.number().int(),
	// Name
	n: z.string(),
	// Args
	a: z.array(z.unknown()),
});

const SubscriptionRequestSchema = z.object({
	// Event name
	e: z.string(),
	// Subscribe
	s: z.boolean(),
});

export const PingResponseSchema = z.object({
	// Ping
	p: z.string(),
});

export const ToServerSchema = z.object({
	// Body
	b: z.union([
		z.object({ ar: ActionRequestSchema }),
		z.object({ sr: SubscriptionRequestSchema }),
		PingResponseSchema,
	]),
});

export type ToServer = z.infer<typeof ToServerSchema>;
export type ActionRequest = z.infer<typeof ActionRequestSchema>;
export type SubscriptionRequest = z.infer<typeof SubscriptionRequestSchema>;
