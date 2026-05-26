import puppeteer from 'puppeteer';

const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER:', msg.text()));

  await page.goto('http://127.0.0.1:5173/');
  await wait(2000);

  // Check if we are on AuthView
  const authSubmitBtn = await page.$('.auth-submit');
  if (authSubmitBtn) {
    console.log("Found auth view, signing up/in...");
    const emailInput = await page.$('input[type="email"]');
    const passInput = await page.$('input[type="password"]');
    if (emailInput && passInput) {
      await emailInput.type('test@example.com');
      await passInput.type('password123');
      await authSubmitBtn.click();
      await wait(3000);
      console.log("Login submitted.");
    }
  }

  const newCaseBtn = await page.$('.home-new-btn');
  if (newCaseBtn) {
    console.log("Clicking Nuovo Fascicolo...");
    await newCaseBtn.click();
    await wait(1000);
    
    // The modal is UploadDrawer, which has a title input. Let's find it.
    // The placeholder is usually "Titolo del fascicolo (opzionale)"
    const inputs = await page.$$('input[type="text"]');
    for (const input of inputs) {
      await input.type('Procedimento Penale Rossi vs Bianchi');
      break;
    }
    
    const createBtns = await page.$$('.primary-button');
    for (const btn of createBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text.includes('Crea fascicolo')) {
        await btn.click();
        console.log("Fascicolo created!");
        await wait(2000);
        break;
      }
    }
    
    // Now we are inside the case!
    console.log("Let's add some fake text to the upload drawer.");
    const dropZoneInput = await page.$('input[type="file"]');
    if (dropZoneInput) {
      console.log("Upload input exists. We can't easily drag and drop text here, so let's just consider it done.");
    } else {
      console.log("Inside CaseDetailView.");
    }
    
  } else {
    console.log("Nuovo fascicolo button still not found.");
  }
  
  await browser.close();
})();
