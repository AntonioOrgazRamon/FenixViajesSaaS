# Resolución de Auditoría de Seguridad y Arquitectura

Este documento detalla las vulnerabilidades, fallas de lógica y riesgos de producción detectados durante la auditoría técnica extrema del sistema, así como las soluciones implementadas para resolver cada uno de ellos.

---

## 🔴 VULNERABILIDADES CRÍTICAS RESUELTAS

### 1. Denegación de Servicio (DoS) masiva por colapso del Event Loop en Refresh Token
- **Problema:** En `auth.service.ts` (`refresh`), el sistema hacía un `findMany` de **todas** las sesiones activas y ejecutaba un bucle `for` con `bcrypt.compare` contra cada una de ellas. Esto bloqueaba el hilo principal de Node.js, permitiendo que una sola petición congelara el backend.
- **Solución implementada:** Se ha cambiado el formato del `refresh_token` emitido al cliente a `sessionId:uuid`. Ahora, el endpoint de `refresh` extrae el `sessionId`, busca la sesión específica en la base de datos mediante su ID (índice primario) y ejecuta `bcrypt.compare` únicamente contra el hash de esa sesión específica. El tiempo de procesamiento pasó de `O(N)` a `O(1)`.

### 2. Escalada de Privilegios y Fuga Cross-Tenant (Mass Assignment)
- **Problema:** En `user.controller.ts` (`updateUser`), el sistema permitía que un `COMPANY_ADMIN` enviara un payload con `{"role": "SUPER_ADMIN", "companyId": "uuid-de-otra-empresa"}`, lo que resultaba en una escalada de privilegios a nivel global o el secuestro de usuarios hacia otros tenants.
- **Solución implementada:** Se ha modificado el controlador para que, si el usuario que realiza la petición es un `COMPANY_ADMIN`, se eliminen automáticamente los campos `role` y `companyId` del payload (`delete parsed.data.role; delete parsed.data.companyId;`), forzando a que solo un `SUPER_ADMIN` pueda modificar estos campos críticos.

### 3. Sesiones huérfanas tras borrado lógico o suspensión (Zombie Sessions)
- **Problema:** En `user.service.ts`, al eliminar (`DELETED`) o suspender (`SUSPENDED`) a un usuario, el sistema actualizaba el estado pero **no revocaba las sesiones activas**. El usuario podía seguir operando hasta que su `access_token` caducara.
- **Solución implementada:** Se ha añadido lógica en `user.service.ts` para que, ante cualquier cambio de estado a `SUSPENDED`, `LOCKED` o `DELETED`, se ejecute un `prisma.session.updateMany` que revoca inmediatamente todas las sesiones activas del usuario (`revokedAt = new Date()`).

---

## 🟠 FALLAS IMPORTANTES DE LÓGICA RESUELTAS

### 1. Protección contra Brute Force inoperante
- **Problema:** En `auth.service.ts` (`login`), si la contraseña fallaba, se incrementaba `failedLoginAttempts`, pero nunca se evaluaba si se superaba el límite, ni se establecía el campo `lockedUntil`. El sistema era 100% vulnerable a ataques de fuerza bruta.
- **Solución implementada:** Se ha añadido lógica para que, si `failedLoginAttempts` alcanza 5 intentos fallidos, el estado del usuario cambie automáticamente a `LOCKED`, se establezca `lockedUntil` a 15 minutos en el futuro, y se revoquen todas sus sesiones activas.

### 2. Violación de protección del último administrador (`LAST_ACTIVE_ADMIN_PROTECTION`)
- **Problema:** Un `COMPANY_ADMIN` podía eliminarse a sí mismo o degradarse a `COMPANY_USER`, dejando el tenant completamente huérfano e inoperable.
- **Solución implementada:** En `user.service.ts` (`updateUser` y `deleteUser`), antes de eliminar, suspender o degradar a un `COMPANY_ADMIN`, se realiza un `prisma.user.count` para verificar cuántos administradores activos quedan en la empresa. Si es el último, se lanza un error `ForbiddenError('No puedes eliminar o degradar al último administrador activo de la empresa')`.

### 3. Creación de empresa no atómica
- **Problema:** La creación de la empresa y su administrador inicial no se realizaba en una única transacción, lo que podía dejar empresas huérfanas si fallaba la creación del usuario.
- **Solución implementada:** Se ha verificado y asegurado que `company.service.ts` (`create`) utilice un `prisma.$transaction` para insertar tanto el registro en la tabla `companies` como el registro en la tabla `users` de forma completamente atómica.

---

## 🟡 DESVIACIONES DEL DOCUMENTO RESUELTAS

### 1. Endpoints obligatorios omitidos
- **Problema:** Faltaban endpoints críticos especificados en el documento de arquitectura.
- **Solución implementada:**
  - Se ha añadido `POST /api/v1/auth/change-password` en `auth.controller.ts` y `auth.service.ts` para permitir a los usuarios autenticados cambiar su contraseña.
  - Se ha añadido `POST /api/v1/sessions/users/:id/revoke` en `session.controller.ts` para permitir a los administradores revocar todas las sesiones de un usuario específico.

### 2. Auditoría incompleta (Eventos perdidos)
- **Problema:** No se estaban registrando los eventos `AUTH_LOGIN_FAILED`, `AUTH_LOGOUT` y `AUTH_REFRESH_SUCCESS`.
- **Solución implementada:** Se han añadido las llamadas a `prisma.auditLog.create` correspondientes en `auth.service.ts` para cubrir todos estos flujos, incluyendo el motivo (`reason`) en caso de fallo de login.

---

## ⚫ RIESGOS EN PRODUCCIÓN RESUELTOS

### 1. Colapso de memoria por falta de paginación
- **Problema:** Los endpoints de listado (`getUsers`, `getSessions`, `getAuditLogs`) hacían un `findMany` sin límites (`take` ni `skip`). En producción, esto saturaría la RAM de Node.js.
- **Solución implementada:** Se han añadido los parámetros de consulta `page` y `pageSize` a los controladores, esquemas y servicios correspondientes. Ahora todas las consultas utilizan `skip` y `take` para implementar paginación del lado del servidor (Server-Side Pagination).

### 2. Validación de estado fantasma en middlewares
- **Problema:** El middleware `requireAuth` solo validaba la firma del JWT, permitiendo que usuarios o empresas suspendidas siguieran operando si su token aún no había expirado.
- **Solución implementada:** Se ha asegurado que el middleware `requireAuth` (en `common/middlewares/auth.ts`) realice una consulta a la base de datos (`prisma.user.findUnique({ include: { company: true } })`) en cada petición para verificar en tiempo real que tanto el estado del usuario como el de su empresa sigan siendo `ACTIVE`. En caso contrario, la petición es rechazada inmediatamente con un `403 Forbidden`.