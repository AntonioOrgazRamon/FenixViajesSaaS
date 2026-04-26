# Renombrar `jejeje` → `saas_practicas_nakedcode`

El nombre oficial de la carpeta del producto es **`saas_practicas_nakedcode`**. Si aún ves **`jejeje`**, el editor u otro proceso puede estar bloqueando el directorio.

## Pasos (Windows / PowerShell)

1. **Cierra** Cursor, VS Code o cualquier terminal con `cd` dentro de `jejeje`.
2. Abre PowerShell y ejecuta:

```powershell
cd c:\PRACTICAS_SAAS
Rename-Item -Path "jejeje" -NewName "saas_practicas_nakedcode"
```

3. Vuelve a abrir en Cursor la carpeta **`c:\PRACTICAS_SAAS`** (o `saas_practicas_nakedcode` directamente).

## Con Git (alternativa)

Con el IDE cerrado, desde `c:\PRACTICAS_SAAS`:

```powershell
git mv jejeje saas_practicas_nakedcode
```

Luego abre el proyecto de nuevo y revisa con `git status`.
