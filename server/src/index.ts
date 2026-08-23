import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`the-good-couch-app server listening on port ${env.port}`);
});
