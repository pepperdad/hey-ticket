CREATE TABLE IF NOT EXISTS emoji_daily (
    user_id TEXT PRIMARY KEY,
    sent_count INTEGER DEFAULT 0,
    received_count INTEGER DEFAULT 0
);