-- Fase 1 motor de recomendación: ontología en TravelTrip, tags estructurados, runs auditables.

ALTER TABLE `companies` ADD COLUMN `recommendation_policy` JSON NULL;

ALTER TABLE `travel_trips`
    ADD COLUMN `luxury_level` ENUM('UNKNOWN', 'ECONOMY', 'STANDARD', 'COMFORT', 'UPSCALE', 'LUXURY', 'ULTRA') NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `budget_tier` ENUM('UNKNOWN', 'VALUE', 'MID', 'UPPER_MID', 'PREMIUM', 'ULTRA_PREMIUM') NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `pace` ENUM('UNKNOWN', 'RELAXED', 'BALANCED', 'INTENSIVE') NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `climate_preference` ENUM('UNKNOWN', 'ANY', 'TROPICAL', 'TEMPERATE', 'COLD', 'DESERT', 'MEDITERRANEAN', 'MIXED') NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `exclusivity` ENUM('UNKNOWN', 'GROUP', 'SEMI_PRIVATE', 'PRIVATE', 'BESPOKE') NOT NULL DEFAULT 'UNKNOWN',
    ADD COLUMN `embedding_key` VARCHAR(120) NULL;

CREATE TABLE `travel_trip_style_tags` (
    `trip_id` CHAR(36) NOT NULL,
    `style` ENUM(
        'CULTURE', 'BEACH', 'NATURE', 'ADVENTURE', 'GASTRONOMY', 'WELLNESS', 'NIGHTLIFE',
        'CITY_BREAK', 'CRUISE', 'SAFARI', 'SKI', 'ROAD_TRIP', 'SHOPPING', 'FAMILY',
        'HONEYMOON', 'SENIOR_FRIENDLY', 'ACCESSIBILITY', 'WILDLIFE', 'PHOTOGRAPHY'
    ) NOT NULL,

    PRIMARY KEY (`trip_id`, `style`),
    INDEX `travel_trip_style_tags_style_idx`(`style`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `travel_trip_style_tags` ADD CONSTRAINT `travel_trip_style_tags_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE `recommendation_runs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `intent_snapshot` JSON NOT NULL,
    `scoring_model_version` VARCHAR(64) NOT NULL,
    `match_state` ENUM('STRONG_MATCH', 'WEAK_MATCH', 'NO_MATCH', 'NEEDS_CLARIFICATION') NOT NULL,
    `global_confidence` DOUBLE NULL,
    `validation_summary` JSON NULL,
    `fallback_hints` JSON NULL,
    `telemetry` JSON NULL,
    `catalog_candidate_count` INTEGER NOT NULL,
    `embedding_namespace` VARCHAR(120) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `recommendation_runs_company_id_created_at_idx`(`company_id`, `created_at`),
    INDEX `recommendation_runs_company_id_lead_id_idx`(`company_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recommendation_items` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `run_id` CHAR(36) NOT NULL,
    `travel_trip_id` CHAR(36) NOT NULL,
    `rank_index` INTEGER NOT NULL,
    `commercial_slot` ENUM('RECOMMENDED', 'BUDGET', 'LUXURY', 'ALTERNATIVE') NULL,
    `final_score` DOUBLE NOT NULL,
    `match_state` ENUM('STRONG_MATCH', 'WEAK_MATCH', 'NO_MATCH', 'NEEDS_CLARIFICATION') NOT NULL,
    `contributions` JSON NOT NULL,
    `diversity_penalty` DOUBLE NULL,
    `explainability` JSON NULL,

    INDEX `recommendation_items_company_id_run_id_idx`(`company_id`, `run_id`),
    INDEX `recommendation_items_run_id_rank_index_idx`(`run_id`, `rank_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `recommendation_feedback` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `run_id` CHAR(36) NOT NULL,
    `rating` INTEGER NULL,
    `helpful` BOOLEAN NULL,
    `comment` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `recommendation_feedback_company_id_run_id_idx`(`company_id`, `run_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `recommendation_runs` ADD CONSTRAINT `recommendation_runs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `recommendation_runs` ADD CONSTRAINT `recommendation_runs_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `recommendation_runs` ADD CONSTRAINT `recommendation_runs_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `recommendation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `recommendation_items` ADD CONSTRAINT `recommendation_items_travel_trip_id_fkey` FOREIGN KEY (`travel_trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `recommendation_feedback` ADD CONSTRAINT `recommendation_feedback_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `recommendation_feedback` ADD CONSTRAINT `recommendation_feedback_run_id_fkey` FOREIGN KEY (`run_id`) REFERENCES `recommendation_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
