import puppeteer from 'puppeteer';
import { logger } from '../../common/logger';

/**
 * Renderiza HTML completo a PDF (A4). Requiere Chromium descargado por puppeteer.
 */
export async function htmlToPdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load', timeout: 120_000 });
    await new Promise((r) => setTimeout(r, 1800));
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    return Buffer.from(pdf);
  } catch (e) {
    logger.warn({ err: e }, 'Fallo al generar PDF con Puppeteer');
    throw e;
  } finally {
    await browser.close();
  }
}
