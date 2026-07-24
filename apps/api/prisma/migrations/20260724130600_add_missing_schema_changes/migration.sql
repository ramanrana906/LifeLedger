-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "avatarUrl" TEXT;
ALTER TABLE "Profile" ADD COLUMN "dateOfBirth" DATE;
ALTER TABLE "Profile" ADD COLUMN "location" VARCHAR(255);
ALTER TABLE "Profile" ADD COLUMN "occupation" VARCHAR(255);
ALTER TABLE "Profile" ADD COLUMN "height" DECIMAL(10,2);
ALTER TABLE "Profile" ADD COLUMN "startingWeight" DECIMAL(10,2);
ALTER TABLE "Profile" ADD COLUMN "targetSavingsRate" DECIMAL(5,2);
ALTER TABLE "Profile" ADD COLUMN "aboutMe" TEXT;

-- CreateTable for SymptomLog
CREATE TABLE "SymptomLog" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "logDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bodyArea" TEXT NOT NULL,
    "severity" INTEGER NOT NULL,
    "note" TEXT,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "SymptomLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable for Person
CREATE TABLE "Person" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL DEFAULT 'Friend',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Person_userId_name_key" ON "Person"("userId", "name");

-- AlterTable for RelationshipCheckin
ALTER TABLE "RelationshipCheckin" ADD COLUMN "personId" UUID;
ALTER TABLE "RelationshipCheckin" ALTER COLUMN "personName" DROP NOT NULL;
ALTER TABLE "RelationshipCheckin" ALTER COLUMN "category" DROP NOT NULL;

-- AlterTable for ImportantDate
ALTER TABLE "ImportantDate" ADD COLUMN "personId" UUID;
ALTER TABLE "ImportantDate" ALTER COLUMN "personName" DROP NOT NULL;

-- AlterTable for LearningSession
ALTER TABLE "LearningSession" ADD COLUMN "focusLevel" TEXT NOT NULL DEFAULT 'Deep Focus';

-- CreateTable for Flashcard
CREATE TABLE "Flashcard" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID,
    "subject" TEXT NOT NULL DEFAULT 'General',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "easeFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
    "timesReviewed" INTEGER NOT NULL DEFAULT 0,
    "nextReviewDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable for LearningResource
CREATE TABLE "LearningResource" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'To Read/Watch',
    "rating" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- AlterTable for Habit
ALTER TABLE "Habit" ADD COLUMN "frequency" TEXT NOT NULL DEFAULT 'daily';
ALTER TABLE "Habit" ADD COLUMN "frequencyCount" INTEGER NOT NULL DEFAULT 7;

-- CreateTable for HabitSlip
CREATE TABLE "HabitSlip" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "habitId" UUID NOT NULL,
    "slipDate" DATE NOT NULL,
    "triggerTags" TEXT[],
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HabitSlip_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HabitSlip_userId_slipDate_idx" ON "HabitSlip"("userId", "slipDate");

-- Foreign Keys
ALTER TABLE "SymptomLog" ADD CONSTRAINT "SymptomLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Person" ADD CONSTRAINT "Person_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RelationshipCheckin" ADD CONSTRAINT "RelationshipCheckin_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportantDate" ADD CONSTRAINT "ImportantDate_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "HabitSlip" ADD CONSTRAINT "HabitSlip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HabitSlip" ADD CONSTRAINT "HabitSlip_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
