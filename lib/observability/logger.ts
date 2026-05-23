type Fields = Record<string, unknown>;

function emit(level: "info" | "warn" | "error", msg: string, fields: Fields) {
  const line = { ts: new Date().toISOString(), level, msg, ...fields };
  const out = JSON.stringify(line);
  if (level === "error") console.error(out);
  else if (level === "warn") console.warn(out);
  else console.log(out);
}

export const log = {
  info: (msg: string, fields: Fields = {}) => emit("info", msg, fields),
  warn: (msg: string, fields: Fields = {}) => emit("warn", msg, fields),
  error: (msg: string, fields: Fields = {}) => emit("error", msg, fields),
};

export function captureToolError(
  toolName: string,
  err: unknown,
  context: Fields = {},
) {
  log.error(`tool:${toolName} failed`, {
    tool: toolName,
    error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    ...context,
  });
}
