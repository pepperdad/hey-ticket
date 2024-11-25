CREATE TABLE IF NOT EXISTS emoji_daily (
    user_id TEXT PRIMARY KEY,
    sent_count INTEGER DEFAULT 0,
    received_count INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS season_info (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_name TEXT NOT NULL,    
    start_date TEXT NOT NULL,           
    end_date DATE DEFAULT NULL            
);

CREATE TABLE IF NOT EXISTS emoji_season (
    season_id INTEGER NOT NULL,         
    user_id TEXT NOT NULL,             
    sent_count INTEGER DEFAULT 0,        
    received_count INTEGER DEFAULT 0,    
    UNIQUE(season_id, user_id),         
    FOREIGN KEY (season_id) REFERENCES season_info(id)
);

CREATE TABLE IF NOT EXISTS emoji_season_archive (
    season_id INTEGER NOT NULL,         
    user_id TEXT NOT NULL,             
    sent_count INTEGER DEFAULT 0,        
    received_count INTEGER DEFAULT 0,    
    FOREIGN KEY (season_id) REFERENCES season_info(id)
);