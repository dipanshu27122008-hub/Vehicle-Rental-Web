/**
 * Drivora Automated System Verification Suite
 * Tests all project updates across frontend, backend, catalog, pricing, and assets.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    const errMsg = `  [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`;
    console.error(errMsg);
    failures.push(errMsg);
  }
}

console.log('====================================================');
console.log('   DRIVORA MASTER VERIFICATION SUITE');
console.log('====================================================\n');

// ----------------------------------------------------
// 1. JAVASCRIPT SYNTAX & PARSE CHECKS
// ----------------------------------------------------
console.log('--- Step 1: JavaScript File Syntax Verification ---');
const jsFiles = [
  'js/app.js',
  'js/vehicle-data.js',
  'js/vehicle-details.js',
  'js/filter.js',
  'js/book.js',
  'js/pricing.js',
  'js/storage.js',
  'js/gallery.js',
  'js/provider-dashboard.js',
  'js/admin-dashboard.js',
  'api/_lib/supabase.js',
  'api/_lib/pricing.js',
  'api/marketplace.js',
  'api/vehicles.js',
  'api/bookings.js',
  'api/inquiries.js',
  'api/reviews.js'
];

for (const relPath of jsFiles) {
  try {
    const code = fs.readFileSync(path.resolve(relPath), 'utf8');
    new vm.Script(code, { filename: relPath });
    assert(true, `Syntax OK: ${relPath}`);
  } catch (err) {
    assert(false, `Syntax OK: ${relPath}`, err.message);
  }
}

// ----------------------------------------------------
// 2. HTML PAGES & LINK INTEGRITY
// ----------------------------------------------------
console.log('\n--- Step 2: HTML Pages & Resource Integrity ---');
const htmlPages = [
  'index.html',
  'vehicles.html',
  'gallery.html',
  'provider-dashboard.html',
  'admin-dashboard.html',
  'terms.html',
  'signin.html',
  'signup.html'
];

htmlPages.forEach(page => {
  const content = fs.readFileSync(path.resolve(page), 'utf8');
  assert(content.length > 500, `${page} exists and has substantial content`);

  // Check script tags with local src
  const scriptMatches = content.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi);
  for (const match of scriptMatches) {
    const src = match[1];
    if (!src.startsWith('http://') && !src.startsWith('https://')) {
      const cleanSrc = src.split('?')[0].replace(/^\.\//, '');
      const exists = fs.existsSync(path.resolve(cleanSrc));
      assert(exists, `${page} -> script src exists: ${src}`, cleanSrc);
    }
  }

  // Check stylesheet links
  const cssMatches = content.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi);
  for (const match of cssMatches) {
    const href = match[1];
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
      const cleanHref = href.split('?')[0].replace(/^\.\//, '');
      const exists = fs.existsSync(path.resolve(cleanHref));
      assert(exists, `${page} -> CSS href exists: ${href}`, cleanHref);
    }
  }
});

// ----------------------------------------------------
// 3. VEHICLE CARDS & BUTTONS AUDIT
// ----------------------------------------------------
console.log('\n--- Step 3: Vehicle Cards & "View Details" Buttons ---');
const vehiclesHtml = fs.readFileSync('vehicles.html', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

const vCardMatches = vehiclesHtml.match(/<article class="vehicle-card"[^>]*data-vehicle-id="([^"]+)"[^>]*>/g) || [];
assert(vCardMatches.length >= 15, `vehicles.html has at least 15 vehicle cards with data-vehicle-id (found ${vCardMatches.length})`);

const vDetailsBtns = vehiclesHtml.match(/class="[^"]*details-button[^"]*"[^>]*data-vehicle-id="([^"]+)"/g) || [];
assert(vDetailsBtns.length === vCardMatches.length, `vehicles.html has equal number of details-buttons (${vDetailsBtns.length}) as cards (${vCardMatches.length})`);

const vBookBtns = vehiclesHtml.match(/class="[^"]*book-button[^"]*"[^>]*data-vehicle="([^"]+)"/g) || [];
assert(vBookBtns.length === vCardMatches.length, `vehicles.html has equal number of book-buttons (${vBookBtns.length}) as cards (${vCardMatches.length})`);

const vActionGroups = vehiclesHtml.match(/<div class="card-action-group">/g) || [];
assert(vActionGroups.length === vCardMatches.length, `vehicles.html wraps buttons in .card-action-group (${vActionGroups.length})`);

// Index featured cards check
const iCardMatches = indexHtml.match(/<article class="vehicle-card"[^>]*data-vehicle-id="([^"]+)"[^>]*>/g) || [];
assert(iCardMatches.length === 3, `index.html has 3 featured cards with data-vehicle-id (found ${iCardMatches.length})`);

const iDetailsBtns = indexHtml.match(/class="[^"]*details-button[^"]*"[^>]*data-vehicle-id="([^"]+)"/g) || [];
assert(iDetailsBtns.length === 3, `index.html has 3 details-buttons (found ${iDetailsBtns.length})`);

const iHasVehicleDetailsScript = /<script\s+src=["']\.\/js\/vehicle-details\.js["']/.test(indexHtml);
assert(iHasVehicleDetailsScript, `index.html includes js/vehicle-details.js for modal interaction`);

// ----------------------------------------------------
// 4. VEHICLE CATALOG & HAVERSINE INTEGRITY
// ----------------------------------------------------
console.log('\n--- Step 4: Catalog & Distance Calculation ---');
const catalogSandbox = { window: {}, Math: Math, Number: Number, String: String, Array: Array, Object: Object, typeof: () => {} };
const dataCode = fs.readFileSync('js/vehicle-data.js', 'utf8');
vm.runInNewContext(dataCode, catalogSandbox);

const catalog = catalogSandbox.window.vehicleCatalog;
assert(catalog && typeof catalog === 'object', 'window.vehicleCatalog is defined');
const catalogKeys = Object.keys(catalog || {});
assert(catalogKeys.length >= 15, `vehicleCatalog contains at least 15 vehicles (found ${catalogKeys.length})`);

let catalogValid = true;
for (const [id, v] of Object.entries(catalog)) {
  if (!v.name || !v.category || !v.price || !v.modelYear || typeof v.lat !== 'number' || typeof v.lng !== 'number') {
    catalogValid = false;
    assert(false, `Vehicle ${id} missing required attributes`);
    break;
  }
}
if (catalogValid) {
  assert(true, 'All catalog vehicles contain valid name, category, price, modelYear, and GPS coordinates');
}

// Test Haversine formula
const haversine = catalogSandbox.window.calculateHaversineKm;
assert(typeof haversine === 'function', 'window.calculateHaversineKm is exported');
if (typeof haversine === 'function') {
  // Same point
  assert(haversine(28.6139, 77.2090, 28.6139, 77.2090) === 0, 'Haversine distance between identical points is 0 km');
  // Delhi to Jaipur (~240 km straight-line)
  const dDelhiJaipur = haversine(28.6139, 77.2090, 26.9124, 75.7873);
  assert(dDelhiJaipur > 220 && dDelhiJaipur < 260, `Haversine Delhi to Jaipur is accurate (~${dDelhiJaipur} km)`);
}

// ----------------------------------------------------
// 5. PRICING ENGINE DETERMINISTIC CALCULATIONS
// ----------------------------------------------------
// ----------------------------------------------------
// 5. PRICING ENGINE DETERMINISTIC CALCULATIONS
// ----------------------------------------------------
console.log('\n--- Step 5: Pricing Engine Consistency (Client & Server) ---');
// Test client pricing
const clientPricingSandbox = { window: {}, Math: Math, Number: Number, String: String, Date: Date };
vm.runInNewContext(fs.readFileSync('js/pricing.js', 'utf8'), clientPricingSandbox);
const clientCalc = clientPricingSandbox.window.DrivoraPricing?.calculatePricing;
const clientCancel = clientPricingSandbox.window.DrivoraPricing?.calculateCancellationFee;

// Test server pricing
const serverPricing = require('./api/_lib/pricing.js');
const serverCalc = serverPricing.calculatePricing;
const serverCancel = serverPricing.calculateCancellationFee;

assert(typeof clientCalc === 'function', 'Client DrivoraPricing.calculatePricing exists');
assert(typeof serverCalc === 'function', 'Server DrivoraPricing.calculatePricing exists');
assert(typeof clientCancel === 'function', 'Client DrivoraPricing.calculateCancellationFee exists');
assert(typeof serverCancel === 'function', 'Server DrivoraPricing.calculateCancellationFee exists');

if (typeof clientCalc === 'function' && typeof serverCalc === 'function') {
  const quote1Client = clientCalc({
    dailyPrice: 3500,
    pickupDate: '2026-11-01',
    returnDate: '2026-11-02', // 1 day
    securityDeposit: 5000
  });

  const quote1Server = serverCalc({
    dailyPrice: 3500,
    pickupDate: '2026-11-01',
    returnDate: '2026-11-02',
    securityDeposit: 5000
  });

  assert(quote1Client.days === 1, '1-day booking calculates 1 day');
  assert(quote1Client.baseRentalAmount === 3500, 'Base rental amount matches ₹3,500');
  assert(quote1Client.securityDeposit === 5000, 'Refundable security deposit is ₹5,000');
  assert(quote1Client.totalPayableWithDeposit === quote1Server.totalPayableWithDeposit, `Client and server produce identical total with deposit: ₹${quote1Client.totalPayableWithDeposit}`);

  // Test partial day extra hours: 28 hours (1 day + 4 extra hours)
  const quotePartial = clientCalc({
    dailyPrice: 2400,
    pickupDate: '2026-11-01',
    returnDate: '2026-11-02',
    pickupTime: '10:00',
    returnTime: '14:00',
    securityDeposit: 3000
  });
  assert(quotePartial.days === 1, 'Partial booking calculates 1 full day');
  assert(quotePartial.extraHours === 4, 'Partial booking calculates 4 extra hours');
  assert(quotePartial.extraHourAmount === 4 * (2400 / 8), `Extra hour amount = 4 * ₹300 = ₹${quotePartial.extraHourAmount}`);
  assert(quotePartial.rentalSubtotal === 2400 + 1200, `Rental subtotal matches base + extra hours (₹${quotePartial.rentalSubtotal})`);

  // Test cancellation policy: >= 24h is free, < 24h is late cancellation
  const cancelFree = clientCancel({
    dailyPrice: 3000,
    pickupDate: '2026-12-01',
    pickupTime: '10:00',
    cancelledAtIso: '2026-11-20T10:00:00Z'
  });
  assert(cancelFree.fee === 0, 'Cancellation >= 24h before pickup incurs ₹0 fee');

  const cancelLate = clientCancel({
    dailyPrice: 3000,
    pickupDate: '2026-11-01',
    pickupTime: '10:00',
    cancelledAtIso: '2026-11-01T02:00:00Z' // 8 hours before pickup
  });
  assert(cancelLate.fee === Math.round(3000 * 0.15), `Cancellation < 24h before pickup incurs 15% fee (₹${cancelLate.fee})`);
}

// ----------------------------------------------------
// 6. SERVERLESS API ENDPOINTS VERIFICATION
// ----------------------------------------------------
console.log('\n--- Step 6: Serverless API Endpoints Validation ---');

function mockReq(method, query = {}, body = {}, headers = {}) {
  return {
    method,
    query,
    body,
    headers: { ...headers }
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    bodyData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    setHeader(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(data) {
      this.bodyData = data;
      return this;
    },
    end() {
      return this;
    }
  };
  return res;
}

async function testApiEndpoints() {
  // Test marketplace.js
  try {
    const marketplaceHandler = require('./api/marketplace.js');
    const resM = mockRes();
    await marketplaceHandler(mockReq('GET'), resM);
    assert(resM.statusCode === 200, 'api/marketplace.js GET returns HTTP 200');
    assert(Array.isArray(resM.bodyData?.vehicles), 'api/marketplace.js returns vehicles array');
    assert(Array.isArray(resM.bodyData?.bookings), 'api/marketplace.js returns bookings array');
  } catch (err) {
    assert(false, 'api/marketplace.js test failed', err.message);
  }

  // Test vehicles.js
  try {
    const vehiclesHandler = require('./api/vehicles.js');
    const resVGet = mockRes();
    await vehiclesHandler(mockReq('GET'), resVGet);
    // Unconfigured environment returns 503; configured returns 200
    assert(resVGet.statusCode === 200 || resVGet.statusCode === 503, `api/vehicles.js GET returns valid status (${resVGet.statusCode})`);

    // Test POST without auth (must reject with 401)
    const resVPost = mockRes();
    await vehiclesHandler(mockReq('POST', {}, { name: 'Test Car' }), resVPost);
    assert(resVPost.statusCode === 401, 'api/vehicles.js POST without auth correctly returns HTTP 401 Unauthorized');
  } catch (err) {
    assert(false, 'api/vehicles.js test failed', err.message);
  }

  // Test bookings.js
  try {
    const bookingsHandler = require('./api/bookings.js');
    // POST missing fields
    const resBPost = mockRes();
    await bookingsHandler(mockReq('POST', {}, {}), resBPost);
    assert(resBPost.statusCode === 400, 'api/bookings.js POST with empty body returns HTTP 400 Bad Request');
  } catch (err) {
    assert(false, 'api/bookings.js test failed', err.message);
  }

  // Test inquiries.js
  try {
    const inquiriesHandler = require('./api/inquiries.js');
    const resIPost = mockRes();
    await inquiriesHandler(mockReq('POST', {}, {}), resIPost);
    assert(resIPost.statusCode === 400, 'api/inquiries.js POST with empty body returns HTTP 400 Bad Request');
  } catch (err) {
    assert(false, 'api/inquiries.js test failed', err.message);
  }

  // Test reviews.js
  try {
    const reviewsHandler = require('./api/reviews.js');
    const resRGet = mockRes();
    await reviewsHandler(mockReq('GET', { vehicle_id: 'bmw-x5' }), resRGet);
    assert(resRGet.statusCode === 200 || resRGet.statusCode === 503, `api/reviews.js GET returns valid status (${resRGet.statusCode})`);

    // POST invalid rating
    const resRPost = mockRes();
    await reviewsHandler(mockReq('POST', {}, { vehicle_id: 'bmw-x5', rating: 10 }), resRPost);
    assert(resRPost.statusCode === 400, 'api/reviews.js POST with rating 10 rejects with HTTP 400');
  } catch (err) {
    assert(false, 'api/reviews.js test failed', err.message);
  }

  // ----------------------------------------------------
  // 7. GLASSMORPHISM CSS RULES VERIFICATION
  // ----------------------------------------------------
  console.log('\n--- Step 7: Glassmorphism CSS Audit ---');
  const styleCss = fs.readFileSync('css/style.css', 'utf8');
  const vehicleCss = fs.readFileSync('css/vehicle.css', 'utf8');
  const marketCss = fs.readFileSync('css/marketplace.css', 'utf8');

  assert(styleCss.includes('backdrop-filter: blur('), 'css/style.css includes backdrop-filter blur definitions');
  assert(styleCss.includes('.card-action-group'), 'css/style.css defines .card-action-group');
  assert(styleCss.includes('.details-button'), 'css/style.css defines .details-button');
  assert(styleCss.includes('.book-button'), 'css/style.css defines .book-button');
  assert(vehicleCss.includes('.card-action-group'), 'css/vehicle.css has overrides for .card-action-group');
  assert(marketCss.includes('.glass-panel'), 'css/marketplace.css defines .glass-panel');
  assert(marketCss.includes('.stat-card'), 'css/marketplace.css defines .stat-card for dashboards');

  // ----------------------------------------------------
  // 8. PROVIDER PORTAL & DEDICATED AUTH MODALS AUDIT
  // ----------------------------------------------------
  console.log('\n--- Step 8: Provider Portal & Dedicated Auth Pop-ups Audit ---');
  const providerHtml = fs.readFileSync('provider-dashboard.html', 'utf8');
  const appJs = fs.readFileSync('js/app.js', 'utf8');
  const providerJs = fs.readFileSync('js/provider-dashboard.js', 'utf8');

  assert(providerHtml.includes('data-tab="earnings"'), 'provider-dashboard.html has Earnings & Settlements tab button');
  assert(providerHtml.includes('id="tab-earnings"'), 'provider-dashboard.html contains #tab-earnings section');
  assert(providerHtml.includes('id="returnCheckinModal"'), 'provider-dashboard.html contains #returnCheckinModal dialog');
  assert(providerHtml.includes('id="inquiryReplyModal"'), 'provider-dashboard.html contains #inquiryReplyModal dialog');
  assert(providerHtml.includes('id="deleteVehicleModal"'), 'provider-dashboard.html contains #deleteVehicleModal dialog');
  assert(providerHtml.includes('id="vehImageDropZone"'), 'provider-dashboard.html contains image dropzone uploader');
  assert(providerHtml.includes('id="vehFileInput"'), 'provider-dashboard.html contains local file selector input');
  assert(providerHtml.includes('class="preset-chip"'), 'provider-dashboard.html contains quick preset image chips');

  assert(appJs.includes('openSignInModal'), 'js/app.js implements openSignInModal()');
  assert(appJs.includes('openSignUpModal'), 'js/app.js implements openSignUpModal()');
  assert(appJs.includes('openResetModal'), 'js/app.js implements openResetModal()');
  assert(appJs.includes('openAccountModal'), 'js/app.js implements openAccountModal()');
  assert(!providerJs.includes('window.prompt('), 'js/provider-dashboard.js has zero window.prompt calls (replaced by custom modals)');

  console.log('\n====================================================');
  console.log(`VERIFICATION SUMMARY: Total ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
  console.log('====================================================\n');

  if (failedTests > 0) {
    console.error('List of failures:');
    failures.forEach(f => console.error(f));
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED! System is fully verified and functional.');
    process.exit(0);
  }
}

testApiEndpoints();
