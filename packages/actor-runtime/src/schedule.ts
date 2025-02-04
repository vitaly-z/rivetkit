import type { AnyActor } from "./actor";
import type { ActorDriver } from "./driver";
import { KEYS } from "./keys";
import { logger } from "./log";

interface ScheduleState {
	// Sorted by timestamp asc
	events: ScheduleIndexEvent[];
}

interface ScheduleIndexEvent {
	timestamp: number;
	eventId: string;
}

interface ScheduleEvent {
	timestamp: number;
	fn: string;
	args: unknown[];
}

export class Schedule {
	#actor: AnyActor;
	#driver: ActorDriver;

	constructor(actor: AnyActor, driver: ActorDriver) {
		this.#actor = actor;
		this.#driver = driver;
	}

	async after(duration: number, fn: string, ...args: unknown[]) {
		this.#scheduleEvent(Date.now() + duration, fn, args);
	}

	async at(timestamp: number, fn: string, ...args: unknown[]) {
		this.#scheduleEvent(timestamp, fn, args);
	}

	async #scheduleEvent(
		timestamp: number,
		fn: string,
		args: unknown[],
	): Promise<void> {
		// Save event
		const eventId = crypto.randomUUID();
		await this.#driver.kvPutBatch([
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			KEYS.SCHEDULE.event(eventId) as any,
			{
				timestamp,
				fn,
				args,
			},
		]);

		// TODO: Clean this up to use list instead of get
		// Read index
		const schedule: ScheduleState = (await this.#driver.kvGet(
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			KEYS.SCHEDULE.SCHEDULE as any,
		)) ?? {
			events: [],
		};

		// Insert event in to index
		const newEvent: ScheduleIndexEvent = { timestamp, eventId };
		const insertIndex = schedule.events.findIndex(
			(x) => x.timestamp > newEvent.timestamp,
		);
		if (insertIndex === -1) {
			schedule.events.push(newEvent);
		} else {
			schedule.events.splice(insertIndex, 0, newEvent);
		}

		// Write new index
		await this.#driver.kvPutBatch([KEYS.SCHEDULE.SCHEDULE as any, schedule]);

		// Update alarm if:
		// - this is the newest event (i.e. at beginning of array) or
		// - this is the only event (i.e. the only event in the array)
		if (insertIndex === 0 || schedule.events.length === 1) {
			await this.#driver.setAlarm(newEvent.timestamp);
		}
	}

	async __onAlarm() {
		const now = Date.now();

		// Read index
		const scheduleIndex: ScheduleState = (await this.#driver.kvGet(
			KEYS.SCHEDULE.SCHEDULE,
		)) ?? { events: [] };

		// Remove events from schedule
		const runIndex = scheduleIndex.events.findIndex((x) => x.timestamp < now);
		const scheduleIndexEvents = scheduleIndex.events.splice(0, runIndex + 1);

		// Find events to trigger
		const eventKeys = scheduleIndexEvents.map((x) =>
			KEYS.SCHEDULE.event(x.eventId),
		);
		const scheduleEvents = (await this.#driver.kvGetBatch(eventKeys)) as [
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			any,
			ScheduleEvent,
		][];
		await this.#driver.kvDeleteBatch(eventKeys);

		// Write new schedule
		await this.#driver.kvPut(KEYS.SCHEDULE.SCHEDULE, scheduleIndex);

		// Set alarm for next event
		if (scheduleIndex.events.length > 0) {
			// biome-ignore lint/style/noNonNullAssertion: <explanation>
			await this.#driver.setAlarm(scheduleIndex.events[0]!.timestamp);
		}

		// Iterate by event key in order to ensure we call the events in order
		for (const [_eventKey, event] of scheduleEvents) {
			try {
				// Look up function
				const fn: unknown = this.#actor[event.fn as keyof AnyActor];
				if (!fn) throw new Error(`Missing function for alarm ${event.fn}`);
				if (typeof fn !== "function")
					throw new Error(
						`Alarm function lookup for ${event.fn} returned ${typeof fn}`,
					);

				// Call function
				const res = await fn(...event.args);

				// Write error if needed
				if ("error" in res.result) {
					await this.#driver.kvPut(KEYS.SCHEDULE.alarmError(event.fn), {
						error: res.result.error,
						logs: res.logs,
						timestamp: now,
					});
				}
			} catch (err) {
				logger().error("failed to run scheduled event", {
					fn: event.fn,
					error: `${err}`,
				});

				// Write internal error
				await this.#driver.kvPut(KEYS.SCHEDULE.alarmError(event.fn), {
					error: `${err}`,
					timestamp: now,
				});
			}
		}
	}
}
