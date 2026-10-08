-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill consecutive positions for existing tasks partitioned by project and status
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "projectId", "status" ORDER BY "createdAt" ASC) - 1 AS new_pos
  FROM "Task"
)
UPDATE "Task"
SET "position" = ranked.new_pos
FROM ranked
WHERE "Task".id = ranked.id;

-- CreateIndex
CREATE INDEX "Task_projectId_status_position_idx" ON "Task"("projectId", "status", "position");
