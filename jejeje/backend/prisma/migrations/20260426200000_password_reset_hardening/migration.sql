-- Limpia tokens heredados (p. ej. hashes bcrypt) antes de añadir UNIQUE y nuevas columnas
DELETE FROM `password_reset_tokens`;

-- Campos de auditoría de la solicitud
ALTER TABLE `password_reset_tokens` ADD COLUMN `requested_ip` VARCHAR(64) NULL;
ALTER TABLE `password_reset_tokens` ADD COLUMN `user_agent` VARCHAR(500) NULL;

-- token_hash: longitud 64 para SHA-256 hex; índice único para búsqueda O(1)
-- En tablas con datos previos ya vacíos por DELETE
ALTER TABLE `password_reset_tokens` MODIFY COLUMN `token_hash` VARCHAR(64) NOT NULL;
CREATE UNIQUE INDEX `password_reset_tokens_token_hash_key` ON `password_reset_tokens`(`token_hash`);
