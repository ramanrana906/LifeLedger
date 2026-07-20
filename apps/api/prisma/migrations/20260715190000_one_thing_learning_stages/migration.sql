CREATE TYPE "SkillStage" AS ENUM ('DONT_KNOW_HOW', 'KNOW_HOW_NOT_DONE', 'CAN_DO_IT', 'DO_IT_WELL', 'COACH_IT');

ALTER TABLE "Skill" ADD COLUMN "statusStage" "SkillStage" NOT NULL DEFAULT 'DONT_KNOW_HOW';

UPDATE "Skill"
SET "statusStage" = CASE
  WHEN lower("status") IN ('coach', 'coach_it', 'teach', 'teaching', 'expert', 'mastered') THEN 'COACH_IT'::"SkillStage"
  WHEN lower("status") IN ('do_it_well', 'done well', 'strong', 'advanced', 'complete', 'completed') THEN 'DO_IT_WELL'::"SkillStage"
  WHEN lower("status") IN ('can_do_it', 'can do it', 'active', 'doing', 'practice', 'practicing') THEN 'CAN_DO_IT'::"SkillStage"
  WHEN lower("status") IN ('know_how_not_done', 'know how', 'learning', 'learned', 'studying') THEN 'KNOW_HOW_NOT_DONE'::"SkillStage"
  ELSE 'DONT_KNOW_HOW'::"SkillStage"
END;

ALTER TABLE "Skill" DROP COLUMN "status";
ALTER TABLE "Skill" RENAME COLUMN "statusStage" TO "status";
