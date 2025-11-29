async function waitForServer(url, retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Server did not become ready in time');
}

(async () => {
  try {
    const base = 'http://localhost:8000';
    console.log('Waiting for server...');
    await waitForServer(base);
    console.log('Server ready, running smoke tests...');

    // 1) Register user
    const regBody = {
      username: 'smokeuser',
      email: 'smokeuser@example.com',
      password: 'Pass123!',
      business_name: 'SmokeCo',
      state: 'Karnataka'
    };

    let resp = await fetch(base + '/api/v1/users/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(regBody)
    });
    let j = await resp.json().catch(() => null);
    console.log('register status', resp.status, j);

    // 2) Login
    const loginBody = { email: regBody.email, password: regBody.password };
    resp = await fetch(base + '/api/v1/users/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(loginBody)
    });
    j = await resp.json().catch(() => null);
    console.log('login status', resp.status, j);

    if (resp.status !== 200) {
      throw new Error('Login failed; cannot continue smoke test');
    }

    const token = j.accessToken || j?.data?.accessToken || j?.data?.access_token || j?.accessToken;
    console.log('token', !!token);

    // 3) Create a customer
    const custBody = { name: 'ACME Corp', email: 'acme@example.com', phone: '9999999999', address: { line1: 'No 1', city: 'Bengaluru', state: 'Karnataka' } };
    resp = await fetch(base + '/api/v1/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(custBody)
    });
    j = await resp.json().catch(() => null);
    console.log('create customer', resp.status, j);
    if (resp.status !== 201 && resp.status !== 409) throw new Error('create customer failed');
    const customer = j.customer || j.data || j;
    const customerId = customer._id || customer.id;

    // 4) Create an item
    const itemBody = { name: 'Widget', item_type: 'product', unit_price: 100, tax_rate: 18, stock_quantity: 10 };
    resp = await fetch(base + '/api/v1/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(itemBody)
    });
    j = await resp.json().catch(() => null);
    console.log('create item', resp.status, j);
    if (resp.status !== 201 && resp.status !== 409) throw new Error('create item failed');
    const item = j.data || j.item || j;
    const itemId = item._id || item.id || (item.item && item.item._id) || (j.item && j.item._id);

    // 5) Create invoice
    const invoiceBody = {
      customerId: customerId,
      items: [
        { productId: itemId, description: 'Widget', quantity: 2, unitPrice: 100, taxRate: 18, total: 236 }
      ],
      shippingCharge: 0,
      notes: 'Smoke test invoice'
    };
    resp = await fetch(base + '/api/v1/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(invoiceBody)
    });
    j = await resp.json().catch(() => null);
    console.log('create invoice', resp.status, j);
    if (resp.status !== 201) throw new Error('create invoice failed');

    const inv = j.data || j.invoice || j;
    const invoiceId = inv._id || inv.id;

    // 6) Mark invoice as paid
    const payBody = { amount: Number(inv.grandTotal || inv.grand_total || 236), paymentInfo: { method: 'CASH', transactionId: 'SMOKE-1' } };
    resp = await fetch(base + '/api/v1/invoices/' + invoiceId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(payBody)
    });
    j = await resp.json().catch(() => null);
    console.log('mark paid', resp.status, j);

    console.log('Smoke test complete');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test error', err);
    process.exit(2);
  }
})();
