# Tareas pendientes

Listado de lo que **falta por cerrar** en el producto, con prioridad a **autenticación y envío de correo** (recuperación de contraseña).

---

## 1. Recuperación de contraseña y envío de correo (estado y pasos)

### Qué ya está hecho (código)

- Flujo “He olvidado mi contraseña” en login, pantallas, API, tokens (SHA-256), política de contraseña, revocación de sesiones y auditoría.
- Configuración en `apps/api/.env` de `EMAIL_FROM`, Gmail (`SMTP_HOST`, `SMTP_USER`, etc.). El remitente actual puede ser el que tengas puesto (p. ej. un Gmail dedicado a pruebas).

### Qué falta para considerar **esta parte terminada** en un entorno real

El código envía el correo **solo si** el servidor puede autenticarse contra Gmail (u otro SMTP) con credenciales válidas. Hoy lo habitual es que **falte** la clave de aplicación o un buzón definitivo.

#### Pasos exactos que quedan (en orden)

1. **Decidir el buzón emisor (recomendado para producción)**  
   - Opción A: un **Gmail nuevo** solo para la app (pruebas), con **verificación en dos pasos** activa.  
   - Opción B (mejor para clientes): un correo en **tu dominio** (`noreply@…`, `soporte@…`) y SMTP del proveedor (Hostinger, Google Workspace, Resend, etc.).

2. **Crear la contraseña de aplicación (si usas Gmail)**  
   - Cuenta Google del buzón emisor → [Contraseñas de aplicación](https://myaccount.google.com/apppasswords).  
   - Generar una clave de 16 caracteres (sin espacios).

3. **Editar `apps/api/.env`** (o el `.env` del despliegue) y completar, al menos:  
   - `EMAIL_FROM=` el correo que verá el usuario como remitente.  
   - `SMTP_USER=` (si no lo pones, el código usa el mismo que `EMAIL_FROM`).  
   - `SMTP_PASS=` la contraseña de aplicación (16 caracteres), **nunca** la contraseña normal de la cuenta.  
   - Comprobar `SMTP_HOST`, `SMTP_PORT` y `SMTP_SECURE` según el proveedor (Gmail: `smtp.gmail.com`, `587`, `false`).

4. **Reiniciar el backend** tras guardar el `.env` (el transporte SMTP se carga al arrancar el proceso).

5. **Probar el flujo completo**  
   - Ir a “He olvidado mi contraseña”, poner un email de un usuario **local** existente y activo.  
   - Revisar la bandeja (y spam) y abrir el enlace.  
   - Si no llega nada: mirar **logs del servidor** (errores SMTP) y comprobar que el usuario no sea solo OAuth puro sin contraseña (`authProvider` Google sin flujo de contraseña).

6. **Producción**  
   - Sustituir `JWT_SECRET` y `FRONTEND_BASE_URL` por valores reales.  
   - Aplicar esquema en la BD de producción (`prisma migrate` / `db push` según vuestro procedimiento).  
   - **No** subir `.env` al repositorio (debe seguir en `.gitignore`).

7. **Opcional (Windows)**  
   - Si `npx prisma generate` falla con `EPERM` al actualizar el motor de Prisma, cerrar procesos que bloqueen `node_modules` y volver a ejecutar el generate.

---

## 2. Otras tareas (fuera de autenticación / correo)

- Revisar la lista de issues o roadmap del producto (leads, viajes, superadmin, etc.) según prioridad de negocio.

---

## Criterio de “acabado” para esta sección

Se puede dar por **cerrada la parte de contraseñas y correo** cuando:

- Un usuario de prueba recibe el email de restablecimiento.  
- El enlace caduca y es de un solo uso según lo implementado.  
- Tras cambiar la contraseña, puede entrar con la nueva y las sesiones antiguas quedan invalidadas.  
- En producción, el remitente y DNS/SMTP están alineados con vuestro dominio o política de correo.

---

*Documento generado para el proyecto. Actualiza este archivo cuando cierres hitos o aparezcan nuevas dependencias.*
