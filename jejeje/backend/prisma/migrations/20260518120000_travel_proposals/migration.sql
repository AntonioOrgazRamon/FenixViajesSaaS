-- Propuestas comerciales de viajes por lead (entidad Proposal + versionado + viajes seleccionados).

-- CreateTable
CREATE TABLE `proposals` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `lead_id` CHAR(36) NOT NULL,
    `created_by_user_id` CHAR(36) NULL,
    `assigned_user_id` CHAR(36) NULL,
    `status` ENUM('DRAFT', 'GENERATED', 'SENT_TO_SELLER', 'SENT_TO_CLIENT', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `proposals_company_id_lead_id_created_at_idx`(`company_id`, `lead_id`, `created_at`),
    INDEX `proposals_company_id_status_updated_at_idx`(`company_id`, `status`, `updated_at`),
    INDEX `proposals_lead_id_idx`(`lead_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal_versions` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `proposal_id` CHAR(36) NOT NULL,
    `version_number` INTEGER NOT NULL,
    `intent_snapshot` JSON NULL,
    `generated_html` LONGTEXT NULL,
    `pdf_storage_path` VARCHAR(1000) NULL,
    `pdf_public_url` VARCHAR(1000) NULL,
    `created_by_user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `proposal_versions_company_id_proposal_id_idx`(`company_id`, `proposal_id`),
    INDEX `proposal_versions_proposal_id_created_at_idx`(`proposal_id`, `created_at`),
    UNIQUE INDEX `proposal_versions_proposal_id_version_number_key`(`proposal_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal_trips` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `proposal_version_id` CHAR(36) NOT NULL,
    `travel_trip_id` CHAR(36) NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,
    `score` DOUBLE NULL,
    `reasons` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `proposal_trips_company_id_proposal_version_id_idx`(`company_id`, `proposal_version_id`),
    INDEX `proposal_trips_travel_trip_id_idx`(`travel_trip_id`),
    UNIQUE INDEX `proposal_trips_proposal_version_id_travel_trip_id_key`(`proposal_version_id`, `travel_trip_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `proposal_artifacts` (
    `id` CHAR(36) NOT NULL,
    `company_id` CHAR(36) NOT NULL,
    `proposal_version_id` CHAR(36) NOT NULL,
    `kind` ENUM('PDF', 'HTML_FILE', 'ATTACHMENT', 'OTHER') NOT NULL,
    `storage_path` VARCHAR(1000) NOT NULL,
    `public_url` VARCHAR(1000) NULL,
    `mime_type` VARCHAR(120) NULL,
    `file_size` INTEGER NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `proposal_artifacts_company_id_proposal_version_id_idx`(`company_id`, `proposal_version_id`),
    INDEX `proposal_artifacts_company_id_kind_idx`(`company_id`, `kind`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposals` ADD CONSTRAINT `proposals_assigned_user_id_fkey` FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_versions` ADD CONSTRAINT `proposal_versions_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_versions` ADD CONSTRAINT `proposal_versions_proposal_id_fkey` FOREIGN KEY (`proposal_id`) REFERENCES `proposals`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_versions` ADD CONSTRAINT `proposal_versions_created_by_user_id_fkey` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_trips` ADD CONSTRAINT `proposal_trips_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_trips` ADD CONSTRAINT `proposal_trips_proposal_version_id_fkey` FOREIGN KEY (`proposal_version_id`) REFERENCES `proposal_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_trips` ADD CONSTRAINT `proposal_trips_travel_trip_id_fkey` FOREIGN KEY (`travel_trip_id`) REFERENCES `travel_trips`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_artifacts` ADD CONSTRAINT `proposal_artifacts_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `proposal_artifacts` ADD CONSTRAINT `proposal_artifacts_proposal_version_id_fkey` FOREIGN KEY (`proposal_version_id`) REFERENCES `proposal_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
