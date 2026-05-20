-- Travel Media Enrichment: assets en BD (URLs Unsplash/Pexels), jobs de enriquecimiento async.

CREATE TABLE `travel_media_assets` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `source_provider` ENUM('UNSPLASH', 'PEXELS') NOT NULL,
    `query_used` VARCHAR(500) NOT NULL,
    `image_url` VARCHAR(2048) NOT NULL,
    `thumbnail_url` VARCHAR(2048) NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `photographer_name` VARCHAR(200) NULL,
    `photographer_url` VARCHAR(500) NULL,
    `provider_asset_id` VARCHAR(120) NOT NULL,
    `location_hint` VARCHAR(500) NULL,
    `tags` JSON NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_media_assets_trip_id_idx`(`trip_id`),
    INDEX `travel_media_assets_company_id_idx`(`company_id`),
    INDEX `travel_media_assets_provider_asset_id_idx`(`provider_asset_id`),
    INDEX `travel_media_assets_is_primary_idx`(`is_primary`),
    UNIQUE INDEX `travel_media_assets_company_id_trip_id_source_provider_prov_key`(`company_id`, `trip_id`, `source_provider`, `provider_asset_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `travel_media_jobs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'PARTIAL', 'FAILED') NOT NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `error_message` TEXT NULL,
    `query_summary` VARCHAR(2000) NULL,
    `provider_used` VARCHAR(40) NULL,
    `assets_created` INTEGER NOT NULL DEFAULT 0,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_media_jobs_company_id_trip_id_idx`(`company_id`, `trip_id`),
    INDEX `travel_media_jobs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `travel_media_assets` ADD CONSTRAINT `travel_media_assets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `travel_media_assets` ADD CONSTRAINT `travel_media_assets_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `travel_media_jobs` ADD CONSTRAINT `travel_media_jobs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `travel_media_jobs` ADD CONSTRAINT `travel_media_jobs_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
