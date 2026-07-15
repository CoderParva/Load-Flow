const { chromium } = require('playwright');

const BASE = 'http://localhost:5173';

function rand() { return Math.random().toString(36).slice(2, 8); }

(async () => {
  const browser = await chromium.launch();
  const errors = [];

  async function newCtx(name) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
    page.on('console', msg => { if (msg.type() === 'error') errors.push(`[${name}] console: ${msg.text()}`); });
    return { ctx, page };
  }

  const suffix = rand();
  const brokerEmail = `alice_${suffix}@acme.com`;
  const carrierEmail = `carl_${suffix}@speedy.com`;
  const shipperEmail = `sam_${suffix}@widgetco.com`;

  // ---- Broker signup ----
  const { page: broker } = await newCtx('broker');
  await broker.goto(`${BASE}/signup`);
  await broker.selectOption('select', 'BROKER');
  await broker.fill('input[type="text"], input:not([type])', ''); // no-op guard
  const inputs = await broker.$$('input');
  await broker.fill('input >> nth=0', 'Acme Brokerage'); // orgName
  await broker.fill('input >> nth=1', 'Alice Admin'); // name
  await broker.fill('input[type="email"]', brokerEmail);
  await broker.fill('input[type="password"]', 'pass1234');
  await broker.click('button:has-text("Create account")');
  await broker.waitForURL('**/loads', { timeout: 10000 });
  console.log('BROKER signup -> load board OK, url=', broker.url());

  // ---- Carrier signup ----
  const { page: carrier } = await newCtx('carrier');
  await carrier.goto(`${BASE}/signup`);
  await carrier.selectOption('select', 'CARRIER');
  await carrier.fill('input >> nth=0', 'Speedy Carriers');
  await carrier.fill('input >> nth=1', 'Carl Admin');
  await carrier.fill('input[type="email"]', carrierEmail);
  await carrier.fill('input[type="password"]', 'pass1234');
  await carrier.click('button:has-text("Create account")');
  await carrier.waitForURL('**/loads', { timeout: 10000 });
  console.log('CARRIER signup -> load board OK');

  // Carrier sets compliance record
  await carrier.goto(`${BASE}/compliance`);
  await carrier.fill('input[type="date"]', '2027-01-01');
  await carrier.selectOption('select', 'ACTIVE');
  await carrier.fill('input[placeholder="Dry Van, Reefer, Flatbed"]', 'Dry Van');
  await carrier.fill('input[placeholder="General, Perishable"]', 'General');
  await carrier.click('button:has-text("Save record")');
  await carrier.waitForSelector('text=Compliance record saved.', { timeout: 10000 });
  console.log('CARRIER compliance saved OK');

  // ---- Shipper signup ----
  const { page: shipper } = await newCtx('shipper');
  await shipper.goto(`${BASE}/signup`);
  await shipper.selectOption('select', 'SHIPPER');
  await shipper.fill('input >> nth=0', 'Widget Co');
  await shipper.fill('input >> nth=1', 'Sam Shipper');
  await shipper.fill('input[type="email"]', shipperEmail);
  await shipper.fill('input[type="password"]', 'pass1234');
  await shipper.click('button:has-text("Create account")');
  await shipper.waitForURL('**/loads', { timeout: 10000 });
  console.log('SHIPPER signup -> load board OK');

  // ---- Broker creates a load ----
  await broker.goto(`${BASE}/loads/new`);
  await broker.waitForSelector('select');
  await broker.selectOption('select', { label: 'Widget Co' });
  await broker.fill('input[placeholder="Chicago, IL"]', 'Chicago, IL');
  await broker.fill('input[placeholder="Dallas, TX"]', 'Dallas, TX');
  await broker.fill('input[type="date"]', '2026-08-01');
  await broker.fill('input[placeholder="Dry Van"]', 'Dry Van');
  await broker.fill('input[placeholder="General"]', 'General');
  await broker.click('button:has-text("Post load")');
  await broker.waitForURL('**/loads/*', { timeout: 10000 });
  const loadUrl = broker.url();
  console.log('LOAD created OK, url=', loadUrl);

  // ---- Broker assigns carrier ----
  await broker.selectOption('select', { label: 'Speedy Carriers' });
  await broker.click('button:has-text("Assign")');
  await broker.waitForSelector('text=Carrier assigned.', { timeout: 10000 });
  console.log('ASSIGN carrier OK');

  // ---- Broker confirms rate ----
  await broker.fill('input[type="number"]', '1500');
  await broker.click('button:has-text("Confirm rate")');
  await broker.waitForSelector('text=Rate confirmed.', { timeout: 10000 });
  console.log('RATE confirm OK');

  // ---- Broker advances status ----
  await broker.click('button:has-text("Advance to DISPATCHED")');
  await broker.waitForSelector('text=Moved to DISPATCHED', { timeout: 10000 });
  console.log('ADVANCE to DISPATCHED OK');

  // ---- Shipper views their own load, should see it in scope, read-only ----
  await shipper.goto(`${BASE}/loads`);
  await shipper.waitForSelector('text=Chicago, IL', { timeout: 10000 }).catch(async () => {
    const bodyText = await shipper.textContent('body');
    errors.push(`SHIPPER did not see load in list. Body snippet: ${bodyText.slice(0, 300)}`);
  });
  console.log('SHIPPER load board checked');

  await browser.close();

  if (errors.length) {
    console.error('\n=== ERRORS FOUND ===');
    errors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log('\n=== ALL FLOWS PASSED, NO CONSOLE ERRORS ===');
  }
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
