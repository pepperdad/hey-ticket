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
  season_info: {
    id?: number;
    season_name: string;
    start_date: string;
    end_date?: string;
  };
  emoji_season: {
    season_id: number;
    user_id: string;
    sent_count: number;
    received_count: number;
  };
  emoji_season_archive: {
    season_id: number;
    user_id: string;
    sent_count: number;
    received_count: number;
  };
}
