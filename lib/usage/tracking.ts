// This file is kept for backward compatibility
// Use tracking-client.ts for client components and tracking-server.ts for server components

export * from './tracking-base';
export { createClientUsageTracker } from './tracking-client';
export { createUsageTracker } from './tracking-server';