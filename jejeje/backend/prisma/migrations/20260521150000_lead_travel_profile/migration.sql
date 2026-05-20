-- Perfil de viaje estructurado 1:1 con Lead (contrato de negocio previo a propuesta).

-- CreateEnum-like columns (MySQL native ENUM)
CREATE TABLE `lead_travel_profiles` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `destination_text` VARCHAR(500) NULL,
    `preferred_destinations` JSON NULL,
    `activities_text` TEXT NULL,
    `activity_tags` JSON NULL,
    `travel_date_text` VARCHAR(500) NULL,
    `travel_date_from` DATETIME(3) NULL,
    `travel_date_to` DATETIME(3) NULL,
    `flexible_dates` BOOLEAN NULL,
    `budget_amount` DECIMAL(14, 2) NULL,
    `budget_currency` VARCHAR(8) NOT NULL DEFAULT 'EUR',
    `budget_type` ENUM('PER_PERSON', 'TOTAL', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `trip_type` ENUM('VACATIONAL', 'HONEYMOON', 'GROUP', 'FAMILY', 'BUSINESS', 'OTHER', 'UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
    `departure_airport_text` VARCHAR(200) NULL,
    `departure_airport_code` VARCHAR(12) NULL,
    `raw_form_payload` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_travel_profiles_lead_id_key`(`lead_id`),
    INDEX `lead_travel_profiles_company_id_lead_id_idx`(`company_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `lead_travel_profiles`
ADD CONSTRAINT `lead_travel_profiles_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lead_travel_profiles`
ADD CONSTRAINT `lead_travel_profiles_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
