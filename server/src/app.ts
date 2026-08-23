import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { healthRouter } from "./routes/health";
import { messagesRouter } from "./routes/messages";
import { quoWebhookRouter } from "./routes/quoWebhook";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as Request).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.use(healthRouter);
  app.use(quoWebhookRouter);
  app.use(messagesRouter);

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "internal server error" });
  });

  return app;
}
