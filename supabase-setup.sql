-- ====== 在 Supabase SQL Editor 中运行以下 SQL ======

-- 1. 创建 timers 表
CREATE TABLE IF NOT EXISTS timers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  total_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. 开启实时订阅
ALTER PUBLICATION supabase_realtime ADD TABLE timers;

-- 3. 启用 RLS（允许所有人读写，因为 anon key 本身就是公开的）
ALTER TABLE timers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "允许所有人读取" ON timers
  FOR SELECT USING (true);

CREATE POLICY "允许所有人插入" ON timers
  FOR INSERT WITH CHECK (true);

CREATE POLICY "允许所有人删除" ON timers
  FOR DELETE USING (true);
