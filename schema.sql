-- schema.sql
-- Database schema for 손질왕 D1 database

CREATE TABLE IF NOT EXISTS sales (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  companyName TEXT NOT NULL,
  date TEXT NOT NULL,
  kilos REAL NOT NULL,
  unitPrice REAL NOT NULL,
  kilosTotal REAL NOT NULL,
  addQty REAL DEFAULT 0,
  addPrice REAL DEFAULT 0,
  addTotal REAL DEFAULT 0,
  commissionRate REAL DEFAULT 0,
  commissionAmount REAL DEFAULT 0,
  total REAL NOT NULL,
  unpaid INTEGER DEFAULT 1, -- 1: 미수 (True), 0: 완납 (False)
  memo TEXT
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  createdAt TEXT NOT NULL,
  companyName TEXT NOT NULL,
  date TEXT NOT NULL,
  kilos REAL NOT NULL,
  unitPrice REAL NOT NULL,
  total REAL NOT NULL,
  memo TEXT
);

CREATE INDEX IF NOT EXISTS idx_sales_company ON sales(companyName);
CREATE INDEX IF NOT EXISTS idx_purchases_company ON purchases(companyName);
