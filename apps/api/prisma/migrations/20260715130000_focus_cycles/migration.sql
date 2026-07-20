-- CreateTable
CREATE TABLE "FocusCycle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "cycleLengthDays" INTEGER NOT NULL DEFAULT 90,
    "focusAreas" TEXT[] NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FocusCycle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FocusCycle_userId_startDate_idx" ON "FocusCycle"("userId", "startDate");
CREATE INDEX "FocusCycle_userId_endDate_idx" ON "FocusCycle"("userId", "endDate");

-- AddForeignKey
ALTER TABLE "FocusCycle" ADD CONSTRAINT "FocusCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
