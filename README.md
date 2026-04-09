# FenixViajesSaaS

tu raza payo

















14. Checklist de producción
Producción general
 HTTPS obligatorio
 secretos fuera del código
 variables de entorno seguras
 rotación de secretos
 backups verificados
 restore probado
 migraciones controladas
 healthchecks configurados
 monitorización activa
 alertas activas
 rate limiting activo
 logs centralizados
 auditoría persistida
 entornos separados
 acceso a producción limitado
 MFA en cuentas críticas
15. Checklist de seguridad mínima
 Argon2id o bcrypt fuerte
 access token corto
 refresh token rotatorio
 refresh reuse detection
 revocación de sesiones implementada
 validación estado usuario en cada request
 validación estado tenant en cada request
 protección anti-IDOR
 whitelists de campos por endpoint
 CORS restringido
 no logging de secretos
 brute force protection
 forgot password sin enumeración
 soft delete consistente
 eventos críticos auditados
 MFA para SuperAdmin
16. Checklist backend listo para deploy
 contratos de API cerrados
 validaciones por schema en todos los endpoints
 catálogo de errores unificado
 middlewares completos
 tests unitarios críticos
 tests de integración auth
 tests de roles y permisos
 tests anti-cross-tenant
 tests de estados inválidos
 tests de concurrencia en acciones críticas
 logs estructurados con request_id
 auditoría implementada
 límites de paginación
 límites de tamaño de payload
 timeout y circuit breakers si aplica
 documentación operativa básica
 runbook de incidentes
 dashboard mínimo de producción
