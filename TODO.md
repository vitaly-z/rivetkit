# Todo

## Primary

- Write script to template out projects for different platforms
- Implement basic RPC & events test with multiple drivers
- Implement Rivet compat
    - Figure out how to inject inspector in to Rivet Actor (maybe add middleware that's opt-in?)
    - Figure out how to use Rivet-native types? (is it a Rivet actor subclass?)
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
    - Remove hardcoded localhost
    - Search for TODO
- Add create-actor package

---

- Add README for NPM
- Publish to JSR
- Release please

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

