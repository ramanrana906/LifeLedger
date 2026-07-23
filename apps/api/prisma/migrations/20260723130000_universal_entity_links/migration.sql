BEGIN;

-- A closed set keeps polymorphic links queryable and prevents misspelled entity
-- kinds from becoming permanent graph data.
CREATE TYPE "EntityType" AS ENUM (
    'goal',
    'habit',
    'routine',
    'routine_step',
    'learning_skill',
    'finance_debt',
    'finance_savings',
    'finance_transaction',
    'journal_entry'
);

CREATE TABLE "entity_links" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_type" "EntityType" NOT NULL,
    "source_id" UUID NOT NULL,
    "target_type" "EntityType" NOT NULL,
    "target_id" UUID NOT NULL,
    "relationship_type" VARCHAR(50) NOT NULL DEFAULT 'linked',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_links_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "entity_links_canonical_pair_check" CHECK (
        ("source_type"::text || ':' || "source_id"::text)
        <
        ("target_type"::text || ':' || "target_id"::text)
    )
);

-- relationship_type is an attribute of a link, not part of its identity. This
-- is therefore one row per undirected pair, irrespective of direction or label.
CREATE UNIQUE INDEX "entity_links_canonical_pair_key"
ON "entity_links" (
    "user_id",
    "source_type",
    "source_id",
    "target_type",
    "target_id"
);

CREATE INDEX "entity_links_source_lookup_idx"
ON "entity_links" ("user_id", "source_type", "source_id");

CREATE INDEX "entity_links_target_lookup_idx"
ON "entity_links" ("user_id", "target_type", "target_id");

ALTER TABLE "entity_links"
ADD CONSTRAINT "entity_links_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Stage one row for every legacy relationship before any legacy storage is
-- removed. origin + legacy_key make the extraction itself auditable.
CREATE TEMPORARY TABLE "_entity_link_backfill" (
    "origin" TEXT NOT NULL,
    "legacy_key" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "left_type" "EntityType" NOT NULL,
    "left_id" UUID NOT NULL,
    "right_type" "EntityType" NOT NULL,
    "right_id" UUID NOT NULL,
    "relationship_type" VARCHAR(50) NOT NULL DEFAULT 'linked',
    "created_at" TIMESTAMP(3) NOT NULL
) ON COMMIT DROP;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'habit_goal',
    h."id"::text,
    h."userId",
    'habit'::"EntityType",
    h."id",
    'goal'::"EntityType",
    h."linkedGoalId",
    h."createdAt"
FROM "Habit" h
WHERE h."linkedGoalId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'skill_goal',
    s."id"::text,
    s."userId",
    'learning_skill'::"EntityType",
    s."id",
    'goal'::"EntityType",
    s."linkedGoalId",
    CURRENT_TIMESTAMP
FROM "Skill" s
WHERE s."linkedGoalId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'debt_goal',
    d."id"::text,
    d."userId",
    'finance_debt'::"EntityType",
    d."id",
    'goal'::"EntityType",
    d."linkedGoalId",
    d."createdAt"
FROM "Debt" d
WHERE d."linkedGoalId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'savings_goal',
    s."userId"::text,
    s."userId",
    'finance_savings'::"EntityType",
    s."userId",
    'goal'::"EntityType",
    s."linkedGoalId",
    s."updatedAt"
FROM "Savings" s
WHERE s."linkedGoalId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'routine_goal',
    r."id"::text,
    r."userId",
    'routine'::"EntityType",
    r."id",
    'goal'::"EntityType",
    r."linkedGoalId",
    r."createdAt"
FROM "Routine" r
WHERE r."linkedGoalId" IS NOT NULL;

-- RoutineDayLog.linkedGoalId duplicated the routine's cross-domain link at log
-- time. Preserve any historical values as routine-to-goal links, then remove
-- the derived column below.
INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'routine_day_log_goal',
    rdl."id"::text,
    rdl."userId",
    'routine'::"EntityType",
    rdl."routineId",
    'goal'::"EntityType",
    rdl."linkedGoalId",
    rdl."createdAt"
FROM "RoutineDayLog" rdl
WHERE rdl."linkedGoalId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "relationship_type", "created_at")
SELECT
    'routine_step_habit',
    rs."id"::text,
    rs."userId",
    'routine_step'::"EntityType",
    rs."id",
    'habit'::"EntityType",
    rs."linkedHabitId",
    CASE
        WHEN rs."stepType" = 'habit' THEN 'triggered_by'
        ELSE 'linked'
    END,
    rs."createdAt"
FROM "RoutineStep" rs
WHERE rs."linkedHabitId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "relationship_type", "created_at")
SELECT
    'routine_step_daily_goal',
    rs."id"::text,
    rs."userId",
    'routine_step'::"EntityType",
    rs."id",
    'goal'::"EntityType",
    rs."linkedDailyGoalId",
    CASE
        WHEN rs."stepType" = 'daily_goal' THEN 'triggered_by'
        ELSE 'linked'
    END,
    rs."createdAt"
FROM "RoutineStep" rs
WHERE rs."linkedDailyGoalId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "relationship_type", "created_at")
SELECT
    'routine_step_weekly_goal',
    rs."id"::text,
    rs."userId",
    'routine_step'::"EntityType",
    rs."id",
    'goal'::"EntityType",
    rs."linkedWeeklyGoalId",
    CASE
        WHEN rs."stepType" = 'weekly_goal' THEN 'triggered_by'
        ELSE 'linked'
    END,
    rs."createdAt"
FROM "RoutineStep" rs
WHERE rs."linkedWeeklyGoalId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "relationship_type", "created_at")
SELECT
    'routine_step_skill',
    rs."id"::text,
    rs."userId",
    'routine_step'::"EntityType",
    rs."id",
    'learning_skill'::"EntityType",
    rs."linkedSkillId",
    CASE
        WHEN rs."stepType" = 'learning' THEN 'triggered_by'
        ELSE 'linked'
    END,
    rs."createdAt"
FROM "RoutineStep" rs
WHERE rs."linkedSkillId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'transaction_debt',
    tx."id"::text,
    tx."userId",
    'finance_transaction'::"EntityType",
    tx."id",
    'finance_debt'::"EntityType",
    tx."linkedDebtId",
    tx."createdAt"
FROM "transactions" tx
WHERE tx."linkedDebtId" IS NOT NULL;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'journal_goal_tag',
    jgt."journalEntryId"::text || ':' || jgt."goalId"::text,
    jgt."userId",
    'journal_entry'::"EntityType",
    jgt."journalEntryId",
    'goal'::"EntityType",
    jgt."goalId",
    jgt."createdAt"
FROM "JournalGoalTag" jgt;

INSERT INTO "_entity_link_backfill"
    ("origin", "legacy_key", "user_id", "left_type", "left_id", "right_type", "right_id", "created_at")
SELECT
    'journal_habit_tag',
    jht."journalEntryId"::text || ':' || jht."habitId"::text,
    jht."userId",
    'journal_entry'::"EntityType",
    jht."journalEntryId",
    'habit'::"EntityType",
    jht."habitId",
    jht."createdAt"
FROM "JournalHabitTag" jht;

-- First assertion: every non-null legacy relationship produced exactly one
-- staging row. No source column/table is dropped if any count differs.
DO $$
DECLARE
    mismatch TEXT;
BEGIN
    WITH expected("origin", "expected_count") AS (
        SELECT 'habit_goal', COUNT(*) FROM "Habit" WHERE "linkedGoalId" IS NOT NULL
        UNION ALL
        SELECT 'skill_goal', COUNT(*) FROM "Skill" WHERE "linkedGoalId" IS NOT NULL
        UNION ALL
        SELECT 'debt_goal', COUNT(*) FROM "Debt" WHERE "linkedGoalId" IS NOT NULL
        UNION ALL
        SELECT 'savings_goal', COUNT(*) FROM "Savings" WHERE "linkedGoalId" IS NOT NULL
        UNION ALL
        SELECT 'routine_goal', COUNT(*) FROM "Routine" WHERE "linkedGoalId" IS NOT NULL
        UNION ALL
        SELECT 'routine_day_log_goal', COUNT(*) FROM "RoutineDayLog" WHERE "linkedGoalId" IS NOT NULL
        UNION ALL
        SELECT 'routine_step_habit', COUNT(*) FROM "RoutineStep" WHERE "linkedHabitId" IS NOT NULL
        UNION ALL
        SELECT 'routine_step_daily_goal', COUNT(*) FROM "RoutineStep" WHERE "linkedDailyGoalId" IS NOT NULL
        UNION ALL
        SELECT 'routine_step_weekly_goal', COUNT(*) FROM "RoutineStep" WHERE "linkedWeeklyGoalId" IS NOT NULL
        UNION ALL
        SELECT 'routine_step_skill', COUNT(*) FROM "RoutineStep" WHERE "linkedSkillId" IS NOT NULL
        UNION ALL
        SELECT 'transaction_debt', COUNT(*) FROM "transactions" WHERE "linkedDebtId" IS NOT NULL
        UNION ALL
        SELECT 'journal_goal_tag', COUNT(*) FROM "JournalGoalTag"
        UNION ALL
        SELECT 'journal_habit_tag', COUNT(*) FROM "JournalHabitTag"
    ),
    staged("origin", "staged_count") AS (
        SELECT "origin", COUNT(*)
        FROM "_entity_link_backfill"
        GROUP BY "origin"
    )
    SELECT string_agg(
        format(
            '%s expected=%s staged=%s',
            expected."origin",
            expected."expected_count",
            COALESCE(staged."staged_count", 0)
        ),
        '; ' ORDER BY expected."origin"
    )
    INTO mismatch
    FROM expected
    LEFT JOIN staged USING ("origin")
    WHERE expected."expected_count" <> COALESCE(staged."staged_count", 0);

    IF mismatch IS NOT NULL THEN
        RAISE EXCEPTION 'entity_links legacy extraction count mismatch: %', mismatch;
    END IF;
END
$$;

-- The generic table cannot declare polymorphic foreign keys. Validate both
-- endpoints and tenant ownership explicitly during migration instead.
CREATE TEMPORARY TABLE "_entity_link_entity_registry"
ON COMMIT DROP
AS
    SELECT g."userId" AS "user_id", 'goal'::"EntityType" AS "entity_type", g."id" AS "entity_id"
    FROM "Goal" g
    UNION ALL
    SELECT h."userId", 'habit'::"EntityType", h."id"
    FROM "Habit" h
    UNION ALL
    SELECT r."userId", 'routine'::"EntityType", r."id"
    FROM "Routine" r
    UNION ALL
    SELECT rs."userId", 'routine_step'::"EntityType", rs."id"
    FROM "RoutineStep" rs
    UNION ALL
    SELECT s."userId", 'learning_skill'::"EntityType", s."id"
    FROM "Skill" s
    UNION ALL
    SELECT d."userId", 'finance_debt'::"EntityType", d."id"
    FROM "Debt" d
    UNION ALL
    SELECT s."userId", 'finance_savings'::"EntityType", s."userId"
    FROM "Savings" s
    UNION ALL
    SELECT tx."userId", 'finance_transaction'::"EntityType", tx."id"
    FROM "transactions" tx
    UNION ALL
    SELECT je."userId", 'journal_entry'::"EntityType", je."id"
    FROM "JournalEntry" je;

CREATE UNIQUE INDEX "_entity_link_entity_registry_key"
ON "_entity_link_entity_registry" ("user_id", "entity_type", "entity_id");

DO $$
DECLARE
    invalid_endpoint_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO invalid_endpoint_count
    FROM "_entity_link_backfill" staged
    LEFT JOIN "_entity_link_entity_registry" left_entity
      ON left_entity."user_id" = staged."user_id"
     AND left_entity."entity_type" = staged."left_type"
     AND left_entity."entity_id" = staged."left_id"
    LEFT JOIN "_entity_link_entity_registry" right_entity
      ON right_entity."user_id" = staged."user_id"
     AND right_entity."entity_type" = staged."right_type"
     AND right_entity."entity_id" = staged."right_id"
    WHERE left_entity."entity_id" IS NULL
       OR right_entity."entity_id" IS NULL;

    IF invalid_endpoint_count > 0 THEN
        RAISE EXCEPTION
            'entity_links backfill found % missing or cross-user endpoints; no legacy links were removed',
            invalid_endpoint_count;
    END IF;
END
$$;

-- A routine step has one operational target. Stale values in non-matching
-- legacy columns are preserved as generic links, but never promoted into a
-- second triggered_by target.
DO $$
DECLARE
    ambiguous_step_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO ambiguous_step_count
    FROM (
        SELECT staged."left_id"
        FROM "_entity_link_backfill" staged
        WHERE staged."left_type" = 'routine_step'
          AND staged."relationship_type" = 'triggered_by'
        GROUP BY staged."left_id"
        HAVING COUNT(
            DISTINCT staged."right_type"::text || ':' || staged."right_id"::text
        ) > 1
    ) ambiguous;

    IF ambiguous_step_count > 0 THEN
        RAISE EXCEPTION
            'entity_links backfill found % routine steps with multiple operational targets; no legacy links were removed',
            ambiguous_step_count;
    END IF;
END
$$;

-- Canonicalize every pair with the exact same key ordering enforced by the
-- table CHECK constraint and used by application writes.
CREATE TEMPORARY VIEW "_entity_link_backfill_normalized"
AS
SELECT
    staged."user_id",
    CASE
        WHEN (staged."left_type"::text || ':' || staged."left_id"::text)
           < (staged."right_type"::text || ':' || staged."right_id"::text)
        THEN staged."left_type"
        ELSE staged."right_type"
    END AS "source_type",
    CASE
        WHEN (staged."left_type"::text || ':' || staged."left_id"::text)
           < (staged."right_type"::text || ':' || staged."right_id"::text)
        THEN staged."left_id"
        ELSE staged."right_id"
    END AS "source_id",
    CASE
        WHEN (staged."left_type"::text || ':' || staged."left_id"::text)
           < (staged."right_type"::text || ':' || staged."right_id"::text)
        THEN staged."right_type"
        ELSE staged."left_type"
    END AS "target_type",
    CASE
        WHEN (staged."left_type"::text || ':' || staged."left_id"::text)
           < (staged."right_type"::text || ':' || staged."right_id"::text)
        THEN staged."right_id"
        ELSE staged."left_id"
    END AS "target_id",
    staged."relationship_type",
    staged."created_at"
FROM "_entity_link_backfill" staged;

CREATE TEMPORARY VIEW "_entity_link_backfill_canonical"
AS
SELECT
    normalized."user_id",
    normalized."source_type",
    normalized."source_id",
    normalized."target_type",
    normalized."target_id",
    CASE
        WHEN BOOL_OR(normalized."relationship_type" = 'triggered_by')
        THEN 'triggered_by'
        ELSE MIN(normalized."relationship_type")
    END AS "relationship_type",
    MIN(normalized."created_at") AS "created_at"
FROM "_entity_link_backfill_normalized" normalized
GROUP BY
    normalized."user_id",
    normalized."source_type",
    normalized."source_id",
    normalized."target_type",
    normalized."target_id";

INSERT INTO "entity_links" (
    "id",
    "user_id",
    "source_type",
    "source_id",
    "target_type",
    "target_id",
    "relationship_type",
    "created_at"
)
SELECT
    gen_random_uuid(),
    canonical."user_id",
    canonical."source_type",
    canonical."source_id",
    canonical."target_type",
    canonical."target_id",
    canonical."relationship_type",
    canonical."created_at"
FROM "_entity_link_backfill_canonical" canonical
ON CONFLICT (
    "user_id",
    "source_type",
    "source_id",
    "target_type",
    "target_id"
)
DO UPDATE SET
    "relationship_type" = EXCLUDED."relationship_type",
    "created_at" = LEAST("entity_links"."created_at", EXCLUDED."created_at");

-- Final assertion: every distinct legacy relationship is present as exactly
-- one canonical row, including its relationship label.
DO $$
DECLARE
    expected_count BIGINT;
    migrated_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO expected_count
    FROM "_entity_link_backfill_canonical";

    SELECT COUNT(*)
    INTO migrated_count
    FROM "_entity_link_backfill_canonical" expected
    JOIN "entity_links" actual
      ON actual."user_id" = expected."user_id"
     AND actual."source_type" = expected."source_type"
     AND actual."source_id" = expected."source_id"
     AND actual."target_type" = expected."target_type"
     AND actual."target_id" = expected."target_id"
     AND actual."relationship_type" = expected."relationship_type";

    IF expected_count <> migrated_count THEN
        RAISE EXCEPTION
            'entity_links backfill verification failed: expected % canonical links, found %',
            expected_count,
            migrated_count;
    END IF;
END
$$;

-- Only after all assertions pass, remove the superseded one-off relations.
ALTER TABLE "Habit" DROP CONSTRAINT "Habit_linkedGoalId_fkey";
DROP INDEX "Habit_linkedGoalId_idx";
ALTER TABLE "Habit" DROP COLUMN "linkedGoalId";

ALTER TABLE "Skill" DROP CONSTRAINT "Skill_linkedGoalId_fkey";
DROP INDEX "Skill_linkedGoalId_idx";
ALTER TABLE "Skill" DROP COLUMN "linkedGoalId";

ALTER TABLE "Debt" DROP CONSTRAINT "Debt_linkedGoalId_fkey";
DROP INDEX "Debt_linkedGoalId_idx";
ALTER TABLE "Debt" DROP COLUMN "linkedGoalId";

ALTER TABLE "Savings" DROP CONSTRAINT "Savings_linkedGoalId_fkey";
DROP INDEX "Savings_linkedGoalId_idx";
ALTER TABLE "Savings" DROP COLUMN "linkedGoalId";

ALTER TABLE "Routine" DROP CONSTRAINT "Routine_linkedGoalId_fkey";
DROP INDEX "Routine_linkedGoalId_idx";
ALTER TABLE "Routine" DROP COLUMN "linkedGoalId";

ALTER TABLE "RoutineDayLog" DROP CONSTRAINT "RoutineDayLog_linkedGoalId_fkey";
DROP INDEX "RoutineDayLog_linkedGoalId_logDate_idx";
ALTER TABLE "RoutineDayLog" DROP COLUMN "linkedGoalId";

ALTER TABLE "RoutineStep" DROP CONSTRAINT "RoutineStep_linkedHabitId_fkey";
ALTER TABLE "RoutineStep" DROP CONSTRAINT "RoutineStep_linkedDailyGoalId_fkey";
ALTER TABLE "RoutineStep" DROP CONSTRAINT "RoutineStep_linkedWeeklyGoalId_fkey";
ALTER TABLE "RoutineStep" DROP CONSTRAINT "RoutineStep_linkedSkillId_fkey";
DROP INDEX "RoutineStep_linkedHabitId_idx";
DROP INDEX "RoutineStep_linkedDailyGoalId_idx";
DROP INDEX "RoutineStep_linkedWeeklyGoalId_idx";
DROP INDEX "RoutineStep_linkedSkillId_idx";
ALTER TABLE "RoutineStep"
    DROP COLUMN "linkedHabitId",
    DROP COLUMN "linkedDailyGoalId",
    DROP COLUMN "linkedWeeklyGoalId",
    DROP COLUMN "linkedSkillId";

ALTER TABLE "transactions" DROP CONSTRAINT "transactions_linkedDebtId_fkey";
DROP INDEX "transactions_linkedDebtId_idx";
ALTER TABLE "transactions" DROP COLUMN "linkedDebtId";

DROP TABLE "JournalGoalTag";
DROP TABLE "JournalHabitTag";

COMMIT;
