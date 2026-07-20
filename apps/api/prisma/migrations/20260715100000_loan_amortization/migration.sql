ALTER TABLE "Debt" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'other';
ALTER TABLE "Debt" ADD COLUMN "tenureMonths" INTEGER;
ALTER TABLE "Debt" ADD COLUMN "emiAmount" DECIMAL(12,2);
ALTER TABLE "Debt" ADD COLUMN "dueDay" INTEGER;
ALTER TABLE "Debt" ADD COLUMN "lastEmiAppliedOn" DATE;

ALTER TABLE "DebtPayment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'extra';
ALTER TABLE "DebtPayment" ADD COLUMN "interestPortion" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "DebtPayment" ADD COLUMN "principalPortion" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "DebtPayment" ADD COLUMN "resultingBalance" DECIMAL(12,2);

UPDATE "DebtPayment"
SET "principalPortion" = "amount",
    "resultingBalance" = NULL
WHERE "principalPortion" = 0;

CREATE INDEX "DebtPayment_debtId_paidOn_idx" ON "DebtPayment"("debtId", "paidOn");
