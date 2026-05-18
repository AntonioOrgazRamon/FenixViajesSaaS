-- OpenAI usage logging, per-tenant budgets, global kill switch (BD).

CREATE TABLE `openai_usage_logs` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NULL,
    `operation_type` ENUM('INTENT_EXTRACTION', 'PROPOSAL_COPY', 'EMBEDDING', 'TRIP_PDF_EXTRACTION', 'OTHER') NOT NULL,
    `model` VARCHAR(80) NOT NULL,
    `input_tokens` INTEGER NOT NULL DEFAULT 0,
    `output_tokens` INTEGER NOT NULL DEFAULT 0,
    `total_tokens` INTEGER NOT NULL DEFAULT 0,
    `estimated_cost` DECIMAL(14, 6) NULL,
    `request_id` VARCHAR(120) NULL,
    `status` ENUM('SUCCESS', 'BLOCKED', 'ERROR', 'FALLBACK') NOT NULL,
    `error_code` VARCHAR(64) NULL,
    `duration_ms` INTEGER NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `openai_usage_logs_company_id_created_at_idx`(`company_id`, `created_at`),
    INDEX `openai_usage_logs_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `openai_usage_logs_operation_type_created_at_idx`(`operation_type`, `created_at`),
    INDEX `openai_usage_logs_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `openai_usage_budgets` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `daily_limit_euros` DECIMAL(14, 6) NULL,
    `monthly_limit_euros` DECIMAL(14, 6) NULL,
    `max_calls_per_hour` INTEGER NULL,
    `max_tokens_per_request` INTEGER NULL,
    `user_daily_limit_euros` DECIMAL(14, 6) NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,
    `hard_blocked` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `openai_usage_budgets_company_id_key`(`company_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `openai_system_state` (
    `id` VARCHAR(32) NOT NULL,
    `global_kill_switch` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `openai_usage_logs` ADD CONSTRAINT `openai_usage_logs_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `openai_usage_logs` ADD CONSTRAINT `openai_usage_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `openai_usage_budgets` ADD CONSTRAINT `openai_usage_budgets_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO `openai_system_state` (`id`, `global_kill_switch`, `updated_at`) VALUES ('default', false, CURRENT_TIMESTAMP(3));
