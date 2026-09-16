import puppeteer from 'puppeteer';

export async function generatePdfFromHtml(
  htmlSource: string,
  htmlCss: string = '',
  variables: Record<string, string> = {}
): Promise<Buffer> {
  // 1. Substitute variables (e.g. {{client_name}})
  let processedHtml = htmlSource;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g');
    processedHtml = processedHtml.replace(regex, value);
  }

  // 2. Wrap in HTML boilerplate and inject CSS
  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <style>
        /* Base styles */
        body { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
          font-family: sans-serif; 
        }
        /* User styles */
        ${htmlCss}
      </style>
    </head>
    <body>
      ${processedHtml}
    </body>
    </html>
  `;

  // 3. Render with Puppeteer
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    
    // Set content and wait for resources to load
    await page.setContent(fullHtml, { waitUntil: 'domcontentloaded' });
    
    // Generate PDF as Uint8Array and convert to Node Buffer
    const pdfUint8Array = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    });
    
    return Buffer.from(pdfUint8Array);
  } finally {
    await browser.close();
  }
}
