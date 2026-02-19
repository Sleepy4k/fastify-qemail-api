export const env = {
  NODE_ENV: process.env["NODE_ENV"] ?? "development",
  PORT: Number(process.env["PORT"] ?? 3000),
  HOST: process.env["HOST"] ?? "0.0.0.0",

  DB_HOST: process.env["DB_HOST"] ?? "localhost",
  DB_PORT: Number(process.env["DB_PORT"] ?? 3306),
  DB_USER: process.env["DB_USER"] ?? "root",
  DB_PASSWORD: process.env["DB_PASSWORD"] ?? "",
  DB_NAME: process.env["DB_NAME"] ?? "qemail_db",
  DB_CONNECTION_LIMIT: Number(process.env["DB_CONNECTION_LIMIT"] ?? 10),

  REDIS_HOST: process.env["REDIS_HOST"] ?? "localhost",
  REDIS_PORT: Number(process.env["REDIS_PORT"] ?? 6379),
  REDIS_USERNAME: process.env["REDIS_USERNAME"] ?? "",
  REDIS_PASSWORD: process.env["REDIS_PASSWORD"] ?? "",
  REDIS_DB: Number(process.env["REDIS_DB"] ?? 0),
  REDIS_PREFIX: process.env["REDIS_PREFIX"] ?? "qemail:",

  JWT_SECRET: process.env["JWT_SECRET"] ?? "change-me-in-production",
  JWT_EXPIRES_IN: process.env["JWT_EXPIRES_IN"] ?? "7d",
  ADMIN_JWT_SECRET: process.env["ADMIN_JWT_SECRET"] ?? "admin-change-me",
  ADMIN_JWT_EXPIRES_IN: process.env["ADMIN_JWT_EXPIRES_IN"] ?? "1d",
  SESSION_SECRET: process.env["SESSION_SECRET"] ?? "session-change-me",

  CF_API_TOKEN: process.env["CF_API_TOKEN"] ?? "",
  CF_ACCOUNT_ID: process.env["CF_ACCOUNT_ID"] ?? "",
  CF_WEBHOOK_SECRET: process.env["CF_WEBHOOK_SECRET"] ?? "",
  CF_WORKER_NAME: process.env["CF_WORKER_NAME"] ?? "qemail-worker",

  CORS_ORIGIN: process.env["CORS_ORIGIN"] ?? "http://localhost:5173",
  RATE_LIMIT_MAX: Number(process.env["RATE_LIMIT_MAX"] ?? 100),
  RATE_LIMIT_WINDOW: Number(process.env["RATE_LIMIT_WINDOW"] ?? 900000),

  EMAIL_EXPIRY_HOURS: Number(process.env["EMAIL_EXPIRY_HOURS"] ?? 24),
  MAX_EMAILS_PER_IP: Number(process.env["MAX_EMAILS_PER_IP"] ?? 10),

  ENABLE_SWAGGER: process.env["ENABLE_SWAGGER"] !== "false",

  UPLOAD_DIR:      process.env["UPLOAD_DIR"]      ?? "./uploads/attachments",
  UPLOAD_BASE_URL: process.env["UPLOAD_BASE_URL"] ?? "http://localhost:3000",
} as const;
