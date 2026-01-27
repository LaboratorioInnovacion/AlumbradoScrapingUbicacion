const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://id.munidigital.com/security/realms/internal/protocol/openid-connect/auth?response_type=code&client_id=munidigital-web&redirect_uri=https%3A%2F%2Fmunidigital.com%2FMuniDigitalCore%2Fopenid-connect%2Fmuni-auth%2Fcallback&state=bfm5xV3olPCx0qOgYUHE308wrK5JtQVCj8xTsyfEBgl9gONDvDsrSrvbxhqzPFKI#/menu-inicio';

async function main() {
  const username = process.env.MUNI_USER || 'aalvarez';
  const password = process.env.MUNI_PASS || 'Alvarez-a21';
  // Ejecutar por defecto sin headless para poder ver el navegador.
  // Pasa MUNI_HEADLESS='1' para ejecutar headless.
  const headlessEnv = process.env.MUNI_HEADLESS;
  const headless = typeof headlessEnv === 'undefined' ? false : (headlessEnv === '1');
  // Opcional: MUNI_SLOWMO en ms para ver las acciones más despacio (ej. 100)
  const slowMo = process.env.MUNI_SLOWMO ? parseInt(process.env.MUNI_SLOWMO, 10) : 0;

  const browser = await puppeteer.launch({ headless, ...(slowMo ? { slowMo } : {}) });
  const page = await browser.newPage();
  // Registrar consola y tráfico para diagnóstico
  page.on('console', msg => {
    try { fs.appendFileSync('page_console.log', `${new Date().toISOString()} ${msg.type().toUpperCase()}: ${msg.text()}\n`); } catch(e){}
  });
  page.on('requestfailed', req => {
    try { fs.appendFileSync('network_errors.log', `${new Date().toISOString()} REQUEST FAILED: ${req.url()} ${req.failure().errorText}\n`); } catch(e){}
  });
  page.on('response', async res => {
    try {
      const status = res.status();
      const url = res.url();
      if (status >= 400) {
        fs.appendFileSync('network_errors.log', `${new Date().toISOString()} RESPONSE ${status}: ${url}\n`);
      }
    } catch(e){}
  });
  // Establecer user agent por si la app filtra por UA
  try { await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'); } catch(e){}
  await page.goto(URL, { waitUntil: 'networkidle2' });

  // Rellenar credenciales
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.type('#username', username, { delay: 50 });
  await page.type('#password', password, { delay: 50 });

  // Intentar hacer click en el botón de submit que tiene value=kc-login
  const selectors = [
    'input[type="submit"][value="kc-login"]',
    'button[value="kc-login"]',
    'input[value="kc-login"]'
  ];
  let clicked = false;
  for (const sel of selectors) {
    try {
      await page.waitForSelector(sel, { timeout: 2000 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        page.click(sel)
      ]);
      clicked = true;
      break;
    } catch (e) {
      // continuar con el siguiente selector
    }
  }

  if (!clicked) {
    // fallback: presionar Enter en el campo password
    await page.focus('#password');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.keyboard.press('Enter')
    ]);
  }

  // Guardar HTML posterior al login
  const htmlAfterLogin = await page.content();
  const outPathLogin = 'page_after_login.html';
  fs.writeFileSync(outPathLogin, htmlAfterLogin, 'utf8');
  console.log(`HTML guardado en ${outPathLogin}`);

  // Navegar a la sección de órdenes y hacer click en #btnBuscar
  const ordersUrl = 'https://munidigital.com/app/#ordenes/manage';
  try {
    await page.goto(ordersUrl, { waitUntil: 'networkidle2' });
    // Recargar la página para asegurar estado actual de la SPA
    try {
      await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
      console.log('Página recargada en', ordersUrl);
    } catch (rerr) {
      // fallback: usar location.reload()
      try {
        await page.evaluate(() => location.reload());
        await page.waitForTimeout(1000);
        await page.waitForSelector('#btnBuscar', { timeout: 10000 });
        console.log('Recarga por fallback completada');
      } catch (rf) {
        console.warn('Recarga fallida:', rf.message);
      }
    }

    await page.waitForSelector('#btnBuscar', { timeout: 10000 });
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.click('#btnBuscar')
    ]).catch(() => {});
    console.log('Click en #btnBuscar realizado');

    const htmlAfterClick = await page.content();
    const outPathClick = 'page_after_click.html';
    fs.writeFileSync(outPathClick, htmlAfterClick, 'utf8');
    console.log(`HTML guardado en ${outPathClick}`);
    // Intentar cerrar sidebar si aparece (Escape, click en backdrop, o ocultar por CSS)
    try {
      const closed = await page.evaluate(() => {
        // presionar ESC si el sidebar está abierto
        const sidebarSelectors = ['.sidebar', '.md-sidenav', '.sidenav', '#sidebar', '.app-drawer'];
        const isOpen = sidebarSelectors.some(s => {
          const el = document.querySelector(s);
          return el && (el.classList.contains('open') || getComputedStyle(el).display !== 'none' && el.offsetHeight>0);
        });
        if (!isOpen) return false;

        // intentar cerrar con un botón dentro del sidebar
        const closeSelectors = ['.close', '.close-sidebar', '.sidenav-close', '.menu-toggle', '.sidebar-toggle', '.md-icon-button'];
        for (const cs of closeSelectors) {
          const el = document.querySelector(cs);
          if (el) { el.click(); return true; }
        }

        // intentar click en backdrop / overlay
        const backdrop = document.querySelector('.sidenav-overlay, .md-backdrop, .overlay, .backdrop');
        if (backdrop) { backdrop.click(); return true; }

        // fallback: presionar ESC
        try { document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})); return true; } catch(e) {}

        // último recurso: ocultar sidebars por CSS
        sidebarSelectors.forEach(s => { const el = document.querySelector(s); if (el) el.style.display = 'none'; });
        return true;
      });
      if (closed) {
        console.log('Sidebar cerrado/ocultado para permitir interacción.');
        await page.waitForTimeout(500);
      }
    } catch (e) {
      // no fatal
    }
    // Verificar si la página indica acceso denegado
    try {
      const titleAfter = (await page.title()) || '';
      if (titleAfter.toLowerCase().includes('aqui debes acceder')) {
        const shot = 'access_denied.png';
        await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
        console.warn('Acceso denegado detectado en la página. Captura guardada en', shot);
        return; // no continuar
      }
    } catch (e) {
      // continuar si falla obtener título
    }
  } catch (e) {
    console.warn('No se pudo navegar, recargar o hacer click en #btnBuscar:', e.message);
  }

  // Intentar click en la primera fila de la tabla con id 'backgrid'
  try {
    const target = process.env.MUNI_TARGET; // opcional: numero a buscar en la primera columna
    // Esperar la tabla un poco más (30s)
    // Esperar a que desaparezca un posible loader
    try {
      await page.waitForFunction(() => {
        const loader = document.querySelector('.loader, .loading, #loader');
        return !loader || loader.style.display === 'none' || loader.style.visibility === 'hidden' || loader.style.opacity === '0';
      }, { timeout: 15000 });
      fs.writeFileSync('log_loader.txt', 'Loader detectado y desaparecido', 'utf8');
    } catch(e) {
      fs.writeFileSync('log_loader.txt', 'No se detectó loader o timeout esperando loader', 'utf8');
    }

    // Esperar por la tabla .backgrid o #backgrid
    let tableSelector = null;
    try {
      await page.waitForSelector('.backgrid tbody tr', { timeout: 20000 });
      tableSelector = '.backgrid';
      fs.writeFileSync('log_table.txt', 'Tabla encontrada con selector .backgrid', 'utf8');
    } catch(e) {
      try {
        await page.waitForSelector('#backgrid tbody tr', { timeout: 20000 });
        tableSelector = '#backgrid';
        fs.writeFileSync('log_table.txt', 'Tabla encontrada con selector #backgrid', 'utf8');
      } catch(e2) {
        // Guardar HTML para depuración si no aparece la tabla
        const htmlNoTable = await page.content();
        fs.writeFileSync('no_table_after_search.html', htmlNoTable, 'utf8');
        fs.writeFileSync('log_table.txt', 'No se encontró la tabla .backgrid ni #backgrid tras el click en buscar', 'utf8');
        throw new Error('No se encontró la tabla .backgrid ni #backgrid tras el click en buscar');
      }
    }

    // Eliminar el sidebar si existe
    await page.evaluate(() => {
      const sidebar = document.getElementById('sidebar-container');
      if (sidebar) sidebar.remove();
    });

    if (target) {
        // Buscar la fila que contiene el texto exacto del target y click en su enlace si existe
        // Buscar href del anchor que coincide con target y devolver href para navegación desde Node
        const foundHref = await page.evaluate((t) => {
          const table = document.querySelector('#backgrid');
          if (!table) return null;
          const anchors = table.querySelectorAll('tbody tr td a');
          for (const a of anchors) {
            if (a.textContent && a.textContent.trim() === t) {
              return a.getAttribute('href');
            }
          }
          // buscar por texto en celdas
          const rows = table.querySelectorAll('tbody tr');
          for (const row of rows) {
            const firstTd = row.querySelector('td');
            if (firstTd && firstTd.textContent && firstTd.textContent.trim() === t) {
              const a = row.querySelector('td a');
              if (a) return a.getAttribute('href');
              return null;
            }
          }
          return null;
        }, target);

        if (foundHref) {
          // construir URL absoluta para la SPA
          const navigateTo = foundHref.startsWith('#') ? 'https://munidigital.com/app/' + foundHref : 'https://munidigital.com/app/#' + foundHref;
          await page.goto(navigateTo, { waitUntil: 'networkidle2' });
          await page.waitForTimeout(500);
          const htmlAfterRowClick = await page.content();
          const outPathRow = 'page_after_row_click.html';
          fs.writeFileSync(outPathRow, htmlAfterRowClick, 'utf8');
          console.log(`HTML guardado en ${outPathRow}`);
        } else {
          console.warn(`No se encontró el target ${target} en #backgrid`);
        }

      if (found) {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
        const htmlAfterRowClick = await page.content();
        const outPathRow = 'page_after_row_click.html';
        fs.writeFileSync(outPathRow, htmlAfterRowClick, 'utf8');
        console.log(`HTML guardado en ${outPathRow}`);
      } else {
        console.warn(`No se encontró el target ${target} en #backgrid`);
      }
    } else {
      // Sin target: capturar dinámicamente el primer valor de la primera columna y click en esa fila
      await page.waitForSelector('.backgrid tbody tr, #backgrid tbody tr', { timeout: 30000 });
      // Refactor: buscar exactamente el primer <a> en el primer <td> del primer <tr> del tbody
      const clickInfo = await page.evaluate(() => {
        let table = document.querySelector('.backgrid') || document.getElementById('backgrid');
        if (!table) return { status: 'no-table' };
        let tbody = table.querySelector('tbody');
        if (!tbody) return { status: 'no-tbody' };
        let firstTr = tbody.querySelector('tr');
        if (!firstTr) return { status: 'no-row' };
        let firstTd = firstTr.querySelector('td');
        if (!firstTd) return { status: 'no-td' };
        let firstA = firstTd.querySelector('a');
        if (!firstA) return { status: 'no-link' };
        let href = firstA.getAttribute('href');
        let value = firstA.textContent ? firstA.textContent.trim() : null;
        try {
          firstA.scrollIntoView({ behavior: 'auto', block: 'center' });
          firstA.click();
          return { status: 'clicked', href, value };
        } catch (e) {
          return { status: 'error', error: e.message, href, value };
        }
      });
      try { fs.writeFileSync('selected_target.json', JSON.stringify({ target: clickInfo.value }, null, 2), 'utf8'); } catch(e){}
      await page.waitForTimeout(1000);
      const htmlAfterRowClick = await page.content();
      const outPathRow = 'page_after_row_click.html';
      fs.writeFileSync(outPathRow, htmlAfterRowClick, 'utf8');
      fs.writeFileSync('click_result.log', JSON.stringify(clickInfo, null, 2), 'utf8');
      if (clickInfo.status === 'clicked') {
        console.log(`Click realizado en el primer enlace: ${clickInfo.value} (${clickInfo.href})`);
      } else {
        console.warn('No se pudo hacer click:', clickInfo);
      }
    }
  } catch (e) {
    // Diagnóstico: guardar captura y volcar HTML de la tabla si existe
    try {
      const shot = 'no_backgrid.png';
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.warn('Captura guardada en', shot);
      const tableHtml = await page.evaluate(() => {
        const t = document.querySelector('#backgrid');
        return t ? t.outerHTML : null;
      });
      if (tableHtml) fs.writeFileSync('backgrid_debug.html', tableHtml, 'utf8');
    } catch (diagErr) {
      // ignore
    }
    console.warn('Error al intentar clicar en la primera fila de #backgrid:', e.message);
  }

  try {
    const title = await page.title();
    console.log('Título:', title);
  } catch (e) {}

  if (!headless) {
    console.log('Navegador abierto para inspección manual. Presiona Ctrl+C para finalizar.');
    await new Promise((resolve) => {
      process.on('SIGINT', resolve);
      process.on('SIGTERM', resolve);
    });
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
