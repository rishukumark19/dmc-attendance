// Verification test suite for attendance calculations, CSV sanitization, and data integrity
import assert from 'node:assert';

// Wage calculations based on Nagar Nigam ₹450 / 8-hour shift
const DAILY_RATE = 450;
const RATE = DAILY_RATE / 8; // 56.25/hr
const pay = (h) => Math.round(Math.min(8, h) * RATE * 100) / 100;
const hrs = (i, o) => (i && o ? Math.max(0, (new Date(o) - new Date(i)) / 3600000) : 0);

const pad = (n) => String(n).padStart(2, '0');
const fmtT = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) {
      if (/^\d{1,2}:\d{2}/.test(iso)) return iso.slice(0, 5);
      return '—';
    }
    const parts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';
    return `${hour}:${minute}`;
  } catch {
    return '—';
  }
};

const sanitizeCSVCell = (val) => {
  const str = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
};

// Shift timer math verification
function computeLiveHours(inTimeIso, currentNow) {
  const inMs = new Date(inTimeIso).getTime();
  if (isNaN(inMs)) return null;
  const elapsed = Math.max(0, (currentNow.getTime() - inMs) / 3600000);
  return elapsed.toFixed(2);
}

// Bulk CSV parsing and duplicate validation verification
function parseCSVRows(csvText, existingIds) {
  const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
  const existingSet = new Set(existingIds.map(id => String(id).toUpperCase()));
  const seenInFile = new Set();

  return lines.map((line, idx) => {
    const parts = line.split(',').map(p => p.trim());
    const name = parts[0] || '';
    const empId = (parts[1] || '').toUpperCase();
    const pin = parts[2] || '';
    const ward = parts[3] || 'Ward 12';
    const dept = parts[4] || 'Sanitation';

    let status = 'valid';
    let error = '';
    if (!name || !empId) {
      status = 'error'; error = 'Missing Name or Employee ID';
    } else if (!pin) {
      status = 'error'; error = 'PIN is required';
    } else if (pin.length < 4) {
      status = 'error'; error = 'PIN must be at least 4 digits';
    } else if (seenInFile.has(empId)) {
      status = 'error'; error = 'Duplicate ID within file';
    } else if (existingSet.has(empId)) {
      status = 'error'; error = 'Duplicate ID in Database';
    } else {
      seenInFile.add(empId);
    }

    return { rowNum: idx + 1, name, empId, pin, ward, dept, status, error };
  });
}

// ── TEST RUNNER ──
console.log('--- DMC Attendance Verification Suite ---');

// Test 1: Daily wage calculations
console.log('Test 1: Wage & Shift calculations...');
assert.strictEqual(pay(8), 450, 'Full 8h day must equal ₹450');
assert.strictEqual(pay(4), 225, 'Half 4h day must equal ₹225');
assert.strictEqual(pay(10), 450, 'Overtime over 8h must cap standard shift at ₹450');
assert.strictEqual(pay(0), 0, 'Zero hours must equal ₹0');

// Test 2: CSV Injection defense
console.log('Test 2: CSV sanitization defense...');
assert.strictEqual(sanitizeCSVCell('=cmd|"/C calc"!A0'), "'=cmd|\"/C calc\"!A0", 'Formula prefix = must be sanitized with quote');
assert.strictEqual(sanitizeCSVCell('+123'), "'+123", 'Prefix + must be sanitized');
assert.strictEqual(sanitizeCSVCell('-25'), "'-25", 'Prefix - must be sanitized');
assert.strictEqual(sanitizeCSVCell('@SUM(1)'), "'@SUM(1)", 'Prefix @ must be sanitized');
assert.strictEqual(sanitizeCSVCell('EMP001'), 'EMP001', 'Standard ID must remain unchanged');

// Test 3: Timezone formatting
console.log('Test 3: IST time formatting...');
const testIsoUtc = '2026-10-24T01:00:00.000Z'; // 01:00 UTC = 06:30 IST
assert.strictEqual(fmtT(testIsoUtc), '06:30', 'UTC timestamp must format accurately as 06:30 IST');
assert.strictEqual(fmtT(null), '—', 'Null timestamp must return em-dash');

// Test 4: Live shift timer without NaN
console.log('Test 4: Shift live timer...');
const punchTime = new Date('2026-10-24T06:00:00.000Z');
const clockTime = new Date('2026-10-24T08:30:00.000Z'); // 2.5 hours later
const liveHours = computeLiveHours(punchTime.toISOString(), clockTime);
assert.strictEqual(liveHours, '2.50', 'Live hours should compute exact decimal without NaN');

// Test 5: Bulk import validation and within-file duplicate detection
console.log('Test 5: Bulk import duplicate detection...');
const testCsv = `
Ramesh Kumar,EMP101,123456,Ward 12,Sanitation
Sita Devi,EMP102,654321,Ward 24,Sanitation
Duplicate Person,EMP101,999999,Ward 31,Sanitation
Missing Pin,EMP103,,Ward 12,Sanitation
Short Pin,EMP104,12,Ward 12,Sanitation
Existing In DB,EMP001,888888,Ward 12,Sanitation
`;
const rows = parseCSVRows(testCsv, ['EMP001']);
assert.strictEqual(rows[0].status, 'valid', 'Row 1 should be valid');
assert.strictEqual(rows[1].status, 'valid', 'Row 2 should be valid');
assert.strictEqual(rows[2].status, 'error', 'Row 3 must detect duplicate ID within file');
assert.strictEqual(rows[2].error, 'Duplicate ID within file');
assert.strictEqual(rows[3].status, 'error', 'Row 4 must require PIN');
assert.strictEqual(rows[4].status, 'error', 'Row 5 must require >= 4 digits PIN');
assert.strictEqual(rows[5].status, 'error', 'Row 6 must detect duplicate ID in DB');

console.log('✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
