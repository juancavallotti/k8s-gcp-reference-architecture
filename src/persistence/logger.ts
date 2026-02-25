type LogLevel = "debug" | "info" | "warn" | "error";

function log(level: LogLevel, message: string, context?: object): void {
  const payload = context ? ` ${JSON.stringify(context)}` : "";
  const line = `[persistence] [${level}] ${message}${payload}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const persistenceLogger = {
  debug(message: string, context?: object): void {
    log("debug", message, context);
  },
  info(message: string, context?: object): void {
    log("info", message, context);
  },
  warn(message: string, context?: object): void {
    log("warn", message, context);
  },
  error(message: string, context?: object): void {
    log("error", message, context);
  },
};
