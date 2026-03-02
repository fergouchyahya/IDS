"use strict";

function createLogger(service) {
  const name = String(service || "app");

  const emit = (level, message, meta) => {
    const entry = {
      ts: new Date().toISOString(),
      level,
      service: name,
      msg: String(message || ""),
    };

    if (meta && typeof meta === "object") {
      entry.meta = meta;
    }

    const payload = JSON.stringify(entry);
    if (level === "error") {
      console.error(payload);
      return;
    }
    if (level === "warn") {
      console.warn(payload);
      return;
    }
    console.log(payload);
  };

  return {
    debug: (message, meta) => emit("debug", message, meta),
    info: (message, meta) => emit("info", message, meta),
    warn: (message, meta) => emit("warn", message, meta),
    error: (message, meta) => emit("error", message, meta),
  };
}

module.exports = { createLogger };
