import { Hono } from "hono";
import { SlackApp, SlackEdgeAppEnv } from "slack-cloudflare-workers";

export default {
  async fetch(
    request: Request,
    env: SlackEdgeAppEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const slackApp = new SlackApp({
      env: {
        SLACK_SIGNING_SECRET: env.SLACK_SIGNING_SECRET,
        SLACK_BOT_TOKEN: env.SLACK_BOT_TOKEN,
      },
    });

    const server = new Hono();

    slackApp.event("message", async ({ context, payload }) => {
      if (payload.subtype === undefined) {
        const { channel, user, thread_ts } = payload;

        if (thread_ts) {
          await context.client.chat.postEphemeral({
            channel,
            text: `<@${payload.user}>! 스레드 메시지를 받았습니다.`,
            user,
            thread_ts,
          });
        } else {
          const messageText = payload.text;
          if (messageText) {
            await context.client.chat.postEphemeral({
              channel,
              text: `<@${payload.user}>! 채널 메시지를 받았습니다.`,
              user,
            });
          }
        }
      }
    });

    server.all("/*", async (c) => {
      console.log("log in", c);
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
