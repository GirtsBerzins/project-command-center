-- 010: Budžeta kolonnas uzdevumiem
-- budget_total, executor_type, retention_pct — manuāli lauki
-- budget_net — automātiski aprēķināts: budget_total × (1 − retention_pct)

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS budget_total   NUMERIC,
  ADD COLUMN IF NOT EXISTS executor_type  TEXT CHECK (executor_type IN ('darbinieks', 'apakšuzņēmējs')),
  ADD COLUMN IF NOT EXISTS retention_pct  NUMERIC CHECK (retention_pct >= 0 AND retention_pct <= 1);

-- Generated column (computed, never inserted directly)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'budget_net'
  ) THEN
    ALTER TABLE tasks
      ADD COLUMN budget_net NUMERIC GENERATED ALWAYS AS (
        CASE
          WHEN budget_total IS NOT NULL
          THEN ROUND(budget_total * (1 - COALESCE(retention_pct, 0)), 2)
          ELSE NULL
        END
      ) STORED;
  END IF;
END$$;
