-- Avatar / identidad: preferencias de avatar por defecto y metadata de subida (ruta, no binario en BD)

ALTER TABLE `users` ADD COLUMN `avatar_type` ENUM('DEFAULT', 'UPLOADED') NOT NULL DEFAULT 'DEFAULT',
  ADD COLUMN `avatar_background_color` VARCHAR(7) NULL,
  ADD COLUMN `avatar_text_color` VARCHAR(7) NULL,
  ADD COLUMN `avatar_initials` VARCHAR(3) NULL,
  ADD COLUMN `avatar_shape` ENUM('CIRCLE', 'ROUNDED', 'SQUARE') NOT NULL DEFAULT 'CIRCLE';

-- Subidas locales o URLs almacenadas (legacy) → tipo UPLOADED; sin imagen → DEFAULT
UPDATE `users` SET `avatar_type` = 'UPLOADED' WHERE `avatar_url` IS NOT NULL AND `avatar_url` <> '';

UPDATE `users` SET `avatar_background_color` = '#2563EB' WHERE `avatar_background_color` IS NULL;
UPDATE `users` SET `avatar_text_color` = '#FFFFFF' WHERE `avatar_text_color` IS NULL;
