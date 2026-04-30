type Level = "debug" | "info" | "warn" | "error"
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 }

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void
  info: (msg: string, fields?: Record<string, unknown>) => void
  warn: (msg: string, fields?: Record<string, unknown>) => void
  error: (msg: string, fields?: Record<string, unknown>) => void
}

export interface LoggerOptions {
  level: Level
  write?: (line: string) => void
}

export function createLogger(opts: LoggerOptions): Logger {
  const threshold = ORDER[opts.level]
  const write = opts.write ?? ((s: string) => console.log(s))
  const emit = (level: Level, msg: string, fields?: Record<string, unknown>) => {
    if (ORDER[level] < threshold) return
    write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...fields }))
  }
  return {
    debug: (m, f) => emit("debug", m, f),
    info: (m, f) => emit("info", m, f),
    warn: (m, f) => emit("warn", m, f),
    error: (m, f) => emit("error", m, f),
  }
}
