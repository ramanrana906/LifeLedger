CREATE TYPE "RoutineStepType" AS ENUM (
  'habit',
  'daily_goal',
  'weekly_goal',
  'learning',
  'finance',
  'journal',
  'standalone'
);

CREATE TABLE "Routine" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "timeAnchor" VARCHAR(40),
  "linkedGoalId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineStep" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "routineId" UUID NOT NULL,
  "orderIndex" INTEGER NOT NULL,
  "stepName" TEXT NOT NULL,
  "stepType" "RoutineStepType" NOT NULL,
  "linkedHabitId" UUID,
  "linkedDailyGoalId" UUID,
  "linkedWeeklyGoalId" UUID,
  "linkedSkillId" UUID,
  "linkedFinanceAction" VARCHAR(80),
  "linkedJournal" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "RoutineStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineStepCompletion" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "routineStepId" UUID NOT NULL,
  "completedOn" DATE NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RoutineStepCompletion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RoutineDayLog" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "routineId" UUID NOT NULL,
  "linkedGoalId" UUID,
  "logDate" DATE NOT NULL,
  "completionPct" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(30) NOT NULL DEFAULT 'not_done',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RoutineDayLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Routine_userId_createdAt_idx" ON "Routine"("userId", "createdAt");
CREATE INDEX "Routine_linkedGoalId_idx" ON "Routine"("linkedGoalId");
CREATE INDEX "RoutineStep_routineId_orderIndex_idx" ON "RoutineStep"("routineId", "orderIndex");
CREATE INDEX "RoutineStep_userId_stepType_idx" ON "RoutineStep"("userId", "stepType");
CREATE INDEX "RoutineStep_linkedHabitId_idx" ON "RoutineStep"("linkedHabitId");
CREATE INDEX "RoutineStep_linkedDailyGoalId_idx" ON "RoutineStep"("linkedDailyGoalId");
CREATE INDEX "RoutineStep_linkedWeeklyGoalId_idx" ON "RoutineStep"("linkedWeeklyGoalId");
CREATE INDEX "RoutineStep_linkedSkillId_idx" ON "RoutineStep"("linkedSkillId");
CREATE UNIQUE INDEX "RoutineStepCompletion_routineStepId_completedOn_key" ON "RoutineStepCompletion"("routineStepId", "completedOn");
CREATE INDEX "RoutineStepCompletion_userId_completedOn_idx" ON "RoutineStepCompletion"("userId", "completedOn");
CREATE UNIQUE INDEX "RoutineDayLog_routineId_logDate_key" ON "RoutineDayLog"("routineId", "logDate");
CREATE INDEX "RoutineDayLog_userId_logDate_idx" ON "RoutineDayLog"("userId", "logDate");
CREATE INDEX "RoutineDayLog_linkedGoalId_logDate_idx" ON "RoutineDayLog"("linkedGoalId", "logDate");

ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_linkedHabitId_fkey" FOREIGN KEY ("linkedHabitId") REFERENCES "Habit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_linkedDailyGoalId_fkey" FOREIGN KEY ("linkedDailyGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_linkedWeeklyGoalId_fkey" FOREIGN KEY ("linkedWeeklyGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_linkedSkillId_fkey" FOREIGN KEY ("linkedSkillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RoutineStepCompletion" ADD CONSTRAINT "RoutineStepCompletion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineStepCompletion" ADD CONSTRAINT "RoutineStepCompletion_routineStepId_fkey" FOREIGN KEY ("routineStepId") REFERENCES "RoutineStep"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineDayLog" ADD CONSTRAINT "RoutineDayLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineDayLog" ADD CONSTRAINT "RoutineDayLog_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoutineDayLog" ADD CONSTRAINT "RoutineDayLog_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
