# Actor-Core Development Guide

## Build Commands

- **Build:** `yarn build` - Production build
- **Dev:** `yarn dev` - Watch mode for development
- **Format:** `yarn fmt` - Format code with Biome
- **Type Check:** `yarn check-types` - Verify TypeScript types

## Code Style Guidelines

- **Formatting:** Uses Biome for consistent formatting
- **Imports:** Organized imports enforced, unused imports warned
- **TypeScript:** Strict mode enabled, target ESNext
- **Naming:** 
  - camelCase for variables, functions
  - PascalCase for classes, interfaces, types
  - UPPER_CASE for constants
  - Use `#` prefix for private class members (not `private` keyword)
- **Error Handling:** 
  - Extend from `ActorError` base class
  - Use `UserError` for client-safe errors
  - Use `InternalError` for internal errors

## Project Structure

- Monorepo with Yarn workspaces and Turborepo
- Core code in `packages/actor-core/`
- Platform implementations in `packages/platforms/`
- Driver implementations in `packages/drivers/`

## Development Notes

- Prefer classes over factory functions
- Use zod for runtime type validation
- Use `assertUnreachable(x: never)` for exhaustive type checking in switch statements
- Follow existing patterns for P2P networking
- Add proper JSDoc comments for public APIs
- Ensure proper error handling with descriptive messages
- Verify type safety with `yarn check-types` before committing

