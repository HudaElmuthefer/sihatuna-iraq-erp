// tools/simulate_hl7_result.js
//
// Fake lab analyzer simulator — sends a test HL7 message to your HL7
// server, exactly like a real device would, so you can confirm the whole
// pipeline works end to end without any real equipment.
//
// How to use:
//   1) Make sure the backend is running (the HL7 server listens on port
//      2575 automatically)
//   2) In the system, open the Laboratory page and create a new test
//      request, note the request number (reqNo) shown (e.g. REQ-0001)
//   3) Edit the REQ_NO variable below to match that exact number
//   4) Run: node tools/simulate_hl7_result.js
//   5) Go back to the Laboratory page in the browser and refresh — the
//      request should automatically show as "completed" with the fake
//      result, with no manual entry from you
const net = require('net');

const HOST = process.env.HL7_HOST || 'localhost';
const PORT = process.env.HL7_PORT || 2575;

// ⚠️ Edit this to match a real request number that exists in your system
// (from the Laboratory page)
const REQ_NO = 'LAB-2026-0003';
const PATIENT_NAME = 'Hasan Mahmoud Al-Zubaidi';
const TEST_TYPE = 'CBC';
const RESULT_VALUE = 'Hemoglobin: 13.5 g/dL (Normal)';

const VT = String.fromCharCode(0x0b);
const FS = String.fromCharCode(0x1c);
const CR = String.fromCharCode(0x0d);

const now = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);

// Fake ORU^R01 HL7 message — built roughly the same way a real device would
const hl7Message = [
  `MSH|^~\\&|SIMULATOR|LAB|SIHATUNA|HOSPITAL|${now}||ORU^R01|MSG${Date.now()}|P|2.3`,
  `PID|1||${REQ_NO}||${PATIENT_NAME.split(' ').join('^')}`,
  `OBR|1|${REQ_NO}||${TEST_TYPE}^${TEST_TYPE} Panel^L`,
  `OBX|1|ST|${TEST_TYPE}||${RESULT_VALUE}||||||F`,
].join(CR) + CR;

const framed = VT + hl7Message + FS + CR;

console.log(`🧪 Simulating an HL7 result send to ${HOST}:${PORT} ...`);
console.log(`   Request number (reqNo): ${REQ_NO}`);

const client = net.createConnection({ host: HOST, port: PORT }, () => {
  client.write(framed);
});

client.on('data', (data) => {
  console.log('✅ Received an acknowledgment (ACK) from the server:');
  console.log(data.toString().replace(/[\x0b\x1c]/g, '').trim());
  client.end();
});

client.on('error', (err) => {
  console.error('❌ Connection failed — make sure the backend is running and the HL7 server is enabled:', err.message);
});

client.on('close', () => {
  console.log('🔌 Connection closed. Open the Laboratory page in the browser and refresh to check.');
});
