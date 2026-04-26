-- =============================================================================
-- ACTUALIZACIÓN INCREMENTAL: módulo catálogo de viajes + lead_details.travel_context
-- MySQL 8.0+ (recomendado 8.0.19+ para ADD COLUMN IF NOT EXISTS).
-- MariaDB: CREATE TABLE IF NOT EXISTS es compatible; "ADD COLUMN IF NOT EXISTS" puede no
--   existir — si falla, añade la columna a mano y vuelve a ejecutar el resto.
-- Cuidado: el nombre de tabla `destinations` no debe chocar con otra lógica previa.
--
-- Uso: contra una BD **existente** que ya tiene companies, users, leads, lead_details, etc.
--     mysql -u USER -p NOMBRE_BD < 2026-04-26_travel_catalog_update.sql
--   o Workbench: abrir, ejecutar todo.
--
-- Idempotencia: tablas con CREATE IF NOT EXISTS; columna con IF NOT EXISTS; FKs solo si
--   no existen aún (information_schema + procedimiento al final).
-- =============================================================================

SET @OLD_SQL_MODE = @@SQL_MODE, SQL_MODE = (SELECT REPLACE(
  REPLACE(@@SQL_MODE, 'NO_ZERO_IN_DATE,', ''), 'NO_ZERO_DATE,', ''));
-- Evita sorpresas estrictas en fechas/zeros en entornos antiguos; restaura al acabar.

-- -----------------------------------------------------------------------------
-- 1) Lead details: contexto de propuestas de viaje (FASE 9/11)
-- -----------------------------------------------------------------------------
ALTER TABLE `lead_details`
  ADD COLUMN IF NOT EXISTS `travel_context` JSON NULL;

-- -----------------------------------------------------------------------------
-- 2) Tablas del catálogo (Prisma: TravelDocument, TravelTrip, etc.)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `travel_documents` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `original_name` VARCHAR(500) NOT NULL,
    `mime_type` VARCHAR(120) NOT NULL,
    `size` INTEGER NOT NULL,
    `storage_path` VARCHAR(1000) NOT NULL,
    `status` ENUM('UPLOADED', 'PROCESSING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'UPLOADED',
    `total_pages` INTEGER NULL,
    `extracted_text_path` VARCHAR(1000) NULL,
    `error_message` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_documents_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `travel_trips` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `document_id` CHAR(36) NULL,
    `title` VARCHAR(500) NOT NULL,
    `provider` VARCHAR(255) NULL,
    `season` VARCHAR(120) NULL,
    `main_destination` VARCHAR(300) NULL,
    `description` TEXT NULL,
    `duration_days` INTEGER NULL,
    `duration_nights` INTEGER NULL,
    `indicative_price` DECIMAL(12, 2) NULL,
    `currency` VARCHAR(3) NULL,
    `status` ENUM('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `confidence_score` DOUBLE NULL,
    `source_page_start` INTEGER NULL,
    `source_page_end` INTEGER NULL,
    `raw_extracted_text` LONGTEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_trips_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
    INDEX `travel_trips_company_id_document_id_idx`(`company_id`, `document_id`),
    INDEX `travel_trips_document_id_idx`(`document_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `destinations` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `type` ENUM('COUNTRY', 'REGION', 'CITY', 'AREA', 'ATTRACTION') NOT NULL,
    `normalized_name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `destinations_company_id_normalized_name_idx`(`company_id`, `normalized_name`),
    UNIQUE INDEX `destinations_company_id_normalized_name_type_key`(`company_id`, `normalized_name`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `travel_trip_destinations` (
    `trip_id` CHAR(36) NOT NULL,
    `destination_id` CHAR(36) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    INDEX `travel_trip_destinations_destination_id_idx`(`destination_id`),
    PRIMARY KEY (`trip_id`, `destination_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_itinerary_days` (
    `id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `day_number` INTEGER NOT NULL,
    `title` VARCHAR(500) NULL,
    `description` TEXT NULL,
    `meals` TEXT NULL,
    `accommodation` TEXT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_itinerary_days_trip_id_day_number_idx`(`trip_id`, `day_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_catalog_services` (
    `id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `type` ENUM('INCLUDED', 'NOT_INCLUDED', 'OPTIONAL') NOT NULL,
    `text` TEXT NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_catalog_services_trip_id_type_idx`(`trip_id`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_departures` (
    `id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `departure_text` TEXT NOT NULL,
    `start_date` DATE NULL,
    `end_date` DATE NULL,
    `weekdays` VARCHAR(100) NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_departures_trip_id_idx`(`trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_hotels` (
    `id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `category` VARCHAR(50) NULL,
    `city` VARCHAR(150) NULL,
    `hotel_name` VARCHAR(255) NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_hotels_trip_id_idx`(`trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_highlights` (
    `id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `text` TEXT NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_highlights_trip_id_idx`(`trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `trip_observations` (
    `id` CHAR(36) NOT NULL,
    `trip_id` CHAR(36) NOT NULL,
    `text` TEXT NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `trip_observations_trip_id_idx`(`trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `travel_import_jobs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `document_id` CHAR(36) NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `current_step` VARCHAR(200) NULL,
    `progress` INTEGER NOT NULL DEFAULT 0,
    `error_message` TEXT NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `travel_import_jobs_company_id_document_id_created_at_idx`(`company_id`, `document_id`, `created_at`),
    INDEX `travel_import_jobs_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3) Claves foráneas (idempotente vía procedimiento; MySQL 8+)
-- -----------------------------------------------------------------------------
DROP PROCEDURE IF EXISTS `p_apply_travel_catalog_fks`;

DELIMITER $$

CREATE PROCEDURE `p_apply_travel_catalog_fks`()
BEGIN
  /* travel_documents -> companies */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'travel_documents' AND CONSTRAINT_NAME = 'travel_documents_company_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `travel_documents` ADD CONSTRAINT `travel_documents_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  /* travel_trips */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'travel_trips' AND CONSTRAINT_NAME = 'travel_trips_company_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `travel_trips` ADD CONSTRAINT `travel_trips_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'travel_trips' AND CONSTRAINT_NAME = 'travel_trips_document_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `travel_trips` ADD CONSTRAINT `travel_trips_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `travel_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  /* destinations */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'destinations' AND CONSTRAINT_NAME = 'destinations_company_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `destinations` ADD CONSTRAINT `destinations_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  /* travel_trip_destinations */
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'travel_trip_destinations' AND CONSTRAINT_NAME = 'travel_trip_destinations_trip_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `travel_trip_destinations` ADD CONSTRAINT `travel_trip_destinations_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'travel_trip_destinations' AND CONSTRAINT_NAME = 'travel_trip_destinations_destination_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `travel_trip_destinations` ADD CONSTRAINT `travel_trip_destinations_destination_id_fkey` FOREIGN KEY (`destination_id`) REFERENCES `destinations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trip_itinerary_days' AND CONSTRAINT_NAME = 'trip_itinerary_days_trip_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `trip_itinerary_days` ADD CONSTRAINT `trip_itinerary_days_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trip_catalog_services' AND CONSTRAINT_NAME = 'trip_catalog_services_trip_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `trip_catalog_services` ADD CONSTRAINT `trip_catalog_services_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trip_departures' AND CONSTRAINT_NAME = 'trip_departures_trip_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `trip_departures` ADD CONSTRAINT `trip_departures_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trip_hotels' AND CONSTRAINT_NAME = 'trip_hotels_trip_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `trip_hotels` ADD CONSTRAINT `trip_hotels_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trip_highlights' AND CONSTRAINT_NAME = 'trip_highlights_trip_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `trip_highlights` ADD CONSTRAINT `trip_highlights_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'trip_observations' AND CONSTRAINT_NAME = 'trip_observations_trip_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `trip_observations` ADD CONSTRAINT `trip_observations_trip_id_fkey` FOREIGN KEY (`trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'travel_import_jobs' AND CONSTRAINT_NAME = 'travel_import_jobs_company_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `travel_import_jobs` ADD CONSTRAINT `travel_import_jobs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
    WHERE CONSTRAINT_SCHEMA = DATABASE()
      AND TABLE_NAME = 'travel_import_jobs' AND CONSTRAINT_NAME = 'travel_import_jobs_document_id_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE `travel_import_jobs` ADD CONSTRAINT `travel_import_jobs_document_id_fkey` FOREIGN KEY (`document_id`) REFERENCES `travel_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$

DELIMITER ;

CALL `p_apply_travel_catalog_fks`();
DROP PROCEDURE IF EXISTS `p_apply_travel_catalog_fks`;

SET SQL_MODE = @OLD_SQL_MODE;

-- =============================================================================
-- Hecho. Comprueba: SHOW TABLES LIKE 'travel%';  DESCRIBE lead_details;
-- =============================================================================
