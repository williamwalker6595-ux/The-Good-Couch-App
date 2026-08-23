import { config } from "dotenv";

config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  quoApiKey: process.env.QUO_API_KEY ?? "",
  quoApiBaseUrl: process.env.QUO_API_BASE_URL ?? "https://api.quo.com",
  quoFromNumber: process.env.QUO_FROM_NUMBER ?? "",
  quoWebhookSigningKey: process.env.QUO_WEBHOOK_SIGNING_KEY ?? "",
  todoistApiToken: process.env.TODOIST_API_TOKEN ?? "",
};
