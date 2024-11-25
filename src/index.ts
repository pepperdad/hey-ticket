import { Hono } from "hono";
import { SlackApp } from "slack-cloudflare-workers";
import { SlackMessageService } from "./service";

interface Env {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN: string;
  EMOJI: string;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const slackApp = new SlackApp({
      env: {
        SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET,
        SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN,
      },
    });

    const server = new Hono();

    const service = new SlackMessageService(slackApp.client, env.EMOJI);

    slackApp.event("message", async ({ context, payload }) => {
      if (payload.subtype === undefined) {
        const { channel, user, text, thread_ts } = payload;

        await service.handleMessage(channel, text, user, thread_ts);
      }
    });

    server.all("/*", async (c) => {
      console.log("log in", c.req.json());
      const rawRequest = c.req.raw;

      if (!rawRequest.body) {
        console.error("Request body is null or undefined.");
        return c.json({ error: "Request body is required" }, 400);
      }

      const [stream1, stream2] = rawRequest.body.tee();

      const clonedRequest = new Request(rawRequest, { body: stream1 });

      return slackApp.run(clonedRequest, c.executionCtx);
    });

    server.onError((err, c) => {
      console.error("Error occurred:", err);
      return c.json({ error: err.message }, 500);
    });

    return server.fetch(request, env, ctx);
  },
};
