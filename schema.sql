-- schema.sql
-- Database schema for 손질왕 D1 database

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

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  userId TEXT,
  createdAt TEXT NOT NULL,
  companyName TEXT NOT NULL,
  date TEXT NOT NULL,
  kilos REAL NOT NULL,
  unitPrice INTEGER NOT NULL,
  kilosTotal INTEGER NOT NULL,
  kilosText TEXT,
  addQty REAL,
  addPrice INTEGER,
  addTotal INTEGER,
  addText TEXT,
  commissionRate REAL,
  commissionAmount INTEGER,
  total INTEGER NOT NULL,
  unpaid INTEGER DEFAULT 1,
  memo TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  userId TEXT,
  createdAt TEXT NOT NULL,
  companyName TEXT NOT NULL,
  date TEXT NOT NULL,
  kilos REAL NOT NULL,
  unitPrice INTEGER NOT NULL,
  total INTEGER NOT NULL,
  kilosText TEXT,
  memo TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(companyName);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(companyName);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  userId TEXT,
  createdAt TEXT NOT NULL,
  content TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  userId TEXT,
  createdAt TEXT NOT NULL,
  companyName TEXT NOT NULL,
  amount REAL NOT NULL,
  memo TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_company ON payments(companyName);
