# Login y scraping con Playwright

Instrucciones rápidas para ejecutar el script de login automático y guardar el HTML post-login.

Pasos:

1. Crear y activar un entorno virtual (recomendado):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

2. Instalar dependencias:

```powershell
pip install -r requirements.txt
playwright install
```

3. Ejecutar el script:

```powershell
python scripts\login_and_scrape.py
```

Opciones:
- Para pasar credenciales por variables de entorno en Windows PowerShell:

```powershell
$env:MUNI_USER = 'aalvarez'
$env:MUNI_PASS = 'Alvarez-a21'
python scripts\login_and_scrape.py
```

- Para ejecutar en modo headless (por defecto el script corre headless si `MUNI_HEADLESS` es distinto de "0"):

```powershell
$env:MUNI_HEADLESS = '1'
python scripts\login_and_scrape.py
```

Resultados:
- El script guarda el HTML de la página posterior al login en `page_after_login.html`.

Siguientes pasos recomendados:
- Indícame qué datos concretos necesitas extraer del HTML y adapto el script para parsearlos y exportarlos (CSV/JSON).

## Node.js (Puppeteer)

Instrucciones para ejecutar la versión en Node.js usando `puppeteer`.

1. Instalar dependencias:

```powershell
npm install
```

Nota: `puppeteer` descargará automáticamente una versión compatible de Chromium durante la instalación.

2. Ejecutar el script:

```powershell
node scripts\login_and_scrape.js
```

Pasar credenciales por variables de entorno en PowerShell:

```powershell
$env:MUNI_USER = 'aalvarez'
$env:MUNI_PASS = 'Alvarez-a21'
node scripts\login_and_scrape.js
```

El script guardará el HTML posterior al login en `page_after_login.html`.

Opciones de ejecución visual:

- Por defecto el script abre el navegador visible (no headless) para que puedas ver lo que hace.
- Para ejecutar en modo headless establece `MUNI_HEADLESS = '1'`.
- Para reducir la velocidad de las acciones y observar los pasos, usa `MUNI_SLOWMO` con milisegundos, por ejemplo:

```powershell
$env:MUNI_SLOWMO = '100'
node scripts\login_and_scrape.js
```


