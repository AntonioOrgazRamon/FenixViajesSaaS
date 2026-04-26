-- Reparar filas con imagen en disco/URL pero avatar_type desincronizado (mostraba solo iniciales).
-- Ejecutar una vez si el perfil no mostraba la foto subida.
UPDATE `users`
SET `avatar_type` = 'UPLOADED'
WHERE `avatar_url` IS NOT NULL
  AND TRIM(`avatar_url`) <> ''
  AND `avatar_type` = 'DEFAULT';
