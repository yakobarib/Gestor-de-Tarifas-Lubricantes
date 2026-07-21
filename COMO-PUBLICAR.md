# Cómo subir esto a tu repo de GitHub

Ya tienes creado el repo vacío en https://github.com/yakobarib/Gestor-de-Tarifas-Lubricantes.

Los archivos que necesitas subir están todos en esta carpeta (`Gestor-de-Tarifas-Lubricantes/`). Sigue estos pasos:

## Opción A — Git desde PowerShell (recomendado)

Abre **PowerShell** (Win+R → `powershell`) y ejecuta línea a línea:

```powershell
cd "C:\Users\RIB\Documents\DOCUMENTOS RIB\DOCUMENTOS\CLAUDE\Proyectos\Optimizador de Precios\Gestor-de-Tarifas-Lubricantes"
git init
git branch -M main
git remote add origin https://github.com/yakobarib/Gestor-de-Tarifas-Lubricantes.git
git add .
git commit -m "v0.1 - MVP Repsol + documentacion inicial"
git push -u origin main
```

Notas importantes:
- **La ruta hay que darla completa** (PowerShell no adivina en qué carpeta estás salvo que uses `cd` primero).
- **PowerShell 5 no soporta `&&`**: ejecuta los comandos uno a uno, o pega el bloque completo — PowerShell los ejecuta en orden.
- Evita acentos en el mensaje del commit para no tener problemas de codificación en Windows.
- Si es la primera vez que empujas a GitHub desde este ordenador te pedirá autenticación:
  - **Fácil**: instala [GitHub CLI](https://cli.github.com/) y ejecuta `gh auth login` antes del `push`.
  - **Manual**: te abrirá el navegador para hacer login con tu cuenta de GitHub.
  - **Token**: crea un [Personal Access Token](https://github.com/settings/tokens) y úsalo como contraseña.

## Opción B — GitHub Desktop

Si tienes [GitHub Desktop](https://desktop.github.com/):

1. **File** → **Add local repository** → selecciona esta carpeta `Gestor-de-Tarifas-Lubricantes`.
2. Si te dice "This directory does not appear to be a Git repository", pulsa **create a repository** al final del mensaje.
3. Repository name: `Gestor-de-Tarifas-Lubricantes`.
4. Publica en GitHub como remoto. Marca "keep this code private" **si quieres el repo privado** (nota: GitHub Pages en repo privado requiere plan de pago).
5. Commit todo con mensaje `v0.1 — MVP Repsol + documentación inicial`.
6. **Push origin**.

## Activar GitHub Pages (después del primer push)

1. Ve al repo en https://github.com/yakobarib/Gestor-de-Tarifas-Lubricantes
2. **Settings** → **Pages** (en el menú lateral).
3. **Source**: elige *GitHub Actions* (recomendado) — usará el workflow `.github/workflows/pages.yml` que ya está incluido.
   - Alternativa: *Deploy from a branch* → `main` → `/ (root)`.
4. Guarda.
5. Espera 1-2 min. La pestaña **Actions** te muestra el progreso del deploy.
6. Cuando termine verás la URL: **https://yakobarib.github.io/Gestor-de-Tarifas-Lubricantes/**
   - La landing page es `index.html` en la raíz.
   - La app en sí está en `/app/index.html`, o accesible desde el botón "Abrir la app" del landing.

## Estructura del repo

```
Gestor-de-Tarifas-Lubricantes/
├── README.md              ← visible al entrar en GitHub
├── CHANGELOG.md
├── LICENSE
├── COMO-PUBLICAR.md       ← este archivo (puedes borrarlo tras subirlo)
├── .gitignore
├── index.html             ← landing page (Pages)
├── app/
│   └── index.html         ← la app funcional
├── docs/
│   ├── arquitectura.md
│   ├── roadmap.md
│   ├── reglas-negocio.md
│   ├── decisiones/
│   │   ├── 0001-single-file-html.md
│   │   ├── 0002-margen-sobre-venta.md
│   │   ├── 0003-parser-litros.md
│   │   └── 0004-github-pages.md
│   └── proveedores/
│       ├── README.md
│       ├── repsol.md
│       ├── ad-parts.md
│       ├── castrol.md
│       ├── eni-live.md
│       ├── racing-oil.md
│       ├── krafft.md
│       └── shell.md
└── .github/
    └── workflows/
        └── pages.yml      ← deploy automático
```

## Datos sensibles

El `.gitignore` **excluye automáticamente** las tarifas reales de proveedores. No aparecerán en el repo público. Los datos siguen en tu ordenador local (`TARIFAS ACTUALIZADAS/`, `EJEMPLOS TARIFAS/`, etc.).
