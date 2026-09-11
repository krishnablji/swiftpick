const http = require('http');

async function sendRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTest() {
  console.log('🧪 Starting Atomic Inventory Lock & Concurrency Verification...');

  // Set stock of sourdough bread to 1 for this test
  await sendRequest('/api/products/prod_sourdough/stock', 'POST', { stockQuantity: 1 });

  console.log('📦 Sourdough bread stock set to exactly 1 unit.');

  // Concurrently attempt to lock 1 unit from Customer A and Customer B
  const reqA = sendRequest('/api/cart/lock', 'POST', {
    customerId: 'test_user_alpha',
    items: [{ productId: 'prod_sourdough', qty: 1 }]
  });

  const reqB = sendRequest('/api/cart/lock', 'POST', {
    customerId: 'test_user_beta',
    items: [{ productId: 'prod_sourdough', qty: 1 }]
  });

  const [resA, resB] = await Promise.all([reqA, reqB]);

  console.log('Result User Alpha:', resA.status, resA.body ? (resA.body.success ? 'LOCKED SUCCESS' : resA.body.error) : resA.raw);
  console.log('Result User Beta: ', resB.status, resB.body ? (resB.body.success ? 'LOCKED SUCCESS' : resB.body.error) : resB.raw);

  const successCount = (resA.body?.success ? 1 : 0) + (resB.body?.success ? 1 : 0);
  const conflictCount = (resA.status === 409 ? 1 : 0) + (resB.status === 409 ? 1 : 0);

  if (successCount === 1 && conflictCount === 1) {
    console.log('✅ PASS: Exactly 1 customer acquired the 5-minute atomic lock. Overbooking prevented!');
  } else {
    console.error('❌ FAIL: Expected 1 success and 1 conflict, got', { successCount, conflictCount });
  }

  // Release lock
  await sendRequest('/api/cart/release', 'POST', { customerId: 'test_user_alpha' });
  await sendRequest('/api/cart/release', 'POST', { customerId: 'test_user_beta' });
  console.log('🧹 Cleaned up test locks.');
}

runTest().catch(console.error);
