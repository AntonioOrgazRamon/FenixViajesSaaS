-- =============================================================================
-- Cambios INCREMENTALES: leads + perfil ampliado + token de integración
-- Para bases que YA tenían companies/users/sessions/audit sin estas piezas.
-- Revisa con SHOW COLUMNS / SHOW TABLES antes de ejecutar; si algo existe, omite esa parte.
-- =============================================================================

SET NAMES utf8mb4;

-- --- companies: token opcional para intake público ---
ALTER TABLE `companies`
  ADD COLUMN `integration_token` VARCHAR(64) NULL AFTER `created_by`;

ALTER TABLE `companies`
  ADD UNIQUE INDEX `companies_integration_token_key`(`integration_token`);

-- --- users: avatar, tema, Google ---
ALTER TABLE `users`
  ADD COLUMN `avatar_url` VARCHAR(500) NULL AFTER `timezone`,
  ADD COLUMN `theme` ENUM('LIGHT', 'DARK', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM' AFTER `avatar_url`,
  ADD COLUMN `google_id` VARCHAR(255) NULL AFTER `theme`,
  ADD COLUMN `auth_provider` ENUM('LOCAL', 'GOOGLE', 'LOCAL_GOOGLE') NOT NULL DEFAULT 'LOCAL' AFTER `google_id`;

ALTER TABLE `users`
  ADD UNIQUE INDEX `users_google_id_key`(`google_id`);

-- --- leads y tablas relacionadas (copiado del diff completo; orden: tablas antes de FKs) ---

CREATE TABLE `leads` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `source` ENUM('WEB_FORM', 'CHATBOT', 'PLAN_CTA', 'MANUAL', 'IMPORT', 'API', 'OTHER') NOT NULL,
    `source_detail` VARCHAR(150) NULL,
    `status` ENUM('NEW', 'QUALIFYING', 'QUALIFIED', 'CONTACTED', 'WAITING', 'CONVERTED', 'LOST', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NULL,
    `first_name` VARCHAR(120) NULL,
    `last_name` VARCHAR(120) NULL,
    `full_name` VARCHAR(255) NULL,
    `email` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `company_name` VARCHAR(180) NULL,
    `country` VARCHAR(80) NULL,
    `language` ENUM('es', 'en') NULL,
    `timezone` VARCHAR(100) NULL,
    `message` TEXT NULL,
    `raw_payload` JSON NULL,
    `normalized_payload` JSON NULL,
    `lead_score` INTEGER NULL,
    `assigned_user_id` CHAR(36) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `last_agent_run_at` DATETIME(3) NULL,
    `last_contacted_at` DATETIME(3) NULL,
    `converted_at` DATETIME(3) NULL,
    `lost_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `leads_company_id_status_created_at_idx`(`company_id`, `status`, `created_at`),
    INDEX `leads_company_id_source_created_at_idx`(`company_id`, `source`, `created_at`),
    INDEX `leads_company_id_assigned_user_id_status_idx`(`company_id`, `assigned_user_id`, `status`),
    INDEX `leads_company_id_email_idx`(`company_id`, `email`),
    INDEX `leads_company_id_phone_idx`(`company_id`, `phone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_details` (
    `id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `purchase_history` JSON NULL,
    `current_context` JSON NULL,
    `requirements` JSON NULL,
    `preferences` JSON NULL,
    `technical_snapshot` JSON NULL,
    `commercial_snapshot` JSON NULL,
    `extra_data` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lead_details_lead_id_key`(`lead_id`),
    INDEX `lead_details_company_id_lead_id_idx`(`company_id`, `lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_activities` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `actor_user_id` CHAR(36) NULL,
    `actor_type` ENUM('USER', 'SYSTEM', 'AGENT') NOT NULL,
    `activity_type` ENUM('CREATED', 'UPDATED', 'STATUS_CHANGED', 'ASSIGNED', 'NOTE_ADDED', 'AGENT_RUN', 'ENRICHED', 'QUALIFIED', 'CONTACTED', 'IMPORT', 'EXTERNAL_EVENT') NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `description` TEXT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_activities_company_id_lead_id_created_at_idx`(`company_id`, `lead_id`, `created_at`),
    INDEX `lead_activities_company_id_activity_type_created_at_idx`(`company_id`, `activity_type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_notes` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `author_user_id` CHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `lead_notes_company_id_lead_id_created_at_idx`(`company_id`, `lead_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `lead_agent_runs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `agent_key` VARCHAR(100) NOT NULL,
    `trigger_type` ENUM('ON_CREATE', 'MANUAL', 'SCHEDULED', 'ON_UPDATE') NOT NULL,
    `status` ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED') NOT NULL,
    `input_payload` JSON NULL,
    `output_payload` JSON NULL,
    `error_message` TEXT NULL,
    `started_at` DATETIME(3) NULL,
    `finished_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_agent_runs_company_id_lead_id_created_at_idx`(`company_id`, `lead_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `leads` ADD CONSTRAINT `leads_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_user_id_fkey` FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `leads` ADD CONSTRAINT `leads_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `lead_details` ADD CONSTRAINT `lead_details_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_details` ADD CONSTRAINT `lead_details_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `lead_agent_runs` ADD CONSTRAINT `lead_agent_runs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `lead_agent_runs` ADD CONSTRAINT `lead_agent_runs_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
