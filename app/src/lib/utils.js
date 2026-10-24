// Date/time helpers (IST)
export const pad = (n) => String(n).padStart(2, '0');

export const todayIST = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const monthIST = () => {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const hrs = (i, o) => (i && o ? Math.max(0, (new Date(o) - new Date(i)) / 3600000) : 0);

// Standard Nagar Nigam daily wage: ₹450 for full 8-hour shift (₹56.25/hr)
export const DAILY_RATE = Number(import.meta.env?.VITE_DAILY_RATE) || 450;
export const RATE = DAILY_RATE / 8; // 56.25 per hour
export const pay = (h) => Math.round(Math.min(8, h) * RATE * 100) / 100;

export const money = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

export const fmtT = (iso) => {
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

// Check if a shift was left incomplete (missing checkout on past day)
export const isPastIncomplete = (rec) => {
  return !!rec?.in_time && !rec?.out_time && rec?.date !== todayIST();
};

// Prevent CSV formula injection for spreadsheet software (Excel, Calc)
export const sanitizeCSVCell = (val) => {
  const str = String(val ?? '');
  if (/^[=+\-@\t\r]/.test(str)) {
    return "'" + str;
  }
  return str;
};

export const getInitials = (name) =>
  (name || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export const fillMonths = (count = 12) => {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return {
      value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`,
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    };
  });
};
