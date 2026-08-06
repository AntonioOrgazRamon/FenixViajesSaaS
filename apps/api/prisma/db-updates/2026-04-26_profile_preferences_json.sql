-- Preferencias de cuenta (notificaciones) como JSON.
-- MySQL 5.7+ / 8.0: tipo JSON acepta objetos; columna nullable.

ALTER TABLE `users`
  ADD COLUMN `profile_preferences` JSON NULL
  AFTER `theme`;
