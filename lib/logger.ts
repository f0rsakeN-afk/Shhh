/**
 * Leveled process logger for the server. Routes and infrastructure hook
 * into one shared instance so failures land in the same stream with a
 * consistent prefix, timestamps and structured context, instead of being
 * swallowed by Elysia's default handling or scattered console.logs.
 *
 * Level filters via LOG_LEVEL (debug|info|warn|error), default info.
 */
type LogLevel = "debug" | "info" | "warn" | "error"

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const configuredLevel: LogLevel =
  (["debug", "info", "warn", "error"] as LogLevel[]).find(
    (level) => level === (process.env.LOG_LEVEL ?? "").toLowerCase(),
  ) ?? "info"

function enabled(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configuredLevel]
}

function emit(level: LogLevel, tag: string, message: string, context?: Record<string, unknown>) {
  if (!enabled(level)) return

  const timestamp = new Date().toISOString()
  const head = `[${timestamp}] [${tag}] [${level.toUpperCase()}]`
  const detail =
    context && Object.keys(context).length > 0
      ? ` ${JSON.stringify(context)}`
      : ""

  if (level === "error") {
    console.error(`${head} ${message}${detail}`)
    return
  }
  console.log(`${head} ${message}${detail}`)
}

export function createLogger(tag: string) {
  return {
    debug: (message: string, context?: Record<string, unknown>) =>
      emit("debug", tag, message, context),
    info: (message: string, context?: Record<string, unknown>) =>
      emit("info", tag, message, context),
    warn: (message: string, context?: Record<string, unknown>) =>
      emit("warn", tag, message, context),
    error: (message: string, context?: Record<string, unknown>) =>
      emit("error", tag, message, context),
  }
}

/** Shared logger for non-route infrastructure. */
export const logger = createLogger("app")
