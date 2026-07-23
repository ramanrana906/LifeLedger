BEGIN;

-- Repair environments that briefly received the universal backfill before
-- operational routine targets were labelled triggered_by. Goal level is part
-- of the match so stale daily/weekly columns cannot become a second target.
CREATE TEMPORARY VIEW "_routine_step_target_repairs" AS
SELECT link."id" AS "link_id", step."id" AS "step_id"
FROM "entity_links" AS link
JOIN "RoutineStep" AS step
  ON step."userId" = link."user_id"
 AND (
      (link."source_type" = 'routine_step' AND link."source_id" = step."id")
      OR
      (link."target_type" = 'routine_step' AND link."target_id" = step."id")
 )
WHERE (
    step."stepType" = 'habit'
    AND (
        link."source_type" = 'habit'
        OR link."target_type" = 'habit'
    )
) OR (
    step."stepType" IN ('daily_goal', 'weekly_goal')
    AND EXISTS (
        SELECT 1
        FROM "Goal" goal
        WHERE goal."userId" = step."userId"
          AND goal."id" = CASE
              WHEN link."source_type" = 'goal' THEN link."source_id"
              WHEN link."target_type" = 'goal' THEN link."target_id"
              ELSE NULL
          END
          AND goal."level" = CASE
              WHEN step."stepType" = 'daily_goal' THEN 'daily'
              ELSE 'weekly'
          END
    )
) OR (
    step."stepType" = 'learning'
    AND (
        link."source_type" = 'learning_skill'
        OR link."target_type" = 'learning_skill'
    )
);

DO $$
DECLARE
    ambiguous_step_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO ambiguous_step_count
    FROM (
        SELECT repairs."step_id"
        FROM "_routine_step_target_repairs" repairs
        GROUP BY repairs."step_id"
        HAVING COUNT(*) > 1
    ) ambiguous;

    IF ambiguous_step_count > 0 THEN
        RAISE EXCEPTION
            'routine-step repair found % steps with multiple operational targets',
            ambiguous_step_count;
    END IF;
END
$$;

UPDATE "entity_links" AS link
SET "relationship_type" = 'triggered_by'
FROM "_routine_step_target_repairs" repairs
WHERE repairs."link_id" = link."id";

DO $$
DECLARE
    unresolved_count BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO unresolved_count
    FROM "_routine_step_target_repairs" repairs
    JOIN "entity_links" link ON link."id" = repairs."link_id"
    WHERE link."relationship_type" <> 'triggered_by';

    IF unresolved_count > 0 THEN
        RAISE EXCEPTION
            'routine-step link promotion failed for % operational targets',
            unresolved_count;
    END IF;
END
$$;

DROP VIEW "_routine_step_target_repairs";

COMMIT;
