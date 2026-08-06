-- Post db push: backfill avatar flags y colores por defecto
UPDATE `users` SET `avatar_type` = 'UPLOADED' WHERE `avatar_url` IS NOT NULL AND `avatar_url` <> '';
UPDATE `users` SET `avatar_background_color` = '#2563EB' WHERE `avatar_background_color` IS NULL;
UPDATE `users` SET `avatar_text_color` = '#FFFFFF' WHERE `avatar_text_color` IS NULL;
