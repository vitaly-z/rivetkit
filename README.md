<p align="center">
  <a href="https://actorcore.org">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./media/icon-text-white.svg" alt="ActorCore" width="400">
      <img src="./media/icon-text-white.svg" alt="ActorCore" width="400">
    </picture>
  </a>
</p>

<h3 align="center">The Stateful Serverless Framework</h3>
<h4 align="center">
  Build AI agents, realtime apps, game servers, and more.<br/>
  Supports Cloudflare Workers, Rivet, Supabase, and Vercel.
</h4>
<p align="center">
  <!-- <a href="https://github.com/rivet-gg/rivet/graphs/commit-activity"><img alt="GitHub commit activity" src="https://img.shields.io/github/commit-activity/m/rivet-gg/rivet?style=flat-square"/></a> -->
  <a href="https://github.com/orgs/rivet-gg/discussions"><img alt="GitHub Discussions" src="https://img.shields.io/github/discussions/rivet-gg/rivet?logo=github&logoColor=fff"></a>
    <a href="https://rivet.gg/discord"><img alt="Discord" src="https://img.shields.io/discord/822914074136018994?color=7389D8&label&logo=discord&logoColor=ffffff"/></a>
   <a href="https://twitter.com/rivet_gg"><img src="https://img.shields.io/twitter/follow/rivet_gg" alt="Rivet Twitter" /></a>
   <a href="https://bsky.app/profile/rivet.gg"><img src="https://img.shields.io/badge/Follow%20%40rivet.gg-4C1?color=0285FF&logo=bluesky&logoColor=ffffff" alt="Rivet Bluesky" /></a>
  <a href="/LICENSE"><img alt="License Apache-2.0" src="https://img.shields.io/github/license/rivet-gg/rivet?logo=open-source-initiative&logoColor=white"></a>
</p>

![Code snippets](./media/code.png)

## Intro

### Features

- 🔋 **Batteries Included**: State, RPC, events, & scheduling included out of the box.
- 💾 **Persistent & In-Memory**: Supports storing actor state in-memory that's automatically persisted for high-performance workloads.
- ⚡ **Multiplayer & Realtime**: Build realtime or multiplayer applications on top of actors. :floppy_disk:
- ⚙️ **Serverless & Scalable**: Built on your serverless runtime of choice to make deploying, scaling, and cost management easy. :microchip:

### Supported Platforms

- [**Cloudflare Workers**](https://actorcore.dev/platforms/cloudflare-workers) - Using Durable Objects
- [**Rivet**](https://actorcore.dev/platforms/rivet) - Managed ActorCore platform
- [**Supabase Edge Functions**](https://actorcore.dev/platforms/supabase) - Serverless platform
- [**Vercel**](https://actorcore.dev/platforms/vercel) - Serverless platform

### Use Cases

ActorCore is ideal for applications that need coordinated state across multiple clients. Some common use cases include:

- AI agents
- Game Servers
- Collaborative applications
- Local-first apps
- Discord Activities
- Chat Apps
- Yjs Sync & Storage
- Sandboxed Code Execution

By handling the complexities of state management and coordination, ActorCore lets you focus on building your application logic rather than wrestling with distributed systems primitives.

## Getting Started

### Step 1: Installation

```bash npm
# npm
npm install actor-core

# pnpm
pnpm install actor-core

# Yarn
yarn add actor-core

# Bun
bun install actor-core
```

### Step 2: Create an Actor

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

### Step 3: Connect to Actor

```typescript
const client = new Client("http://localhost:8787");

const counter = await client.get<Counter>({ name: "counter" });

counter.on("countUpdate", (count: number) => console.log("New count:", count));

const count1 = await counter.increment(1);
console.log(count1);
const count2 = await counter.increment(2);
console.log(count2);
```

## Community & Support

-   Join our [**Discord**](https://rivet.gg/discord)
-   Follow us on [**X**](https://x.com/rivet_gg)
-   Follow us on [**Bluesky**](https://bsky.app/profile/rivet-gg.bsky.social)
- File bug reports in [**GitHub Issues**](https://github.com/rivet-gg/ActorCore/issues)
- Post questions & ideas in [**GitHub Discussions**](https://github.com/orgs/rivet-gg/discussions)

## License

Apache 2.0
