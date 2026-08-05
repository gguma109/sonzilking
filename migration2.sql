CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  name TEXT NOT NULL,
  nickname TEXT,
  recoveryEmail TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

ALTER TABLE sales ADD COLUMN userId TEXT;
ALTER TABLE purchases ADD COLUMN userId TEXT;
ALTER TABLE notes ADD COLUMN userId TEXT;
ALTER TABLE payments ADD COLUMN userId TEXT;
