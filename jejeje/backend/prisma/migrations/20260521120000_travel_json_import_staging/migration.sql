-- Staging para importación manual de viajes JSON (sin tocar pipeline PDF).

ALTER TABLE `travel_trips` ADD COLUMN `import_slug` VARCHAR(200) NULL;

CREATE UNIQUE INDEX `travel_trips_company_id_import_slug_key` ON `travel_trips`(`company_id`, `import_slug`);

CREATE TABLE `travel_json_import_batches` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `uploaded_by_user_id` CHAR(36) NOT NULL,
    `file_name` VARCHAR(500) NOT NULL,
    `status` ENUM('UPLOADED', 'VALIDATED', 'PARTIAL_ERRORS', 'APPROVED', 'IMPORTED', 'FAILED') NOT NULL,
    `total_items` INTEGER NOT NULL,
    `valid_items` INTEGER NOT NULL,
    `invalid_items` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_json_import_batches_company_id_created_at_idx`(`company_id`, `created_at`),
    INDEX `travel_json_import_batches_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `travel_json_import_items` (
    `id` CHAR(36) NOT NULL,
    `batch_id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `source_json` JSON NOT NULL,
    `normalized_json` JSON NOT NULL,
    `validation_status` ENUM('VALID', 'WARNING', 'INVALID') NOT NULL,
    `validation_errors` JSON NOT NULL,
    `validation_warnings` JSON NOT NULL,
    `imported_trip_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_json_import_items_batch_id_validation_status_idx`(`batch_id`, `validation_status`),
    INDEX `travel_json_import_items_company_id_batch_id_idx`(`company_id`, `batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `travel_json_import_batches` ADD CONSTRAINT `travel_json_import_batches_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `travel_json_import_batches` ADD CONSTRAINT `travel_json_import_batches_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `travel_json_import_items` ADD CONSTRAINT `travel_json_import_items_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `travel_json_import_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `travel_json_import_items` ADD CONSTRAINT `travel_json_import_items_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `travel_json_import_items` ADD CONSTRAINT `travel_json_import_items_imported_trip_id_fkey` FOREIGN KEY (`imported_trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
