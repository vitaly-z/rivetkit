<p align="center">
  <a href="https://actorcore.org">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./media/icon-text-white.svg" alt="ActorCore" width="400">
      <img src="./media/icon-text-white.svg" alt="ActorCore" width="400">
    </picture>
  </a>
</p>

<h3 align="center">The Stateful Serverless Framework.</h3>
<h4 align="center">
  OpenCore is the stateful serverless framework to build AI agents, realtime apps, game servers, and more.<br/>
  Supports Rivet, Cloudflare Workers,Supabase, and Vercel.
</h4>
<p align="center">
  <!-- <a href="https://github.com/rivet-gg/rivet/graphs/commit-activity"><img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/rivet-gg/rivet?style=flat-square"/></a> -->
  <a href="https://github.com/orgs/rivet-gg/discussions"><img alt="GitHub Discussions" src="https://img.shields.io/github/discussions/rivet-gg/rivet?logo=github&logoColor=fff"></a>
  <a href="/LICENSE"><img alt="License Apache-2.0" src="https://img.shields.io/github/license/rivet-gg/rivet?logo=open-source-initiative&logoColor=white"></a>
</p>

![Code snippets](./media/code.png)

## Features

-   [**State & Persistence**](https://actorcore.dev/concepts/state): State that feels like memory but works like storage. Ideal for dynamic, fast-moving apps.
-   [**Remote Procedure Calls**](https://rivet.gg/docs/rpc): Lightweight messaging built for speed. Complete client/server type safety included.
-   [**Runs Forever, Sleeps When Idle**](https://rivet.gg/docs/lifecycle): Always available, sleeps on network inactivity or timeouts, and wakes instantly on demand.
-   [**Edge Networking**](https://rivet.gg/docs/edge): Automatically distribute your applications near your users for ultra-low latency.
-   [**Fault Tolerance**](https://rivet.gg/docs/fault-tolerance): Ensure application & state resilience through crashes with zero downtime.

## Getting Started

### Installation

```bash npm
npm install actor-core
```

```bash yarn
yarn add actor-core
```

```bash pnpm
pnpm install actor-core
```

```bash bun
bun install actor-core
```

### Create an Actor

```typescript
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
```

### Connect to Actor

```typescript
const client = new Client("http://localhost:8787");

const counter = await client.get<Counter>({ name: "counter" });

counter.on("countUpdate", (count: number) =>
  console.log("New count:", count),
);

const count1 = await counter.increment(1);
console.log(count1);
const count2 = await counter.increment(2);
console.log(count2);
```

### Supported Platforms

- [**Cloudflare Workers**](https://actorcore.dev/platforms/cloudflare-workers) - Using Durable Objects
- [**Rivet**](https://actorcore.dev/platforms/rivet) - Managed ActorCore platform
- [**Supabase Edge Functions**](https://actorcore.dev/platforms/supabase) - Serverless platform
- [**Vercel**](https://actorcore.dev/platforms/vercel) - Serverless platform

## Use Cases

ActorCore is ideal for applications that need coordinated state across multiple clients. Some common use cases include:

-   AI agents
-   Game Servers
-   Collaborative applications
-   Local-first apps
-   Discord Activities
-   Chat Apps
-   Yjs Sync & Storage
-   Sandboxed Code Execution

By handling the complexities of state management and coordination, ActorCore lets you focus on building your application logic rather than wrestling with distributed systems primitives.

## Community & Support
-   File bug reports in [**GitHub Issues**](https://github.com/rivet-gg/rivet/issues)
-   Post questions & ideas in [**GitHub Discussions**](https://github.com/orgs/rivet-gg/discussions)

## License

Apache 2.0

## Project layout

```
docker/                      Docker-related files
    dev-full/                Full development environment setup
    monolith/                Monolithic Docker setup
    universal/               Universal multi-stage builder image
docs/                        Documentation
docs-internal/               Internal documentation
examples/                    Example projects
frontend/                    Rivet Hub & other frontend components
packages/                    Project packages
    api/                     API package
    common/                  Common utilities
    infra/                   Infrastructure-related code
    services/                Service implementations
    toolchain/               Toolchain-related code
resources/                   Misc resources supporting Rivet
scripts/                     Scripts for various tasks
sdks/                        SDKs
    actor/                   Actor SDK
    api/                     Low-level SDK for calling API
site/                        Website & documentation
```
