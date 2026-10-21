import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.VITEST !== undefined;

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isTest ? "silent" : "info"),
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", "res.headers['set-cookie']", "*.apiKey", "*.password", "*.token"],
    censor: "[redacted]",
  },
  ...(isProduction || isTest ? {} : { transport: { target: "pino-pretty", options: { colorize: true } } }),
});
