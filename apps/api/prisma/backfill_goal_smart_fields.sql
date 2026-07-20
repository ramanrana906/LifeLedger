UPDATE "Goal"
SET "definitionOfDone" = "targetDescription"
WHERE "definitionOfDone" IS NULL
  AND "targetDescription" IS NOT NULL;
