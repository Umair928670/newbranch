import Ably from 'ably';
// use global fetch available in Node 18+

const DRIVER_ID = process.argv[2] || '69ea55cc-e3cb-470a-b0c8-8176a82415c5';
const BASES = ['http://localhost:3002', 'http://localhost:3001', 'http://localhost:3000'];

(async () => {
  let base;
  for (const b of BASES) {
    try {
      const r = await fetch(`${b}/api/test/publish`);
      if (r.ok) { base = b; break; }
    } catch (e) {}
  }
  base = base || BASES[0];
  console.log('Using base', base);

  // Obtain token request
  const tokenRes = await fetch(`${base}/api/auth/ably?userId=${DRIVER_ID}`);
  const tokenReq = await tokenRes.json();
  console.log('Got tokenRequest');

  const client = new Ably.Realtime({ authCallback: (tokenParams, callback) => callback(null, tokenReq) });
  const channel = client.channels.get(`driver:${DRIVER_ID}`);
  channel.subscribe((msg) => {
    console.log('Received message on driver channel:', msg.name, msg.data);
  });

  // Trigger e2e publish
  console.log('Triggering /api/test/e2e');
  try {
    const e = await fetch(`${base}/api/test/e2e`);
    console.log('Triggered e2e, status', e.status);
  } catch (err) { console.error('Trigger failed', err); }

  // wait 8 seconds
  await new Promise(r => setTimeout(r, 8000));
  console.log('Done, closing');
  client.close();
  process.exit(0);
})();
