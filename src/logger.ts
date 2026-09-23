const pinoLogger = {
  info: (meta: Record<string, unknown>, msg?: string) => console.log("[INFO]", msg || ""),
  warn: (meta: Record<string, unknown>, msg?: string) => console.log("[WARN]", msg || ""),
  error: (meta: Record<string, unknown>, msg?: string) => console.log("[ERROR]", msg || ""),
  debug: (meta: Record<string, unknown>, msg?: string) => console.log("[DEBUG]", msg || ""),
};
export function logger(component: string) { return { child: () => pinoLogger }; }
export const log = {
  info(c: string, e: string, m?: string, meta?: Record<string, unknown>) { if (m) console.log("[INFO]", c, e, m); },
  warn(c: string, e: string, m?: string, meta?: Record<string, unknown>) { if (m) console.log("[WARN]", c, e, m); },
  error(c: string, e: string, m?: string, meta?: Record<string, unknown>) { if (m) console.log("[ERROR]", c, e, m); },
  debug(c: string, e: string, m?: string, meta?: Record<string, unknown>) { if (m) console.log("[DEBUG]", c, e, m); },
};
export default pinoLogger;
