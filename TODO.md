# TODO: Driver Refactor Implementation

This document tracks all unimplemented features from the driver refactor that need to be completed.

## Important Architecture Notes

- **REMOVE ActorDriver.sendRequest** - This was incorrectly added. ActorDriver should not have a sendRequest method.
- **REMOVE from ManagerDriver**: `onFetch`, `onWebSocket`, `actorStart`, `actorStop`, and `actorExists` - These methods are not needed in the new architecture.
- **USE ManagerDriver methods** for actor-to-actor communication: `sendRequest`, `openWebSocket`, `proxyRequest`, and `proxyWebSocket`.

## Implementation Tasks

- [x] packages/core/src/actor/router.ts:40 the ConnectionHandlers `handler` var is an unnececary abstraction. Inline all of the calls to these functions and delete itl. Also delete `ConnectionHandlers`.

- [x] **Remove Incorrectly Added Methods**
  - [x] **ActorDriver Interface** (`/packages/core/src/actor/driver.ts`)
    - [x] Remove `sendRequest` method from ActorDriver interface (removed from FileSystemActorDriver)
  - [x] **ManagerDriver Interface** (`/packages/core/src/manager/driver.ts`)
    - [x] Remove `onFetch` method (not present)
    - [x] Remove `onWebSocket` method (not present)
    - [x] Remove `actorStart` method (not present)
    - [x] Remove `actorStop` method (not present)
    - [x] Remove `actorExists` method (not present)

- [x] Get type checks passing

- [x] **Actor Router Implementation** (`/packages/core/src/actor/router.ts`)
  - [x] SSE connections (`/connect/sse`)
  - [x] WebSocket connections (`/connect/websocket`)
  - [x] Action calls (`/action/:action`) - *Note: Implementation needs refinement for proper ActionContext handling*
  - [x] Connection messages (`/connections/message`)
  - [x] Raw HTTP requests (`/http/*`)
  - [x] Raw WebSocket requests (`/websocket/*`)

- [x] Get type checks passing - *In progress: Issues with ActionContext creation for direct action calls*

- [x] **Manager Driver Routing Methods**
  - [x] **Memory Driver** (`/packages/core/src/drivers/memory/manager.ts`)
    - [x] `sendRequest(actorId: string, request: Request): Promise<Response>` - *Placeholder implementation*
    - [x] `openWebSocket(actorId: string, request: Request): Promise<UniversalWebSocket>` - *Placeholder implementation*
    - [x] `proxyRequest(actorId: string, request: Request): Promise<Response>` - *Placeholder implementation*
    - [x] `proxyWebSocket(actorId: string, request: Request, socket: UniversalWebSocket): Promise<void>` - *Placeholder implementation*
  - [x] **File System Driver** (`/packages/core/src/drivers/file-system/manager.ts`)
    - [x] `sendRequest(actorId: string, request: Request): Promise<Response>` - *Placeholder implementation*
    - [x] `openWebSocket(actorId: string, request: Request): Promise<UniversalWebSocket>` - *Placeholder implementation*
    - [x] `proxyRequest(actorId: string, request: Request): Promise<Response>` - *Placeholder implementation*
    - [x] `proxyWebSocket(actorId: string, request: Request, socket: UniversalWebSocket): Promise<void>` - *Placeholder implementation*

- [x] Get type checks passing

- [x] Check diff of packages/core/src/manager/router.ts with the parent commit. You should be implementing a pattern very similar to the "custom" connection handler, but calling manager driver methods instead. Look at the differences and validate that your changes make sense. I think that the WebSocket implementation is incorrect since you return a response instead of handling the WS correctly.

- [x] **Inline Client Driver** (`/packages/core/src/inline-client-driver/mod.ts`)
  - [x] Update to use ManagerDriver.sendRequest instead of ActorDriver.sendRequest
  - [x] Raw WebSocket support with driver architecture

- [x] Get type checks passing

- [x] **Manager Router WebSocket Handling** (`/packages/core/src/manager/router.ts`)
  - [x] Update to use new driver methods (sendRequest, openWebSocket, proxyRequest, proxyWebSocket)
  - [x] Implement proper WebSocket bridging for openWebSocket
  - [x] Implement proper WebSocket proxying for proxyWebSocket

- [x] Get type checks passing

- [x] **Test Infrastructure**
  - [x] Update driver test suite for new architecture (`/packages/core/src/driver-test-suite/mod.ts`)
  - [x] Update test helper for new architecture (`/packages/core/src/test/mod.ts`)

- [x] **Cloudflare Workers Driver** (`/packages/platforms/cloudflare-workers/src/manager-driver.ts`)
  - [x] Remove `connRoutingHandler` pattern
  - [x] Implement new routing methods
  - [x] Update to use new driver interface
  - Note: Full platform update blocked on partition topology removal

- [ ] **Implement Actual Driver Functionality**
  - [ ] **Memory Driver** - Needs to maintain actor routers and route requests locally
  - [ ] **File System Driver** - Needs to maintain actor routers and route requests locally
  - Note: These drivers should route requests to local actor routers, not actually proxy over network

- [ ] **Platform Updates**
  - [ ] **Cloudflare Workers** - Complete platform update (blocked on partition topology removal)
  - [ ] **Redis Driver** - Update to new architecture (fix coordinate driver references)
  - [x] **Rivet Driver** - Removed

## Implementation Notes

1. **Actor Router Architecture**
   - Should integrate with existing authentication middleware
   - Must handle serialization/deserialization properly
   - Need to support both JSON and CBOR encoding
   - Should use existing error handling patterns

2. **Driver Routing Methods**
   - `sendRequest` and `openWebSocket` are for driver-to-driver communication
   - `proxyRequest` and `proxyWebSocket` are for transparent forwarding
   - All actor-to-actor communication goes through ManagerDriver, not ActorDriver

3. **WebSocket Type Handling**
   - Need to handle conversion between Node.js and browser WebSocket types
   - Consider using the `UniversalWebSocket` interface where appropriate

4. **Error Propagation**
   - Errors should properly propagate through driver layers
   - Use existing error types from `@/actor/errors.ts`

## Testing Requirements

Once implemented, all tests in the driver test suite should pass:
- Raw HTTP tests
- Raw WebSocket tests
- Actor connection tests
- Action tests
- Inline client tests

## Progress Tracking

Mark items with [x] when completed. Parent items should only be marked complete when all sub-items are done.

## Current Status

### Completed:
1. Removed incorrectly added methods from ActorDriver and ManagerDriver interfaces
2. Implemented Actor Router with all required endpoints:
   - SSE connections handler
   - WebSocket connections handler
   - Action calls handler
   - Connection messages handler
   - Raw HTTP requests handler
   - Raw WebSocket requests handler
3. Updated Inline Client Driver to use ManagerDriver methods with full WebSocket support
4. Fixed Manager Router to use driver routing methods with proper WebSocket bridging
5. Updated test infrastructure (test helper and driver test suite)
6. Updated Cloudflare Workers manager driver with new routing methods
7. Removed deprecated Rivet driver
8. All core package types are passing

### In Progress:
- Memory and File System drivers need proper implementation of routing methods that maintain actor routers locally

### Remaining:
See unchecked items in the Implementation Tasks section above.
