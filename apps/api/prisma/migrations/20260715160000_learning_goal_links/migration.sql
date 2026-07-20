-- AlterTable
ALTER TABLE "Skill" ADD COLUMN "linkedGoalId" UUID;

-- CreateIndex
CREATE INDEX "Skill_linkedGoalId_idx" ON "Skill"("linkedGoalId");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_linkedGoalId_fkey" FOREIGN KEY ("linkedGoalId") REFERENCES "Goal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
