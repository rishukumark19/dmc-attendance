import fs from 'fs';

const attendance = JSON.parse(fs.readFileSync('scratch/demo_attendance.json', 'utf8'));
const corrections = JSON.parse(fs.readFileSync('scratch/demo_corrections.json', 'utf8'));

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const str = String(v).replace(/'/g, "''");
  return `'${str}'`;
}

// Group into batches of 50 for clean execution
const batches = [];
const batchSize = 50;

for (let i = 0; i < attendance.length; i += batchSize) {
  const slice = attendance.slice(i, i + batchSize);
  const rowsSql = slice.map(r => {
    const idVal = r.id ? sqlVal(r.id) : 'gen_random_uuid()';
    return `(${idVal}, ${sqlVal(r.staff_user_id)}, ${sqlVal(r.emp_id)}, ${sqlVal(r.staff_name)}, ${sqlVal(r.date)}, ${sqlVal(r.month_key)}, ${sqlVal(r.in_time)}, ${sqlVal(r.out_time)}, ${sqlVal(r.created_at)}, ${sqlVal(r.ward)}, ${sqlVal(r.status)}, ${sqlVal(r.is_corrected)}, ${sqlVal(r.remarks)})`;
  }).join(',\n');

  const sql = `INSERT INTO attendance (id, staff_user_id, emp_id, staff_name, date, month_key, in_time, out_time, created_at, ward, status, is_corrected, remarks) VALUES\n${rowsSql};`;
  batches.push(sql);
}

fs.writeFileSync('scratch/attendance_batches.json', JSON.stringify(batches, null, 2));

const corrRows = corrections.map(c => {
  return `(${sqlVal(c.attendance_id)}, ${sqlVal(c.staff_user_id)}, ${sqlVal(c.emp_id)}, ${sqlVal(c.staff_name)}, ${sqlVal(c.correction_type)}, ${sqlVal(c.old_in_time)}, ${sqlVal(c.old_out_time)}, ${sqlVal(c.new_in_time)}, ${sqlVal(c.new_out_time)}, ${sqlVal(c.reason)}, ${sqlVal(c.corrected_by)}, ${sqlVal(c.created_at)})`;
}).join(',\n');

const corrSql = `INSERT INTO attendance_corrections (attendance_id, staff_user_id, emp_id, staff_name, correction_type, old_in_time, old_out_time, new_in_time, new_out_time, reason, corrected_by, created_at) VALUES\n${corrRows};`;
fs.writeFileSync('scratch/corrections.sql', corrSql);

console.log(`Generated ${batches.length} SQL batches for attendance and 1 correction script.`);
