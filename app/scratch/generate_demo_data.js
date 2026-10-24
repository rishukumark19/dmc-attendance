// Script to generate high-fidelity DMC demo attendance data for September and October 2026 with exact date/time arithmetic
import fs from 'fs';

const STAFF = [
  {
    emp_id: 'EMP001',
    name: 'rishu1',
    user_id: '4d052a83-cd0d-4e1d-adf1-2fe8ea1a01a7',
    ward: 'Ward 12 (Bank More / बैंक मोड़)'
  },
  {
    emp_id: 'EMP002',
    name: 'rishu2',
    user_id: '287b29c9-c694-41df-a549-0f812d4c45fb',
    ward: 'Ward 12 (Bank More / बैंक मोड़)'
  },
  {
    emp_id: 'EMP003',
    name: 'Manoj Kumar',
    user_id: '32b7923c-ecbb-4138-a5c1-478f51d1e934',
    ward: 'Ward 24 (Hirapur / हीरापुर)'
  },
  {
    emp_id: 'EMP004',
    name: 'Rishu45',
    user_id: 'fb6dcc3a-66ff-4a2e-9eda-8c2719693df2',
    ward: 'Ward 31 (Steel Gate / स्टील गेट)'
  },
  {
    emp_id: 'EMP005',
    name: 'rishu kumar',
    user_id: 'da156319-0bc2-4b57-8855-ded85297ec83',
    ward: 'Ward 45 (Saraidhela / सरायढेला)'
  }
];

function pad(n) {
  return String(n).padStart(2, '0');
}

// Convert IST date and time components to proper ISO string with +05:30
function formatIST(dateStr, hour, minute) {
  // Normalize minutes and hours if minute >= 60
  let extraH = Math.floor(minute / 60);
  let finalM = minute % 60;
  let finalH = hour + extraH;
  return `${dateStr}T${pad(finalH)}:${pad(finalM)}:00+05:30`;
}

// Check day of week for YYYY-MM-DD (0 = Sunday)
function getDayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getDay();
}

const attendanceRows = [];
const correctionRows = [];

// 1. Generate September 2026 (2026-09-01 to 2026-09-30)
for (let day = 1; day <= 30; day++) {
  const dateStr = `2026-09-${pad(day)}`;
  const dow = getDayOfWeek(dateStr);
  if (dow === 0) continue; // Skip Sundays

  // EMP001 (rishu1) - Worked all 26 working days. Short shift on 15th
  {
    const s = STAFF[0];
    const inH = 6;
    const inM = 10 + ((day * 7) % 35); // 06:10 - 06:44
    const isShort = (day === 15);
    const durationM = isShort ? 360 : (485 + ((day * 3) % 25)); // 6.0h or 8.08h - 8.48h
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-09',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: isShort ? 'Partial half-shift (approved)' : null
    });
  }

  // EMP002 (rishu2) - Absent on 9th & 22nd
  if (day !== 9 && day !== 22) {
    const s = STAFF[1];
    const inH = 6;
    const inM = 5 + ((day * 5) % 35);
    const durationM = 482 + ((day * 4) % 20);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-09',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: null
    });
  }

  // EMP003 (Manoj Kumar) - Sep 24 has approved regularization
  {
    const s = STAFF[2];
    const inH = 6;
    const inM = 15 + ((day * 3) % 30);
    const durationM = 485 + ((day * 2) % 25);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    const isCorrected = (day === 24);

    attendanceRows.push({
      id: isCorrected ? 'c0a80101-0000-4000-a000-000000000024' : undefined,
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-09',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: isCorrected,
      remarks: isCorrected ? 'Regularized by Ward Supervisor (manual muster roll verified)' : null
    });

    if (isCorrected) {
      correctionRows.push({
        attendance_id: 'c0a80101-0000-4000-a000-000000000024',
        staff_user_id: s.user_id,
        emp_id: s.emp_id,
        staff_name: s.name,
        correction_type: 'CHECKOUT_REGULARIZATION',
        old_in_time: inTime,
        old_out_time: null,
        new_in_time: inTime,
        new_out_time: outTime,
        reason: 'Staff forgot biometric checkout while responding to municipal waterlogging alert at Ward 24.',
        corrected_by: 'Admin',
        created_at: '2026-09-25T09:30:00+05:30'
      });
    }
  }

  // EMP004 (Rishu45) - Absent on 4th, 18th
  if (day !== 4 && day !== 18) {
    const s = STAFF[3];
    const inH = 6;
    const inM = 20 + ((day * 4) % 25);
    const durationM = 485 + ((day * 3) % 25);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-09',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: null
    });
  }

  // EMP005 (rishu kumar) - Absent on 2nd, 16th, 28th
  if (day !== 2 && day !== 16 && day !== 28) {
    const s = STAFF[4];
    const inH = 6;
    const inM = 12 + ((day * 6) % 35);
    const durationM = 483 + ((day * 2) % 20);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-09',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: null
    });
  }
}

// 2. Generate October 2026 (2026-10-01 to 2026-10-23 past days)
for (let day = 1; day <= 23; day++) {
  const dateStr = `2026-10-${pad(day)}`;
  const dow = getDayOfWeek(dateStr);
  if (dow === 0) continue; // Skip Sundays

  // EMP001 (rishu1) - Short shift on Oct 14
  {
    const s = STAFF[0];
    const inH = 6;
    const inM = 12 + ((day * 5) % 30);
    const isShort = (day === 14);
    const durationM = isShort ? 360 : (482 + ((day * 3) % 25));
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-10',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: isShort ? 'Short shift - medical permission' : null
    });
  }

  // EMP002 (rishu2) - Absent on 12th
  if (day !== 12) {
    const s = STAFF[1];
    const inH = 6;
    const inM = 8 + ((day * 6) % 35);
    const durationM = 484 + ((day * 2) % 25);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-10',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: null
    });
  }

  // EMP003 (Manoj Kumar) - On Oct 21, incomplete shift (missing checkout) for Rule 12 & Exception audit
  {
    const s = STAFF[2];
    const inH = 6;
    const inM = 18 + ((day * 4) % 25);
    const isIncomplete = (day === 21);
    const durationM = 485 + ((day * 3) % 20);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = isIncomplete ? null : formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-10',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: isIncomplete ? 'Shift checkout missing' : null
    });
  }

  // EMP004 (Rishu45) - Absent on 7th & 15th
  if (day !== 7 && day !== 15) {
    const s = STAFF[3];
    const inH = 6;
    const inM = 15 + ((day * 5) % 30);
    const durationM = 486 + ((day * 2) % 20);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-10',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: null
    });
  }

  // EMP005 (rishu kumar) - Absent on 3rd
  if (day !== 3) {
    const s = STAFF[4];
    const inH = 6;
    const inM = 10 + ((day * 7) % 30);
    const durationM = 483 + ((day * 3) % 20);
    const outTotalM = inH * 60 + inM + durationM;
    const outH = Math.floor(outTotalM / 60);
    const outM = outTotalM % 60;

    const inTime = formatIST(dateStr, inH, inM);
    const outTime = formatIST(dateStr, outH, outM);
    attendanceRows.push({
      staff_user_id: s.user_id,
      emp_id: s.emp_id,
      staff_name: s.name,
      date: dateStr,
      month_key: '2026-10',
      in_time: inTime,
      out_time: outTime,
      created_at: inTime,
      ward: s.ward,
      status: 'Present',
      is_corrected: false,
      remarks: null
    });
  }
}

// 3. Today: 2026-10-24 (Saturday) Live status
const todayStr = '2026-10-24';
// EMP001 (rishu1): Active check-in at 06:15 AM today, currently on duty!
{
  const s = STAFF[0];
  const inTime = `${todayStr}T06:15:00+05:30`;
  attendanceRows.push({
    staff_user_id: s.user_id,
    emp_id: s.emp_id,
    staff_name: s.name,
    date: todayStr,
    month_key: '2026-10',
    in_time: inTime,
    out_time: null, // Active duty!
    created_at: inTime,
    ward: s.ward,
    status: 'Present',
    is_corrected: false,
    remarks: 'Live duty'
  });
}

// EMP002 (rishu2): Completed shift today (06:05 to 14:10)
{
  const s = STAFF[1];
  const inTime = `${todayStr}T06:05:00+05:30`;
  const outTime = `${todayStr}T14:10:00+05:30`;
  attendanceRows.push({
    staff_user_id: s.user_id,
    emp_id: s.emp_id,
    staff_name: s.name,
    date: todayStr,
    month_key: '2026-10',
    in_time: inTime,
    out_time: outTime,
    created_at: inTime,
    ward: s.ward,
    status: 'Present',
    is_corrected: false,
    remarks: 'Completed'
  });
}

// EMP003 (Manoj Kumar): Checked in at 06:40 AM today, active on duty
{
  const s = STAFF[2];
  const inTime = `${todayStr}T06:40:00+05:30`;
  attendanceRows.push({
    staff_user_id: s.user_id,
    emp_id: s.emp_id,
    staff_name: s.name,
    date: todayStr,
    month_key: '2026-10',
    in_time: inTime,
    out_time: null, // Active duty
    created_at: inTime,
    ward: s.ward,
    status: 'Present',
    is_corrected: false,
    remarks: 'Live duty'
  });
}

// EMP004 (Rishu45): Completed shift today (06:20 to 14:35)
{
  const s = STAFF[3];
  const inTime = `${todayStr}T06:20:00+05:30`;
  const outTime = `${todayStr}T14:35:00+05:30`;
  attendanceRows.push({
    staff_user_id: s.user_id,
    emp_id: s.emp_id,
    staff_name: s.name,
    date: todayStr,
    month_key: '2026-10',
    in_time: inTime,
    out_time: outTime,
    created_at: inTime,
    ward: s.ward,
    status: 'Present',
    is_corrected: false,
    remarks: 'Completed'
  });
}
// EMP005: Absent today

console.log(`Generated ${attendanceRows.length} attendance rows.`);
console.log(`Generated ${correctionRows.length} correction rows.`);

fs.writeFileSync('scratch/demo_attendance.json', JSON.stringify(attendanceRows, null, 2));
fs.writeFileSync('scratch/demo_corrections.json', JSON.stringify(correctionRows, null, 2));
