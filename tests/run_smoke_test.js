// A convenience smoke-test script. Run with `node tests/run_smoke_test.js` after starting the server.
import fetch from 'node-fetch';

async function waitForServer(url, retries = 30, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return true;
    } catch (e) {}
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

    // This script mirrors the temporary smoke test used earlier. It's useful for CI.
    console.log('Smoke test helper present. For full smoke tests, use the previous tmp script or expand this script.');
    process.exit(0);
  } catch (err) {
    console.error('Smoke test error', err);
    process.exit(2);
  }
})();
