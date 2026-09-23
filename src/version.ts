export interface BuildInfo { version: string; commit: string; buildTimestamp: string; environment: string; }
export const buildInfo: BuildInfo = { version: process.env.ASHBOUND_VERSION || "0.1.0", commit: process.env.ASHBOUND_COMMIT || "unknown", buildTimestamp: process.env.ASHBOUND_BUILD_TIMESTAMP || new Date().toISOString(), environment: process.env.NODE_ENV || "development" };
