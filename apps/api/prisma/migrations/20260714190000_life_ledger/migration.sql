-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(255),
    "unitsWeight" VARCHAR(20) NOT NULL DEFAULT 'kg',
    "unitsCurrency" VARCHAR(20) NOT NULL DEFAULT '$',
    "goalWeight" DECIMAL(10,2),
    "onboarded" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserStats" (
    "userId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "freezeTokens" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE,
    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "XpEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XpEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnabledModule" (
    "userId" UUID NOT NULL,
    "module" VARCHAR(50) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "EnabledModule_pkey" PRIMARY KEY ("userId","module")
);

CREATE TABLE "JournalEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entryDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mood" VARCHAR(50) NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LifeGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LifeGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeeklyGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lifeGoalId" UUID,
    "title" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyGoal" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "entryDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Debt" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "principal" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "interestRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Savings" (
    "userId" UUID NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Savings_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "FinanceMonth" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "month" DATE NOT NULL,
    "income" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "debtPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    CONSTRAINT "FinanceMonth_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DebtPayment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "debtId" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paidOn" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DebtPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeightLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "logDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "weight" DECIMAL(10,2) NOT NULL,
    CONSTRAINT "WeightLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DietLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "logDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calories" INTEGER NOT NULL DEFAULT 0,
    "protein" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "DietLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkoutLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "logDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exercise" TEXT NOT NULL,
    "sets" INTEGER NOT NULL DEFAULT 0,
    "reps" INTEGER NOT NULL DEFAULT 0,
    "weight" DECIMAL(10,2) NOT NULL DEFAULT 0,
    CONSTRAINT "WorkoutLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SleepLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "logDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hours" DECIMAL(4,2) NOT NULL,
    "quality" INTEGER NOT NULL,
    CONSTRAINT "SleepLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RelationshipCheckin" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "personName" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "rating" INTEGER NOT NULL,
    "note" TEXT,
    CONSTRAINT "RelationshipCheckin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImportantDate" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "personName" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "date" DATE NOT NULL,
    CONSTRAINT "ImportantDate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Skill" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "targetDate" DATE,
    "status" TEXT NOT NULL DEFAULT 'active',
    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID,
    "minutes" INTEGER NOT NULL,
    "notes" TEXT,
    "logDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LearningSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Habit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCheckin" DATE,
    "lastSlip" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Habit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XpEvent_userId_createdAt_idx" ON "XpEvent"("userId", "createdAt");
CREATE UNIQUE INDEX "JournalEntry_userId_entryDate_key" ON "JournalEntry"("userId", "entryDate");
CREATE INDEX "JournalEntry_userId_entryDate_idx" ON "JournalEntry"("userId", "entryDate");
CREATE INDEX "WeeklyGoal_userId_weekStart_idx" ON "WeeklyGoal"("userId", "weekStart");
CREATE INDEX "DailyGoal_userId_entryDate_idx" ON "DailyGoal"("userId", "entryDate");
CREATE UNIQUE INDEX "FinanceMonth_userId_month_key" ON "FinanceMonth"("userId", "month");
CREATE UNIQUE INDEX "DietLog_userId_logDate_key" ON "DietLog"("userId", "logDate");

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_id_fkey" FOREIGN KEY ("id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserStats" ADD CONSTRAINT "UserStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "XpEvent" ADD CONSTRAINT "XpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnabledModule" ADD CONSTRAINT "EnabledModule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LifeGoal" ADD CONSTRAINT "LifeGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeeklyGoal" ADD CONSTRAINT "WeeklyGoal_lifeGoalId_fkey" FOREIGN KEY ("lifeGoalId") REFERENCES "LifeGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyGoal" ADD CONSTRAINT "DailyGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Savings" ADD CONSTRAINT "Savings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinanceMonth" ADD CONSTRAINT "FinanceMonth_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DebtPayment" ADD CONSTRAINT "DebtPayment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeightLog" ADD CONSTRAINT "WeightLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DietLog" ADD CONSTRAINT "DietLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkoutLog" ADD CONSTRAINT "WorkoutLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SleepLog" ADD CONSTRAINT "SleepLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RelationshipCheckin" ADD CONSTRAINT "RelationshipCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportantDate" ADD CONSTRAINT "ImportantDate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningSession" ADD CONSTRAINT "LearningSession_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Habit" ADD CONSTRAINT "Habit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
