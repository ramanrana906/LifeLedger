-- AlterTable
ALTER TABLE "Debt" ADD COLUMN "linkedGoalId" UUID;

-- AlterTable
ALTER TABLE "Savings" ADD COLUMN "linkedGoalId" UUID;
ALTER TABLE "Savings" ADD COLUMN "goalAmount" DECIMAL(12,2);

-- CreateIndex
CREATE INDEX "Debt_linkedGoalId_idx" ON "Debt"("linkedGoalId");
CREATE INDEX "Savings_linkedGoalId_idx" ON "Savings"("linkedGoalId");

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Savings" ADD CONSTRAINT "Savings_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
