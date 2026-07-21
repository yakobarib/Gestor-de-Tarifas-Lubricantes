# ADR 0004 — GitHub Pages para publicación

**Fecha:** 2026-07-21
**Estado:** Aceptada
**Decidido por:** Yako

## Contexto

Se necesita un lugar accesible para:
1. Publicar la app en un URL estable que se pueda abrir desde cualquier ordenador.
2. Documentar el proceso y las decisiones de forma versionada.
3. Ir versionando (v0.1 → v0.2 → …) con historial y changelog.

## Decisión

**GitHub como repositorio de código y documentación, GitHub Pages como servidor estático de la app.**

Repo: https://github.com/yakobarib/Gestor-de-Tarifas-Lubricantes
URL de la app en vivo: https://yakobarib.github.io/Gestor-de-Tarifas-Lubricantes/app/

## Motivación

- **Gratis y sin límite práctico** para un repo público con tráfico bajo.
- **CDN global**: la app carga rápido desde cualquier ubicación.
- **HTTPS de serie**: sin configuración.
- **Historial de cambios integrado**: cada versión es un commit.
- **Markdown como documentación**: se lee bien tanto en GitHub como en cualquier editor.

## Configuración

Enlazar Pages a la carpeta raíz de la rama `main`:

1. En el repo → **Settings** → **Pages**.
2. **Source**: **Deploy from a branch** (importante: NO usar "GitHub Actions" para este proyecto).
3. **Branch**: `main` / `/ (root)`.
4. Guardar.

El deploy tarda 1-2 minutos tras cada push a `main`. El estado se ve en la pestaña **Actions** como workflow `pages build and deployment` (workflow interno de GitHub, no requiere ningún archivo YAML en el repo).

### Por qué NO usamos un workflow custom

Inicialmente el repo incluía un workflow custom `.github/workflows/pages.yml` para el modo "GitHub Actions". Se eliminó el 2026-07-21 porque:

- La app es HTML estático puro (sin build, sin `npm install`). El workflow custom no hacía ningún procesamiento — solo copiaba archivos.
- El workflow custom se disparaba con `on: push: branches: [main]` **además** del workflow interno que GitHub ejecuta cuando Pages está en modo "Deploy from a branch". Resultado: dos deploys por cada push, doblando consumo de minutos de Actions y añadiendo ruido a la pestaña Actions.
- No hay ninguna ventaja de mantener el custom para HTML estático puro. La configuración built-in cubre este caso perfectamente.

Si en el futuro se añade cualquier build step (por ejemplo, minificación, compilación de Tailwind, generación estática de docs con MkDocs), habría que reintroducir un workflow custom.

## Estructura publicada

```
https://yakobarib.github.io/Gestor-de-Tarifas-Lubricantes/
├── app/index.html         ← la app funcional
└── (docs se leen en github.com como markdown)
```

Los archivos `.md` en `docs/` se leen directamente en la interfaz de GitHub (no necesitan Pages). Si en el futuro se quiere un sitio de documentación más elaborado, se puede añadir MkDocs o Docusaurus.

## Alternativas descartadas

- **Vercel / Netlify**: potentes pero overkill para HTML estático de una página.
- **Servidor propio (VPS, S3)**: coste y mantenimiento sin beneficio.
- **Compartir el `.html` por email o Drive**: sin versionado ni URL estable.

## Datos sensibles

**Las tarifas reales de proveedores NO se suben al repo**. Están en el `.gitignore`:

- `TARIFAS ACTUALIZADAS/`
- `EJEMPLOS TARIFAS/`
- `CONSIDERACIONES/`
- `Ecoembes y Genci/`
- Excels y PDFs de `BASE DE CONOCIMIENTO/`

El repo contiene solo código y documentación. Los datos siguen en el ordenador local de Yako.

## Consecuencias

### Positivas
- URL pública estable para compartir la app con compañeros de trabajo.
- Historial completo de cambios versionados.
- Backup implícito del código en la nube.

### Negativas / trade-offs
- Al ser público, cualquiera puede ver el código. La app no tiene secretos (todo corre en cliente); la información sensible (precios de proveedor) no está en el repo.
- Si en el futuro se quiere hacer el repo privado, GitHub Pages en repo privado requiere plan de pago (o usar otra opción de hosting).
