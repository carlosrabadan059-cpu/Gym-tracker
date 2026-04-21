-- Add catalog_id to exercises table to link back to exercise_catalog
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS catalog_id INTEGER REFERENCES exercise_catalog(id) ON DELETE SET NULL;
