# apps/panel — contexto para agentes

Se carga solo al trabajar en esta carpeta. Las reglas firmes y la definición de «hecho» están en el [AGENTS.md raíz](../../AGENTS.md); el stack y la estructura, en [README.md](./README.md).

- Código por área en `src/features/<área>`. Estado de servidor con TanStack Query; sesión en `src/store/authStore.ts` (Zustand).
- El panel **no** decide permisos ni empresa: el API los impone. No dupliques reglas de negocio en el cliente.
- `Role` viene de `@fenix/contracts`; no vuelvas a declararlo aquí.
- Verificación: `npm run build -w apps/panel` (debe pasar) y `npm run lint -w apps/panel` (línea base: **37 errores / 3 avisos**, hallazgo H9; un cambio no puede subir esa cifra).
