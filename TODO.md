# Todo

## Platforms

- Cloudflare DO
- Supabase
- Vercel
- Rivet

## Primary

- Expose manager HTTP API
- Get manager creating actors
- Expose proxy to actors from manager
- Handle actor ID not found (respond from the actor itself)
    - Or will this error when getting the stub?

## Secondary

- Impl run in background to call waitUntil
- Add snapshotting to use waitUntil
- Figure out how to destroy actors
- Implement _shutdown

## Rivet compat

- Add 404 & cors to router
- Update paths
- Add back shutdown

---

## Alternative names

- open-actor
- next-actor
- unjs? unactor?
- xactor
- portactor


## Problems

## Key notes

- We need to store the actor list in global KV
- We'll need to expose the manager API
- The client is exactly the same, it just needs to be pointed at an endpoint and give a place to open a WS connection to
- We'll pass in the equivalent of the Rivet config

## Flow

1. client -> manager: give me the actor (include compat)
2. client -> actor: connect over ws (or use http)

## Components

- Manager library
- Actor library + drivers
- Actor client
- Manager protocol
- Actor protocol

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

