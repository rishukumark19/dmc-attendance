import fs from 'fs';

const attendance = JSON.parse(fs.readFileSync('scratch/demo_attendance.json', 'utf8'));
const corrections = JSON.parse(fs.readFileSync('scratch/demo_corrections.json', 'utf8'));

function sqlVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  const str = String(v).replace(/'/g, "''");
  return `'${str}'`;
}

const attRows = attendance.map(r => {
  const idVal = r.id ? sqlVal(r.id) : 'gen_random_uuid()';
  return `(${idVal}, ${sqlVal(r.staff_user_id)}, ${sqlVal(r.emp_id)}, ${sqlVal(r.staff_name)}, ${sqlVal(r.date)}, ${sqlVal(r.month_key)}, ${sqlVal(r.in_time)}, ${sqlVal(r.out_time)}, ${sqlVal(r.created_at)}, ${sqlVal(r.ward)}, ${sqlVal(r.status)}, ${sqlVal(r.is_corrected)}, ${sqlVal(r.remarks)})`;
}).join(',\n');

const corrRows = corrections.map(c => {
  return `(${sqlVal(c.attendance_id)}, ${sqlVal(c.staff_user_id)}, ${sqlVal(c.emp_id)}, ${sqlVal(c.staff_name)}, ${sqlVal(c.correction_type)}, ${sqlVal(c.old_in_time)}, ${sqlVal(c.old_out_time)}, ${sqlVal(c.new_in_time)}, ${sqlVal(c.new_out_time)}, ${sqlVal(c.reason)}, ${sqlVal(c.corrected_by)}, ${sqlVal(c.created_at)})`;
}).join(',\n');

const fullSql = `BEGIN;
DELETE FROM attendance_corrections;
DELETE FROM attendance;
INSERT INTO attendance (id, staff_user_id, emp_id, staff_name, date, month_key, in_time, out_time, created_at, ward, status, is_corrected, remarks) VALUES
${attRows};
INSERT INTO attendance_corrections (attendance_id, staff_user_id, emp_id, staff_name, correction_type, old_in_time, old_out_time, new_in_time, new_out_time, reason, corrected_by, created_at) VALUES
${corrRows};
COMMIT;`;

fs.writeFileSync('scratch/full_import.sql', fullSql);
console.log('Successfully wrote full_import.sql! Length in characters:', fullSql.length);
