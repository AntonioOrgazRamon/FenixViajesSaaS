-- Preferencias de perfil aditivas (sin borrado de datos).
ALTER TABLE `users` ADD COLUMN `display_name` VARCHAR(150) NULL;
ALTER TABLE `users` ADD COLUMN `time_format` VARCHAR(8) NULL;
ALTER TABLE `users` ADD COLUMN `date_format` VARCHAR(16) NULL;
