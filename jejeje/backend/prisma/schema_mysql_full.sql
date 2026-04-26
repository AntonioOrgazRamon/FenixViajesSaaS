-- =============================================================================
-- Esquema MySQL completo (MVP SaaS + leads + perfil ampliado)
-- Generado con: npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- Fecha: 2026-04
--
-- Uso en base VACIA:
--   mysql -u USER -p DATABASE < prisma/schema_mysql_full.sql
--
-- NO ejecutar sobre una BD con datos sin backup: fallará si las tablas ya existen.
-- Para alinear sin SQL manual: npx prisma db push (desarrollo) o migraciones Prisma.
-- =============================================================================

-- CreateTable
CREATE TABLE `companies` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(150) NOT NULL,
    `slug` VARCHAR(100) NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `suspended_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_by` CHAR(36) NULL,
    `integration_token` VARCHAR(64) NULL,

    UNIQUE INDEX `companies_slug_key`(`slug`),
    UNIQUE INDEX `companies_integration_token_key`(`integration_token`),
    INDEX `companies_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(191) NOT NULL,
    `role` ENUM('SUPER_ADMIN', 'COMPANY_ADMIN', 'COMPANY_USER') NOT NULL,
    `status` ENUM('ACTIVE', 'SUSPENDED', 'LOCKED', 'DELETED') NOT NULL DEFAULT 'ACTIVE',
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NULL,
    `locale` VARCHAR(191) NULL,
    `timezone` VARCHAR(191) NULL,
    `avatar_url` VARCHAR(500) NULL,
    `theme` ENUM('LIGHT', 'DARK', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    `google_id` VARCHAR(255) NULL,
    `auth_provider` ENUM('LOCAL', 'GOOGLE', 'LOCAL_GOOGLE') NOT NULL DEFAULT 'LOCAL',
    `failed_login_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `last_login_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_google_id_key`(`google_id`),
    INDEX `users_company_id_role_status_idx`(`company_id`, `role`, `status`),
    INDEX `users_company_id_status_idx`(`company_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NULL,
    `refresh_token_hash` VARCHAR(191) NOT NULL,
    `device_name` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_seen_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `revoked_at` DATETIME(3) NULL,
    `revoked_reason` VARCHAR(191) NULL,

    INDEX `sessions_user_id_revoked_at_expires_at_idx`(`user_id`, `revoked_at`, `expires_at`),
    INDEX `sessions_company_id_revoked_at_idx`(`company_id`, `revoked_at`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `password_reset_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `used_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `password_reset_tokens_user_id_idx`(`user_id`),
    INDEX `password_reset_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NULL,
    `actor_user_id` CHAR(36) NULL,
    `actor_role` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `target_type` VARCHAR(191) NOT NULL,
    `target_id` VARCHAR(191) NOT NULL,
    `target_company_id` CHAR(36) NULL,
    `result` VARCHAR(191) NOT NULL,
    `reason` VARCHAR(191) NULL,
    `ip_address` VARCHAR(191) NULL,
    `user_agent` VARCHAR(191) NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_company_id_created_at_idx`(`company_id`, `created_at`),
    INDEX `audit_logs_actor_user_id_created_at_idx`(`actor_user_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `password_reset_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_user_id_fkey` FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_details` ADD CONSTRAINT `lead_details_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_details` ADD CONSTRAINT `lead_details_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_activities` ADD CONSTRAINT `lead_activities_actor_user_id_fkey` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_notes` ADD CONSTRAINT `lead_notes_author_user_id_fkey` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_agent_runs` ADD CONSTRAINT `lead_agent_runs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_agent_runs` ADD CONSTRAINT `lead_agent_runs_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

