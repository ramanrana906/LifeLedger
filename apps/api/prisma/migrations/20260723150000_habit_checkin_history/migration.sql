CREATE TABLE "HabitCheckin" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "checkinDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HabitCheckin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HabitCheckin_habitId_checkinDate_key"
ON "HabitCheckin"("habitId", "checkinDate");

CREATE INDEX "HabitCheckin_userId_checkinDate_idx"
ON "HabitCheckin"("userId", "checkinDate");

ALTER TABLE "HabitCheckin"
ADD CONSTRAINT "HabitCheckin_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HabitCheckin"
ADD CONSTRAINT "HabitCheckin_habitId_fkey"
FOREIGN KEY ("habitId") REFERENCES "Habit"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- The old model retained only the most recent check-in. Preserve that real
-- event without fabricating historical days from the current streak counter.
INSERT INTO "HabitCheckin" (
    "id",
    "userId",
    "habitId",
    "checkinDate",
    "createdAt"
)
SELECT
    gen_random_uuid(),
    habit."userId",
    habit."id",
    habit."lastCheckin",
    CURRENT_TIMESTAMP
FROM "Habit" habit
WHERE habit."lastCheckin" IS NOT NULL
ON CONFLICT ("habitId", "checkinDate") DO NOTHING;
