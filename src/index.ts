import { Hono } from "hono";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";
import { SlackApp } from "slack-cloudflare-workers";
import { Repository } from "./repository";
import { SlackMessageService } from "./service";

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

    const db = new Kysely<Database>({
      dialect: new D1Dialect({
        database: env.DB,
      }),
    });

    const repository = new Repository(db, env.DAILY_LIMIT);
    const service = new SlackMessageService(
      slackApp.client,
      env.EMOJI,
      repository
    );

    slackApp.event("message", async ({ context, payload }) => {
      if (payload.subtype === undefined) {
        const { channel, user, text, thread_ts } = payload;

        await service.handleMessage(channel, text, user, thread_ts);
      }
    });

    server.all("/*", async (c) => {
      const request = c.req.raw;

      if (!request.body) {
        console.error("Request body is null or undefined.");
        return c.json({ error: "Request body is required" }, 400);
      }

      return slackApp.run(request, c.executionCtx);
    });

    server.onError((err, c) => {
      console.error("Error occurred:", err);
      return c.json({ error: err.message }, 500);
    });

    return server.fetch(request, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = new Kysely<Database>({
      dialect: new D1Dialect({
        database: env.DB,
      }),
    });

    const repository = new Repository(db, env.DAILY_LIMIT);

    await repository.updateDailyEmoji();
    await repository.resetDailyEmoji();
  },
};
