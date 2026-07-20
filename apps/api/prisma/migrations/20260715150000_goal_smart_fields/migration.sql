-- AlterTable
ALTER TABLE "Goal" ADD COLUMN "targetMetric" TEXT;
ALTER TABLE "Goal" ADD COLUMN "definitionOfDone" TEXT;
ALTER TABLE "Goal" ADD COLUMN "whyThisMatters" TEXT;

-- Preserve existing free-text goal descriptions as definition-of-done context.
UPDATE "Goal"
SET "definitionOfDone" = "targetDescription"
WHERE "definitionOfDone" IS NULL
  AND "targetDescription" IS NOT NULL;
