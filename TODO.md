# Todo

## Alternative names

- open-actor
- next-actor
- unjs? unactor?
- xactor
- portactor

## Todo

- Expose manager HTTP API
- Get manager creating actors
- Expose proxy to actors from manager

## Questions

### How do we handle the manager <-> connection? Is this a standard HTTP interface?

Is this a standard RTT like the Rivet manager? If so, this makes it easy in CF workers bc it lets us just expose it directly.

## Key notes

- We need to store the actor list in global KV
- We'll need to expose the manager API
- The client is exactly the same, it just needs to be pointed at an endpoint and give a place to open a WS connection to

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

