interface Env {
  SLACK_SIGNING_SECRET: string;
  SLACK_BOT_TOKEN: string;
  EMOJI: string;
  DB: D1Database;
  DAILY_LIMIT: string;
}

interface Database {
  emoji_daily: {
    user_id: string;
    sent_count: number;
    received_count: number;
  };
}
