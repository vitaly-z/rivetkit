import { Actor } from "actor-core";

export interface State {
	count: number;
}

export default class Counter extends Actor<State> {
	_onInitialize() {
		return { count: 0 };
	}

	increment() {
		this._state.count += 1;
		return this._state.count;
	}
}
