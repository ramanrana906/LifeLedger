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
