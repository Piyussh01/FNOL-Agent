// Global test setup. Loads .env.test if present, otherwise relies on per-test env.
import { config } from "node:process";

// Provide harmless defaults so feature flags don't fire in unit tests.
process.env.TOOL_JWT_SECRET ??= "test-secret-test-secret-test-secret-test";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";

void config;
