import { Actor, type Rpc } from "actor-core";

export interface State {
	count: number;
}

export default class Counter extends Actor<State> {
	_onInitialize() {
		return { count: 0 };
	}

	increment(rpc: Rpc<Counter>, x: number) {
		this._state.count += x;
		this._broadcast("newCount", this._state.count);
		return this._state.count;
	}
}
