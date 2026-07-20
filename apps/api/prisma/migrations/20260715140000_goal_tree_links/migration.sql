-- CreateTable
CREATE TABLE "Goal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "parentGoalId" UUID,
    "level" VARCHAR(20) NOT NULL,
    "title" TEXT NOT NULL,
    "targetDescription" TEXT,
    "targetDate" DATE,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- Preserve existing goal data in the new hierarchy.
INSERT INTO "Goal" ("id", "userId", "parentGoalId", "level", "title", "targetDescription", "targetDate", "completed", "createdAt", "deletedAt")
SELECT "id", "userId", NULL, 'life', "title", "description", NULL, "completed", "createdAt", "deletedAt"
FROM "LifeGoal"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Goal" ("id", "userId", "parentGoalId", "level", "title", "targetDescription", "targetDate", "completed", "createdAt", "deletedAt")
SELECT "id", "userId", "lifeGoalId", 'weekly', "title", NULL, "weekStart", "completed", "createdAt", "deletedAt"
FROM "WeeklyGoal"
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Goal" ("id", "userId", "parentGoalId", "level", "title", "targetDescription", "targetDate", "completed", "createdAt", "deletedAt")
SELECT "id", "userId", NULL, 'daily', "title", NULL, "entryDate", "completed", "createdAt", "deletedAt"
FROM "DailyGoal"
ON CONFLICT ("id") DO NOTHING;

-- AlterTable
ALTER TABLE "Habit" ADD COLUMN "linkedGoalId" UUID;
ALTER TABLE "FocusCycle" ADD COLUMN "focusGoalId" UUID;

-- CreateTable
CREATE TABLE "JournalGoalTag" (
    "journalEntryId" UUID NOT NULL,
    "goalId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalGoalTag_pkey" PRIMARY KEY ("journalEntryId","goalId")
);

-- CreateTable
CREATE TABLE "JournalHabitTag" (
    "journalEntryId" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalHabitTag_pkey" PRIMARY KEY ("journalEntryId","habitId")
);

-- Backfill active cycles to the oldest active North Star goal, if one exists.
UPDATE "FocusCycle" fc
SET "focusGoalId" = first_goal."id"
FROM (
  SELECT DISTINCT ON ("userId") "id", "userId"
  FROM "Goal"
  WHERE "level" = 'life' AND "deletedAt" IS NULL
  ORDER BY "userId", "createdAt" ASC
) first_goal
WHERE fc."userId" = first_goal."userId"
  AND fc."focusGoalId" IS NULL
  AND fc."completedAt" IS NULL;

-- CreateIndex
CREATE INDEX "Goal_userId_level_idx" ON "Goal"("userId", "level");
CREATE INDEX "Goal_parentGoalId_idx" ON "Goal"("parentGoalId");
CREATE INDEX "Goal_targetDate_idx" ON "Goal"("targetDate");
CREATE INDEX "Habit_linkedGoalId_idx" ON "Habit"("linkedGoalId");
CREATE INDEX "FocusCycle_focusGoalId_idx" ON "FocusCycle"("focusGoalId");
CREATE INDEX "JournalGoalTag_userId_idx" ON "JournalGoalTag"("userId");
CREATE INDEX "JournalGoalTag_goalId_idx" ON "JournalGoalTag"("goalId");
CREATE INDEX "JournalHabitTag_userId_idx" ON "JournalHabitTag"("userId");
CREATE INDEX "JournalHabitTag_habitId_idx" ON "JournalHabitTag"("habitId");

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_parentGoalId_fkey" FOREIGN KEY ("parentGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FocusCycle" ADD CONSTRAINT "FocusCycle_focusGoalId_fkey" FOREIGN KEY ("focusGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalGoalTag" ADD CONSTRAINT "JournalGoalTag_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalGoalTag" ADD CONSTRAINT "JournalGoalTag_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalGoalTag" ADD CONSTRAINT "JournalGoalTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalHabitTag" ADD CONSTRAINT "JournalHabitTag_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalHabitTag" ADD CONSTRAINT "JournalHabitTag_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalHabitTag" ADD CONSTRAINT "JournalHabitTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
