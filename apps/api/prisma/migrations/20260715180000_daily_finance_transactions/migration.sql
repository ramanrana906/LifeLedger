CREATE TABLE "transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "transactionDate" DATE NOT NULL,
  "type" VARCHAR(30) NOT NULL,
  "amount" DECIMAL(12, 2) NOT NULL,
  "category" VARCHAR(120) NOT NULL,
  "note" TEXT,
  "linkedDebtId" UUID,
  "debtPaymentId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "transactions_debtPaymentId_key" ON "transactions"("debtPaymentId");
CREATE INDEX "transactions_userId_transactionDate_idx" ON "transactions"("userId", "transactionDate");
CREATE INDEX "transactions_userId_type_idx" ON "transactions"("userId", "type");
CREATE INDEX "transactions_linkedDebtId_idx" ON "transactions"("linkedDebtId");

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_linkedDebtId_fkey" FOREIGN KEY ("linkedDebtId") REFERENCES "Debt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_debtPaymentId_fkey" FOREIGN KEY ("debtPaymentId") REFERENCES "DebtPayment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "transactions" ("userId", "transactionDate", "type", "amount", "category", "note", "createdAt", "deletedAt")
SELECT "userId", "month", 'income', "income", 'Migrated monthly total', 'Migrated from monthly income total', CURRENT_TIMESTAMP, "deletedAt"
FROM "FinanceMonth"
WHERE "income" > 0;

INSERT INTO "transactions" ("userId", "transactionDate", "type", "amount", "category", "note", "createdAt", "deletedAt")
SELECT "userId", "month", 'expense', "expenses", 'Migrated monthly total', 'Migrated from monthly expense total', CURRENT_TIMESTAMP, "deletedAt"
FROM "FinanceMonth"
WHERE "expenses" > 0;

INSERT INTO "transactions" ("userId", "transactionDate", "type", "amount", "category", "note", "createdAt", "deletedAt")
SELECT "userId", "month", 'debt_payment', "debtPaid", 'Migrated monthly total', 'Migrated from monthly debt-paid total; not linked to a specific debt', CURRENT_TIMESTAMP, "deletedAt"
FROM "FinanceMonth"
WHERE "debtPaid" > 0;
