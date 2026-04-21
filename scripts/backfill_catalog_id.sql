-- Backfill catalog_id in exercises by matching name against exercise_catalog
UPDATE exercises e
SET catalog_id = ec.id
FROM exercise_catalog ec
WHERE LOWER(TRIM(e.name)) = LOWER(TRIM(ec.name))
  AND e.catalog_id IS NULL;

-- Check how many were updated
SELECT COUNT(*) AS backfilled FROM exercises WHERE catalog_id IS NOT NULL;

-- Check which ones still don't have catalog_id (name mismatch)
SELECT e.id, e.name, e.routine_id
FROM exercises e
WHERE e.catalog_id IS NULL
ORDER BY e.name;
