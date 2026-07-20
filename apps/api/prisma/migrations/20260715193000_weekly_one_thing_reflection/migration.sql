CREATE TABLE "WeeklyReflection" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "weekStart" DATE NOT NULL,
  "oneThingThieves" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "oneThingReflection" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WeeklyReflection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyReflection_userId_weekStart_key" ON "WeeklyReflection"("userId", "weekStart");
CREATE INDEX "WeeklyReflection_userId_weekStart_idx" ON "WeeklyReflection"("userId", "weekStart");

ALTER TABLE "WeeklyReflection" ADD CONSTRAINT "WeeklyReflection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
