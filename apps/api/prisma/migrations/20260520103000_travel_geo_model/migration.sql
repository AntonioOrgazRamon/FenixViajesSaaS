-- CreateTable geo taxonomy + trip links (progressive model; legacy Destination untouched).

CREATE TABLE `geo_places` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `kind` ENUM('CONTINENT', 'MACRO_REGION', 'COUNTRY', 'REGION', 'CITY', 'ISLAND', 'AREA', 'ATTRACTION', 'POI') NOT NULL,
    `canonical_name` VARCHAR(255) NOT NULL,
    `normalized_key` VARCHAR(255) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `external_ref` VARCHAR(120) NULL,
    `legacy_destination_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `geo_places_legacy_destination_id_key`(`legacy_destination_id`),
    UNIQUE INDEX `geo_places_company_id_normalized_key_kind_key`(`company_id`, `normalized_key`, `kind`),
    INDEX `geo_places_company_id_normalized_key_idx`(`company_id`, `normalized_key`),
    INDEX `geo_places_company_id_kind_idx`(`company_id`, `kind`),
    INDEX `geo_places_parent_id_idx`(`parent_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `trip_geo_places` (
    `trip_id` CHAR(36) NOT NULL,
    `geo_place_id` CHAR(36) NOT NULL,
    `role` ENUM('PRIMARY', 'STOP', 'TRANSIT', 'OPTIONAL') NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `confidence` DOUBLE NULL,
    `source` ENUM('MANUAL', 'IMPORT', 'AI', 'BACKFILL') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `trip_geo_places_trip_id_idx`(`trip_id`),
    INDEX `trip_geo_places_geo_place_id_idx`(`geo_place_id`),
    PRIMARY KEY (`trip_id`, `geo_place_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `geo_places` ADD CONSTRAINT `geo_places_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `geo_places` ADD CONSTRAINT `geo_places_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `geo_places`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `trip_geo_places` ADD CONSTRAINT `trip_geo_places_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `trip_geo_places` ADD CONSTRAINT `trip_geo_places_geo_place_id_fkey` FOREIGN KEY (`geo_place_id`) REFERENCES `geo_places`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
