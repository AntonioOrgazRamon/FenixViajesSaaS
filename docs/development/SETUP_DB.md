# Guía de configuración de la base de datos (MySQL)

El backend usa **Prisma ORM** y una base de datos **MySQL** (compatible con **MariaDB** en Hostinger). La variable `DATABASE_URL` en `apps/api/.env` es la conexión principal.

Los identificadores son **UUID en texto (`CHAR(36)`)** a propósito: el mismo esquema de datos sirve para una **migración rápida a PostgreSQL** (cambio de `provider` en Prisma y volcado de datos). El checklist detallado está en `prisma/schema.prisma` al inicio del archivo.

**Hostinger Web / Cloud:** encaja con este proyecto: crea la base y el usuario en **hPanel → Bases de datos MySQL** y usa el host que te indiquen (a veces `localhost`, a veces un hostname tipo `mysql.hostinger.es`).

---

## Producción: MySQL en Hostinger (hosting compartido o similar)

1. Crea base de datos y usuario MySQL desde el panel; asigna todos los privilegios del usuario a esa base.
2. Anota host, puerto (suele ser **3306**), nombre de base, usuario y contraseña.
3. En `apps/api/.env`:

   ```env
   DATABASE_URL="mysql://USUARIO:CONTRASEÑA@HOST:3306/NOMBRE_BD"
   ```

   Si la contraseña tiene caracteres especiales, [codifícalos en la URL](https://www.prisma.io/docs/orm/reference/connection-urls#mysql).

4. **SSL:** si el proveedor exige conexión segura, Prisma acepta parámetros en la URL, por ejemplo `?sslaccept=strict` (consulta la documentación de tu panel).

---

## Desarrollo local: Docker (MySQL)

```bash
docker run --name saas-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=saas_db -p 3306:3306 -d mysql:8
```

Espera unos segundos a que el servidor arranque. En `apps/api/.env`:

```env
DATABASE_URL="mysql://root:root@localhost:3306/saas_db"
```

Para un usuario dedicado en lugar de `root`, créalo dentro del contenedor o monta un script de init.

---

## Desarrollo local: MySQL en Windows

Instala [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) o MariaDB, crea la base `saas_db` y un usuario con permisos sobre ella. Ejemplo de URL:

```env
DATABASE_URL="mysql://saas_user:tu_clave@localhost:3306/saas_db"
```

---

## Pasos finales (cualquier entorno)

Con `DATABASE_URL` correcta, desde la carpeta `apps/api`:

```bash
npx prisma db push
npx prisma generate
```

`db push` sincroniza tablas con `prisma/schema.prisma`. En producción prefieren a menudo **migraciones versionadas** (`prisma migrate dev` en desarrollo y `migrate deploy` en servidor); puedes adoptarlo cuando tengas flujo de despliegue claro.

**DDL en SQL puro:** el archivo `prisma/schema_full.sql` crea todas las tablas, índices y claves foráneas equivalentes al esquema Prisma (útil para importar en hPanel/phpMyAdmin sin usar la CLI). Si cambias `schema.prisma`, vuelve a generarlo con el comando indicado en la cabecera de ese `.sql`.

---

## Orientación futura: multiempresa e IA

El modelo es **multiempresa** (`Company`, `companyId` en usuarios, sesiones y auditoría). Todo lo nuevo (documentos, IA, embeddings si los guardas en BD) debería ir **filtrado por `company_id`** en consultas y tablas.

En **MySQL/MariaDB** la búsqueda vectorial nativa es más limitada que en PostgreSQL con **`pgvector`**. Si más adelante pasas a Postgres en VPS, el checklist del `schema.prisma` aplica; mientras tanto puedes usar APIs de modelos y almacenar solo metadatos y texto en MySQL.

---

## Volver a PostgreSQL (resumen)

1. Ajusta `datasource db` en `prisma/schema.prisma`: `provider = "postgresql"`.
2. Opcional: sustituye `@db.Char(36)` por `@db.Uuid` en IDs y FKs, luego migración Prisma.
3. `DATABASE_URL` con formato `postgresql://...?schema=public`.
4. Migra datos desde MySQL (herramientas tipo pgloader, o export/import controlado).
5. `npx prisma migrate deploy` (o `db push` en pruebas) y `npx prisma generate`.

Detalle ampliado en los comentarios del propio `prisma/schema.prisma`.
