-- Fase 2: embeddings por viaje + resumen de retrieval en runs.

CREATE TABLE `travel_trip_embeddings` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `dims` INTEGER NOT NULL,
    `vector` JSON NOT NULL,
    `external_vector_id` VARCHAR(200) NULL,
    `content_hash` VARCHAR(64) NOT NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NOT NULL,
    `profile_version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `travel_trip_embeddings_company_id_trip_id_model_key`(`company_id`, `trip_id`, `model`),
    INDEX `travel_trip_embeddings_company_id_trip_id_idx`(`company_id`, `trip_id`),
    INDEX `travel_trip_embeddings_company_id_content_hash_idx`(`company_id`, `content_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `travel_trip_embeddings` ADD CONSTRAINT `travel_trip_embeddings_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `travel_trip_embeddings` ADD CONSTRAINT `travel_trip_embeddings_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `recommendation_runs` ADD COLUMN `retrieval_summary` JSON NULL;
