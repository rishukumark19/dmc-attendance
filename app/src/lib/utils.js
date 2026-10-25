// Date/time helpers (IST — Asia/Kolkata)
export const pad = (n) => String(n).padStart(2, '0');

/**
 * Standard IST timezone extractor using Intl.DateTimeFormat (robust across all client locales)
 */
export const getISTParts = (date = new Date()) => {
  if (!date) return null;
  const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
  if (isNaN(d.getTime())) return null;
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const get = (type) => parts.find((p) => p.type === type)?.value || '';
    return {
      year: get('year'),
      month: get('month'),
      day: get('day'),
      hour: get('hour'),
      minute: get('minute'),
      second: get('second'),
    };
  } catch {
    return null;
  }
};

export const todayIST = () => {
  const p = getISTParts(new Date());
  return p ? `${p.year}-${p.month}-${p.day}` : '';
};

export const monthIST = () => {
  const p = getISTParts(new Date());
  return p ? `${p.year}-${p.month}` : '';
};

// Safe duration calculation in hours (guards against NaN, invalid ISOs, clock reversals)
export const hrs = (i, o) => {
  if (!i || !o) return 0;
  const start = new Date(i).getTime();
  const end = new Date(o).getTime();
  if (isNaN(start) || isNaN(end) || end < start) return 0;
  return Math.max(0, (end - start) / 3600000);
};

// Standard Nagar Nigam daily wage: ₹450 for full 8-hour shift (₹56.25/hr)
const configuredRate = Number(import.meta.env?.VITE_DAILY_RATE);
export const DAILY_RATE = (!isNaN(configuredRate) && configuredRate > 0) ? configuredRate : 450;
export const RATE = DAILY_RATE / 8; // 56.25 per hour
export const pay = (h) => {
  const validH = Number(h);
  if (isNaN(validH) || validH <= 0) return 0;
  return Math.round(Math.min(8, validH) * RATE * 100) / 100;
};

export const money = (n) => {
  const val = Number(n);
  if (isNaN(val)) return '₹0';
  return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

// Formats timestamp as HH:MM in Asia/Kolkata timezone consistently
export const fmtT = (iso) => {
  if (!iso) return '—';
  try {
    const p = getISTParts(iso);
    if (!p) {
      if (/^\d{1,2}:\d{2}/.test(String(iso))) return String(iso).slice(0, 5);
      return '—';
    }
    return `${p.hour}:${p.minute}`;
  } catch {
    return '—';
  }
};

// Check if a shift was left incomplete (missing checkout on past day)
export const isPastIncomplete = (rec) => {
  return !!rec?.in_time && !rec?.out_time && rec?.date !== todayIST();
};

// Prevent CSV formula injection for spreadsheet software (Excel, Calc, Sheets)
export const sanitizeCSVCell = (val) => {
  const str = String(val ?? '');
  // Protect against spreadsheet formula injection (=, +, -, @, tab, cr, |, %) including leading spaces
  if (/^[=+\-@\t\r|%]/.test(str.trimStart())) {
    return "'" + str;
  }
  return str;
};

/**
 * RFC-4180 compliant CSV line parser supporting quoted fields and commas inside quotes
 */
export const parseCSVLine = (line) => {
  if (!line || typeof line !== 'string') return [];
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
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
    const p = getISTParts(d);
    const monthKey = p ? `${p.year}-${p.month}` : `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    return {
      value: monthKey,
      label: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }),
    };
  });
};

/**
 * Format timestamp for audit logs ensuring single-line output (no am/pm wrapping)
 */
export const fmtAuditTimestamp = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dateStr = d.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    });
    const timeStr = d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).toUpperCase();
    return `${dateStr},\u00A0${timeStr.replace(/\s+/g, '\u00A0')}`;
  } catch {
    return '—';
  }
};

/**
 * Strips Hindi / bilingual text from ward names (e.g. "Ward 12 (Bank More / बैंक मोड़)" -> "Ward 12 (Bank More)")
 */
export const cleanWard = (w) => {
  if (!w) return '';
  return String(w)
    .replace(/\s*\/\s*[\u0900-\u097F\s]+(?=\))/g, '')
    .replace(/[\u0900-\u097F]+/g, '')
    .replace(/\s*\/\s*\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
};
