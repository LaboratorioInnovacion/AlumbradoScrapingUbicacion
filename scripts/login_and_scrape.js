const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://id.munidigital.com/security/realms/internal/protocol/openid-connect/auth?response_type=code&client_id=munidigital-web&redirect_uri=https%3A%2F%2Fmunidigital.com%2FMuniDigitalCore%2Fopenid-connect%2Fmuni-auth%2Fcallback&state=bfm5xV3olPCx0qOgYUHE308wrK5JtQVCj8xTsyfEBgl9gONDvDsrSrvbxhqzPFKI#/menu-inicio';

async function main() {
  const username = process.env.MUNI_USER || 'aalvarez';
  const password = process.env.MUNI_PASS || 'Alvarez-a21';
  const headless = process.env.MUNI_HEADLESS === '1';
  const slowMo = process.env.MUNI_SLOWMO ? parseInt(process.env.MUNI_SLOWMO, 10) : 0;
 console.log(`Using username: ${username}`);
  const browser = await puppeteer.launch({ headless, ...(slowMo ? { slowMo } : {}) });
  const page = await browser.newPage();
  
  let capturedJson = null;
  let targetOrderId = null;

  page.on('response', async res => {
    const url = res.url();
    const contentType = res.headers()['content-type'] || '';
    
    if (targetOrderId && url.includes(targetOrderId) && contentType.includes('application/json')) {
      try {
        const jsonData = await res.json();
        capturedJson = jsonData;
        fs.writeFileSync(`order_${targetOrderId}_data.json`, JSON.stringify(jsonData, null, 2), 'utf8');
      } catch (err) {}
    }
  });

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36');
  await page.goto(URL, { waitUntil: 'networkidle2' });

  // Login
  await page.waitForSelector('#username', { timeout: 10000 });
  await page.type('#username', username, { delay: 50 });
  await page.type('#password', password, { delay: 50 });

  const loginSelectors = [
    'input[type="submit"][value="kc-login"]',
    'button[value="kc-login"]',
    'input[value="kc-login"]'
  ];

  let loggedIn = false;
  for (const selector of loginSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
        page.click(selector)
      ]);
      loggedIn = true;
      break;
    } catch (e) {
      continue;
    }
  }

  if (!loggedIn) {
    await page.focus('#password');
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
      page.keyboard.press('Enter')
    ]);
  }

  // Navegar a órdenes
  await page.goto('https://munidigital.com/app/#ordenes/manage', { waitUntil: 'networkidle2' });
  
  try {
    await page.reload({ waitUntil: 'networkidle2', timeout: 15000 });
  } catch (e) {
    await page.evaluate(() => location.reload());
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Click en buscar
  await page.waitForSelector('#btnBuscar', { timeout: 10000 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    page.click('#btnBuscar')
  ]);

  // Esperar que desaparezca loader
  await page.waitForFunction(() => {
    const loader = document.querySelector('.loader, .loading, #loader');
    return !loader || ['none', 'hidden'].includes(loader.style.display) || loader.style.visibility === 'hidden' || loader.style.opacity === '0';
  }, { timeout: 15000 });

  // Esperar tabla
  await page.waitForSelector('.backgrid tbody tr, #backgrid tbody tr', { timeout: 20000 });

  // Cerrar sidebar si existe
  await page.evaluate(() => {
    const sidebar = document.querySelector('.sidebar, .md-sidenav, .sidenav, #sidebar, .app-drawer');
    if (sidebar && sidebar.offsetHeight > 0) {
      sidebar.style.display = 'none';
    }
  });

  const target = process.env.MUNI_TARGET;
  let clickResult = null;

  if (target) {
    // Buscar orden específica
    clickResult = await page.evaluate((targetId) => {
      const table = document.querySelector('.backgrid') || document.querySelector('#backgrid');
      if (!table) return null;
      
      const anchors = table.querySelectorAll('tbody tr td.uri-cell a');
      for (const a of anchors) {
        if (a.textContent && a.textContent.trim() === targetId) {
          a.scrollIntoView({ behavior: 'auto', block: 'center' });
          a.click();
          return a.getAttribute('href');
        }
      }
      return null;
    }, target);
  } else {
    // Click en primera orden
    clickResult = await page.evaluate(() => {
      const table = document.querySelector('.backgrid') || document.querySelector('#backgrid');
      if (!table) return null;
      
      const firstRow = table.querySelector('tbody tr');
      if (!firstRow) return null;
      
      const targetCell = firstRow.querySelector('td.uri-cell') || firstRow.querySelector('td:first-child');
      if (!targetCell) return null;
      
      const link = targetCell.querySelector('a');
      if (!link) return null;
      
      link.scrollIntoView({ behavior: 'auto', block: 'center' });
      link.click();
      return link.getAttribute('href');
    });
  }

  if (clickResult) {
    const orderMatch = clickResult.match(/\/ordenes\/(\d+)/);
    if (orderMatch) {
      targetOrderId = orderMatch[1];
    }
    
    // Navegar a la página de la orden
    const navigateTo = clickResult.startsWith('#') ? 'https://munidigital.com/app/' + clickResult : 'https://munidigital.com/app/#' + clickResult;
    await page.goto(navigateTo, { waitUntil: 'networkidle2' });
    
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  await browser.close();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});