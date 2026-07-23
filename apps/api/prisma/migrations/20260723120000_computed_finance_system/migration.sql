ALTER TABLE "Debt"
ADD COLUMN "originalEmiAmount" DECIMAL(12,2),
ADD COLUMN "originalInterestRate" DECIMAL(5,2),
ADD COLUMN "originalTenureMonths" INTEGER;

UPDATE "Debt"
SET
    "originalEmiAmount" = COALESCE("originalEmiAmount", "emiAmount"),
    "originalInterestRate" = COALESCE("originalInterestRate", "interestRate"),
    "originalTenureMonths" = COALESCE("originalTenureMonths", "tenureMonths");

ALTER TABLE "IncomeSource"
ADD COLUMN "isRecurring" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "recurringDayOfMonth" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "transactions"
ADD COLUMN "status" VARCHAR(30) NOT NULL DEFAULT 'confirmed',
ADD COLUMN "incomeSourceId" UUID;

UPDATE "transactions"
SET "status" = 'confirmed'
WHERE "status" = 'edited';

CREATE INDEX "transactions_incomeSourceId_idx"
ON "transactions"("incomeSourceId");

ALTER TABLE "transactions"
ADD CONSTRAINT "transactions_incomeSourceId_fkey"
FOREIGN KEY ("incomeSourceId") REFERENCES "IncomeSource"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BudgetLimit" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "category" VARCHAR(120) NOT NULL,
    "limitAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLimit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BudgetLimit_userId_category_key"
ON "BudgetLimit"("userId", "category");

CREATE INDEX "BudgetLimit_userId_idx"
ON "BudgetLimit"("userId");

ALTER TABLE "BudgetLimit"
ADD CONSTRAINT "BudgetLimit_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
