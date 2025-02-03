# Todo

## Primary

- Figure out how to expose ctx
    - This needs to be an actor type and part of the driver
- Remove extending tsconfig
- Revisit actor map concept
- Implement Rivet compat
    - Fix current tag
    - Impl actor scaffold
    - Impl manager
    - Get this working e2e
    - Impl remaining TODO that was commented out
    - Impl actor inspector & hooks
    - Figure out how to get Rivet using Rivet-native types
    - Re-implement /rivet/config & region (abstract this away to a broader recommended region)
    - Fix thrown error for Rivet request to encode message correctly
    - Steps to create: deploy, create manager, paste manager endpoint in to client
- Finish CF
    - Remove hardcoded localhost
- Write Cloudflare guide
- Write Rivet guide
- Validate KV is in a backwards-compatible format
- Visit cleaner actor type

### Do this later:

- Finish CF
    - Remove path remapping
    - Handle actor ID not found
    - Handle actor tags
    - Handle actor shutdown
    - Search for TODO
- Add create-actor package

---

- Add README for NPM
- Publish to JSR
- Release please

## Internals to document

- High level architecutre of manager vs actor
- Difference between Rivet & Cloudflare & Vercel/Postgres architectures
- Lifecycle for each (how it runs, etc)
- Limitations of each platform

## Website

- Highlight use cases
- OG image for GitHub
- tsdoc
- Limitations chart
- Add react docs
- Copy over concepts
- Publish to JSR?

## Distribution

- Vercel partners
- Supabase partners
- Ask for help on simpler Cloudflare adapter

---

## Secondary

- Impl run in background to call waitUntil
- Add snapshotting to use waitUntil
- Figure out how to destroy actors
- Implement _shutdown
- Inspect bundle size

## Platforms

- Cloudflare DO
- Supabase
- Vercel
- Rivet

Later:

- Web Containers
- NodeJS
- Deno Deploy


## Rivet compat

- Add 404 & cors to router
- Update paths
- Add back shutdown

---

## Site layout

Copy Hono

Or copy the Resend API https://resend.com/docs/introduction

- Docs
    - Getting started
    - Overview (mirrored from Rivet?)
- Components

## Future Ideas

- Web containers
- Service worker: https://hono.dev/docs/getting-started/service-worker

## Similar libraries

- Next forge
- hono
- itty-router
- elysa.js

## Later

- StackBlitz demo

---

## Extension problem

Key goals:

- Retain inspector endpoint as part of rivet
- Make actor class a standard thing that doesn't take any extra work to deploy to Rivet
- Be able to expose Rivet APIs directly in Rivet actor class (it can be a subclass ig but still conform)

Secondary goals:

- Keep everything within the library itself

Options:

- Notify inspector events in the driver
- Add a extra generic parameter for the extra cloud-specific data

Approach:

- @rivet-gg/actor is a subclass of @actor-core/actor, but they're both treated the same way
- 

Future requirements:

- Connectors

Other ideas:

- Dynamically import global scope on the start to inject global shit (but this is not composable)
- Add a global thing like ts-node that will configure the global Actor.start method or something

Future thoughts:

- Standardize the SQLite & KV API to be able to work across platforms (so we don't need a Rivet-specific API)
- Expose

```
// import { Actor } from "@rivet-gg/actor";
import { Actor } from "actor-core";

class Counter extends Actor {

}


export {
    start(ctx: ActorContext) {
        const actor = new Counter();
        const router = actor.__router;
        actor.__start({
            onRpc() {
                // do something with inspector
            },
            onShutdown() {
                Deno.exit()
            }
        })
        router.get("__inspector/connect", ...etc...);
        router.any("*", /* not found */);

        const server = Deno.serve(router.fetch);
        await server.finished;
    }
}
```

Ideal API:


```
// Magic injection (this might be part of the CLI build pipeline instead of Rivet)
// This gets auto-installed or something
import { __inject } from "@actor-core/rivet";
import { Actor } from "actor-core";
__inject(Actor);  // Implements Actor.start with the code above

// User code
import { Actor } from "actor-core";

export default class Counter extends Actor {
    
}
```

---

What if we switched up the config: if we had a global config.ts instead of building individual bundles

- This is not good because we _want_ individual bundles

Remaining questions:

- How/when is the manager deployed?
    - Ideally keep this as-is


---

## Roadmap

- Schedule
- Shutdown lifecycle hooks
- KV API
- SQLite API

