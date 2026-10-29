-- 회원(userId)별 조회가 전체 테이블을 훑지 않도록 하는 인덱스 (2026-10-29)
CREATE INDEX IF NOT EXISTS idx_sales_user_date ON sales(userId, date, createdAt);
CREATE INDEX IF NOT EXISTS idx_sales_user_company ON sales(userId, companyName);
CREATE INDEX IF NOT EXISTS idx_purchases_user_date ON purchases(userId, date, createdAt);
CREATE INDEX IF NOT EXISTS idx_payments_user_company ON payments(userId, companyName);
CREATE INDEX IF NOT EXISTS idx_statements_user_date ON statements(userId, saleDate, updatedAt, id);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(userId, createdAt);
