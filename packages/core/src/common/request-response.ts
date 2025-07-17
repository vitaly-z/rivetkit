/**
 * Standard Request/Response interfaces for actor communication
 */

export interface ActorRequest {
	method: string;
	url: string;
	headers: Headers;
	body?:
		| ArrayBuffer
		| string
		| FormData
		| URLSearchParams
		| ReadableStream<Uint8Array>
		| null;
}

export interface ActorResponse {
	status: number;
	statusText?: string;
	headers: Headers;
	body?:
		| ArrayBuffer
		| string
		| FormData
		| URLSearchParams
		| ReadableStream<Uint8Array>
		| null;
}

export interface ActorWebSocket {
	url: string;
	readyState: number;
	send(data: string | ArrayBuffer | ArrayBufferView): void;
	close(code?: number, reason?: string): void;
	addEventListener(
		type: "message" | "open" | "close" | "error",
		listener: (event: any) => void,
	): void;
	removeEventListener(
		type: "message" | "open" | "close" | "error",
		listener: (event: any) => void,
	): void;
}
