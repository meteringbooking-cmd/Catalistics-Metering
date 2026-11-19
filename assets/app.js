// Catalistics — shared application module.
// Every page imports from here: Firebase connection, sign-in check, page shell
// (sidebar + top bar), settings, and small helpers for dates, numbers, tables,
// spreadsheets and charts.

import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, onSnapshot
};

export const app = getApps()[0] || initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Analytics is optional and only loads where the browser supports it.
(async () => {
  try {
    if (!firebaseConfig.measurementId) return;
    const { getAnalytics, isSupported } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js');
    if (await isSupported()) getAnalytics(app);
  } catch (e) { /* analytics is non-essential */ }
})();

export const PRODUCT = 'Catalistics';

/* =====================================================================
   Collections — one place that names every Firestore collection.
   ===================================================================== */
export const C = {
  settings: 'settings',                 // doc "config" holds every target, KPI and list
  users: 'users',                       // sign-in accounts and their role
  engineers: 'engineers',               // engineer directory
  dailyPerformance: 'dailyPerformance', // one record per engineer per day
  attendance: 'attendance',             // one attendance code per engineer per day
  absences: 'absences',
  scheduledJobs: 'scheduledJobs',
  vehicleChecks: 'vehicleChecks',
  vanJourneys: 'vanJourneys',
  speedingIncidents: 'speedingIncidents',
  complianceAudits: 'complianceAudits',
  complaints: 'complaints',
  jobRefusals: 'jobRefusals',
  noAccessVisits: 'noAccessVisits',
  customerPayments: 'customerPayments',
  escalations: 'escalations',
  qualifications: 'qualifications',
  testerCalibrations: 'testerCalibrations',
  additionalPayments: 'additionalPayments',
  bonusAdjustments: 'bonusAdjustments',
  bonusStatements: 'bonusStatements',
  financeEntries: 'financeEntries',
  onCallRota: 'onCallRota',
  meetings: 'meetings',
  notifications: 'notifications',
  portalDocuments: 'portalDocuments',
  aiUsage: 'aiUsage',                   // one record per AI question: who, tokens, cost
};

/* =====================================================================
   Default settings. Everything here can be changed on Targets & KPIs
   (data-input.html); nothing on any other page is hard-coded.
   ===================================================================== */
export const DEFAULT_CONFIG = {
  company: {
    clientName: 'Client Name',
    tagline: 'Field performance platform',
    currency: '£',
    workingDays: [1, 2, 3, 4, 5],
    bankHolidays: [],
    screenRefreshMinutes: 5,
    timeZone: 'Europe/London',
  },
  contracts: [
    { id: 'contract-a', name: 'Contract A', colour: '#3d8fe0', active: true, dailyMeterTarget: 4, completionTarget: 85, abortRateMax: 10, milesPerMeterMax: 12, revenuePerMeter: 120, costPerEngineerDay: 230 },
    { id: 'contract-b', name: 'Contract B', colour: '#33c48a', active: true, dailyMeterTarget: 3.5, completionTarget: 80, abortRateMax: 12, milesPerMeterMax: 15, revenuePerMeter: 135, costPerEngineerDay: 230 },
  ],
  teams: [
    { id: 'team-1', name: 'Team 1', leader: 'Team Leader 1', contractId: 'contract-a' },
    { id: 'team-2', name: 'Team 2', leader: 'Team Leader 2', contractId: 'contract-a' },
    { id: 'team-3', name: 'Team 3', leader: 'Team Leader 3', contractId: 'contract-b' },
    { id: 'team-4', name: 'Team 4', leader: 'Team Leader 4', contractId: 'contract-b' },
  ],
  attendanceCodes: [
    { code: 'X', label: 'Working', type: 'working', colour: '#33c48a' },
    { code: 'T', label: 'Training', type: 'nonProductive', colour: '#5aaef0' },
    { code: 'A', label: 'Office / admin day', type: 'nonProductive', colour: '#8ea2c4' },
    { code: 'H', label: 'Holiday', type: 'holiday', colour: '#a78bfa' },
    { code: 'S', label: 'Sickness', type: 'sickness', colour: '#f06363' },
    { code: 'U', label: 'Unauthorised absence', type: 'absence', colour: '#f3b440' },
    { code: 'O', label: 'Rest day / not scheduled', type: 'off', colour: '#5d7299' },
  ],
  targets: {
    attendanceTarget: 95,
    vehicleCheckTarget: 100,
    complianceTarget: 90,
    complaintResponseDays: 10,
    escalationTargetDays: 5,
    qualificationWarnDays: 60,
    calibrationIntervalMonths: 12,
    amberBandPct: 10,
    capacityGoodPct: 90,
    capacityWarnPct: 75,
    leagueMinDays: 3,
  },
  league: { weights: { meters: 40, completion: 25, aborts: 10, attendance: 15, compliance: 10 } },
  bonus: {
    thresholdMetersPerDay: 3,
    ratePerMeter: 8,
    ratePerCompletedJob: 0,
    minCompletionPct: 70,
    qualityBands: [
      { min: 95, multiplier: 1 },
      { min: 85, multiplier: 0.9 },
      { min: 0, multiplier: 0.8 },
    ],
    deductionTypes: ['Customer service', 'Vehicle condition', 'Housekeeping', 'Compliance', 'Timekeeping', 'Other'],
  },
  fleet: { lateStartAfter: '08:15', earlyFinishBefore: '16:00', afterHoursAfter: '19:30', longDayHours: 10, speedingToleranceMph: 10 },
  absence: { bradfordTrigger: 51, occurrenceTrigger: 3, lookbackMonths: 12 },
  compliance: { passMark: 80 },
  ai: {
    enabled: true,
    assistantName: 'Catalistics AI',
    model: 'claude-sonnet-5-5',
    inputPricePerMillion: 2,
    outputPricePerMillion: 10,
    priceCurrency: '$',
    monthlyBudget: 50,
    dailyQuestionsPerUser: 50,
    maxAnswerTokens: 2000,
    maxToolRounds: 8,
    suggestedQuestions: [
      'How did each team do against target last week?',
      'Who are the top five engineers this month by meters per day?',
      'Which engineers are below 80% completion this month?',
      'How many complaints are open and which are overdue?',
      'Compare attendance by team this month.',
      'What is the revenue forecast for this month by contract?',
    ],
  },
  lists: {
    absenceTypes: ['Sickness', 'Unauthorised', 'Compassionate', 'Medical appointment', 'Other'],
    qualifications: ['Smart metering – electric', 'Smart metering – gas', 'Gas safety', 'Electrical safety', 'First aid', 'Working at height', 'Asbestos awareness', 'Driving licence check'],
    auditCategories: ['Health & safety', 'Installation quality', 'Paperwork', 'Customer experience', 'Vehicle & tools'],
    complaintCategories: ['Engineer conduct', 'Property damage', 'Missed appointment', 'Installation fault', 'Communication', 'Other'],
    paymentTypes: [
      { name: 'Standby', unit: 'day', rate: 50 },
      { name: 'Overtime', unit: 'hour', rate: 22 },
      { name: 'Working away', unit: 'night', rate: 35 },
      { name: 'Additional job', unit: 'job', rate: 25 },
      { name: 'Other', unit: 'item', rate: 0 },
    ],
    meetingTypes: ['One-to-one', 'Van audit', 'Ride-along', 'Performance review', 'Return to work', 'Toolbox talk'],
    jobTypes: [
      { name: 'Electric install', minutes: 90, meters: 1 },
      { name: 'Gas install', minutes: 90, meters: 1 },
      { name: 'Dual fuel install', minutes: 150, meters: 2 },
      { name: 'Meter exchange', minutes: 60, meters: 1 },
      { name: 'Investigation', minutes: 45, meters: 0 },
    ],
    jobOutcomes: ['Booked', 'Completed', 'Aborted', 'No access', 'Cancelled', 'Rescheduled'],
    dayCapacityHours: 8,
    abortReasons: ['Unsafe site', 'Customer refused', 'Equipment fault', 'No signal', 'Access issue', 'Stock shortage', 'Other'],
    refusalReasons: ['Health & safety concern', 'Out of skill scope', 'Out of area', 'Vehicle issue', 'Other'],
    customerPaymentTypes: ['Missed appointment', 'Late arrival', 'Failed installation', 'Goodwill', 'Other'],
    escalationTypes: ['Systems', 'Stock', 'Customer', 'Scheduling', 'Data', 'Other'],
    documentCategories: ['Policies', 'Procedures', 'Forms', 'Training', 'Other'],
    employmentTypes: ['Employed', 'Subcontractor', 'Agency'],
    engineerLevels: ['Trainee', 'Level 1', 'Level 2', 'Level 3', 'Senior'],
    financeCategories: ['Vehicles', 'Fuel', 'Stock & materials', 'Subcontractors', 'Tools & equipment', 'Overheads', 'Other'],
  },
};

/* =====================================================================
   Page catalogue — drives the sidebar and the home page.
   roles: who can open it. "manager" covers office staff and team leaders.
   ===================================================================== */
export const CATEGORIES = [
  ['screens', 'Live screens', 'Wall screens and daily views for the office and team leaders.'],
  ['data', 'Daily data', 'Where each day\'s performance, attendance and jobs go in.'],
  ['reports', 'Reports', 'Dashboards, league tables, finance and exports.'],
  ['pay', 'Bonus & pay', 'Bonus calculations and additional payment claims.'],
  ['people', 'People', 'Engineers, absence, capacity, rotas and meetings.'],
  ['quality', 'Quality & compliance', 'Audits, complaints, exceptions and qualifications.'],
  ['fleet', 'Fleet', 'Vehicle checks, van times and driving.'],
  ['portal', 'Engineer portal', 'What engineers see, and what you publish to them.'],
  ['admin', 'Administration', 'Targets, KPIs, users and demo data.'],
];

export const PAGES = [
  ['work-screen.html', 'Work Screen', 'screens', '📺', 'Live view of every contract: meters against target, completion, aborts, attendance and a 10-day trend.'],
  ['office-screen.html', 'Office Screen', 'screens', '🖥️', 'Big-number wall display that rotates through each contract and the day\'s top performers.'],
  ['daily-performance.html', 'Daily Performance', 'screens', '📅', 'Previous working day by team and engineer, against each contract\'s targets.'],
  ['weekly-performance.html', 'Weekly Performance', 'screens', '🗓️', 'Five-week view per engineer: meters, average per day and completion.'],

  ['submit-performance.html', 'Submit Performance', 'data', '📝', 'Enter or upload each engineer\'s figures for a day. Re-open any date to amend it.'],
  ['attendance.html', 'Attendance', 'data', '🙋', 'Record each engineer\'s attendance code for the day, and see the month as a calendar.'],
  ['scheduling.html', 'Job Scheduling', 'data', '🧭', 'Upload and manage booked jobs per engineer; set outcomes and send totals to performance.'],

  ['catalistics-ai.html', 'Catalistics AI', 'reports', '✨', 'Ask questions about your data in plain English and get answers from the live figures.'],
  ['executive-dashboard.html', 'Executive Dashboard', 'reports', '🏢', 'Month-to-date headline numbers, revenue forecast and the issues that need attention.'],
  ['performance-report.html', 'Performance Report', 'reports', '📈', 'Any date range by contract, team and engineer, with charts and Excel export.'],
  ['league-table.html', 'League Table', 'reports', '🏆', 'Engineers ranked on a weighted score of meters, completion, aborts, attendance and compliance.'],
  ['finance.html', 'Finance', 'reports', '💷', 'Revenue, costs, margin and month-end forecast per contract.'],

  ['bonus-calculator.html', 'Bonus Calculator', 'pay', '🎯', 'Bonus per engineer from meters, quality and deductions. Approve to publish to the portal.'],
  ['additional-payments.html', 'Additional Payments', 'pay', '🧾', 'Approve, amend or reject standby, overtime and other claims, and export for payroll.'],

  ['engineers.html', 'Engineers', 'people', '👷', 'The engineer directory: contract, team, level, employment type and status.'],
  ['absences.html', 'Absences', 'people', '🩺', 'Absence records with Bradford Factor and trigger alerts.'],
  ['capacity.html', 'Capacity Planner', 'people', '📊', 'Available engineer-days and meter capacity per team for the weeks ahead.'],
  ['on-call.html', 'On-Call Rota', 'people', '📞', 'Who is on call and when.'],
  ['meetings.html', 'Meetings', 'people', '🤝', 'One-to-ones, van audits, ride-alongs and reviews by team leader.'],

  ['compliance-audits.html', 'Compliance Audits', 'quality', '✅', 'Audit results with pass rates by team, engineer and category, and open actions.'],
  ['complaints.html', 'Complaints', 'quality', '📣', 'Customer complaints with target response dates and status.'],
  ['job-refusals.html', 'Job Refusals', 'quality', '⛔', 'Jobs refused by engineers, with reasons.'],
  ['no-access.html', 'No Access Visits', 'quality', '🚪', 'No-access jobs with up to three attempts recorded.'],
  ['customer-payments.html', 'Customer Payments', 'quality', '💳', 'Compensation and goodwill payments made to customers.'],
  ['escalations.html', 'Escalations', 'quality', '🎫', 'Issues raised with suppliers or other teams, and how long they have been open.'],
  ['skills-matrix.html', 'Skills Matrix', 'quality', '🧩', 'Every engineer\'s qualifications with expiry dates, colour-coded.'],
  ['tester-calibration.html', 'Tester Calibration', 'quality', '🔧', 'Test equipment per engineer with calibration due dates.'],

  ['vehicle-checks.html', 'Vehicle Checks', 'fleet', '🚐', 'Daily vehicle checks, defects, and who was working without a check.'],
  ['van-times.html', 'Van Times', 'fleet', '⏱️', 'First start and last finish per day: late starts, early finishes and long days.'],
  ['speeding.html', 'Speeding', 'fleet', '🚦', 'Speeding incidents by engineer and team.'],

  ['portal.html', 'Engineer Portal', 'portal', '📱', 'What an engineer sees: their figures, bonus, claims, notices and documents.', ['admin', 'manager', 'engineer']],
  ['notifications.html', 'Portal Notices', 'portal', '🔔', 'Publish notices to all engineers, a team or one engineer.'],
  ['documents.html', 'Portal Documents', 'portal', '📂', 'Upload policies, forms and guides for engineers to read in the portal.'],

  ['data-input.html', 'Targets & KPIs', 'admin', '🎛️', 'Every target, KPI, rate, contract, team and list used across the system.', ['admin']],
  ['users.html', 'Users & Access', 'admin', '🔐', 'Create sign-ins and choose what each person can see.', ['admin']],
  ['ai-usage.html', 'AI Usage', 'admin', '🧮', 'Every question asked of Catalistics AI, by whom, and what it cost against the monthly budget.', ['admin']],
  ['demo-data.html', 'Demo Data', 'admin', '🧪', 'Fill the system with sample data for a demonstration, or clear it again.', ['admin']],
].map(([file, name, cat, icon, desc, roles]) => ({ file, name, cat, icon, desc, roles: roles || ['admin', 'manager'] }));

/* =====================================================================
   Small DOM helpers
   ===================================================================== */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function options(list, selected, { blank } = {}) {
  const items = list.map(o => (typeof o === 'object' ? o : { value: o, label: o }));
  return (blank !== undefined ? `<option value="">${esc(blank)}</option>` : '') +
    items.map(o => `<option value="${esc(o.value)}"${String(o.value) === String(selected ?? '') ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
}
export function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
}
export function uid() { return Math.random().toString(36).slice(2, 10); }

/* =====================================================================
   Numbers & formatting
   ===================================================================== */
export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export function fmtNum(v, dp = 0) {
  if (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) return '–';
  return Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
export function fmtPct(v, dp = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '–';
  return `${Number(v).toFixed(dp)}%`;
}
export function fmtMoney(v, dp = 0) {
  if (!Number.isFinite(Number(v))) return '–';
  const c = state.cfg?.company?.currency ?? '£';
  const n = Number(v);
  return `${n < 0 ? '-' : ''}${c}${Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
}
export const pct = (a, b) => (b ? (a / b) * 100 : null);

/** good / warn / bad against a target. higher=true when bigger is better. */
export function rag(value, target, { higher = true, warnBand = (state.cfg?.targets?.amberBandPct ?? 10) / 100 } = {}) {
  if (value === null || value === undefined || !Number.isFinite(value) || !target) return '';
  if (higher) {
    if (value >= target) return 'good';
    if (value >= target * (1 - warnBand)) return 'warn';
    return 'bad';
  }
  if (value <= target) return 'good';
  if (value <= target * (1 + warnBand)) return 'warn';
  return 'bad';
}

/* =====================================================================
   Dates — all stored as 'YYYY-MM-DD' strings in local time.
   ===================================================================== */
export function iso(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
export function parseISO(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); }
export const todayISO = () => iso(new Date());
export function addDays(s, n) { const d = parseISO(s); d.setDate(d.getDate() + n); return iso(d); }
export function addMonths(s, n) { const d = parseISO(s); d.setMonth(d.getMonth() + n); return iso(d); }
export function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
export function weekStart(s) { const d = parseISO(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return iso(d); }
export function monthStart(s) { return s.slice(0, 8) + '01'; }
export function monthEnd(s) { const d = parseISO(monthStart(s)); d.setMonth(d.getMonth() + 1); d.setDate(0); return iso(d); }
export function fmtDate(s, opts = { weekday: 'short', day: '2-digit', month: 'short' }) {
  if (!s) return '–';
  return parseISO(s).toLocaleDateString('en-GB', opts);
}
export function fmtDateLong(s) { return fmtDate(s, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
export function isWorkingDay(s, cfg = state.cfg) {
  const days = cfg?.company?.workingDays || [1, 2, 3, 4, 5];
  const dow = parseISO(s).getDay();
  return days.includes(dow) && !(cfg?.company?.bankHolidays || []).includes(s);
}
export function prevWorkingDay(s = todayISO(), cfg = state.cfg) {
  let d = addDays(s, -1); let guard = 0;
  while (!isWorkingDay(d, cfg) && guard++ < 30) d = addDays(d, -1);
  return d;
}
export function workingDaysBetween(from, to, cfg = state.cfg) {
  const out = []; let d = from; let guard = 0;
  while (d <= to && guard++ < 1000) { if (isWorkingDay(d, cfg)) out.push(d); d = addDays(d, 1); }
  return out;
}
export function lastNWorkingDays(n, endInclusive = prevWorkingDay(), cfg = state.cfg) {
  const out = []; let d = endInclusive; let guard = 0;
  while (out.length < n && guard++ < 400) { if (isWorkingDay(d, cfg)) out.unshift(d); d = addDays(d, -1); }
  return out;
}

/* =====================================================================
   Settings lookups
   ===================================================================== */
export const state = { cfg: null, user: null, profile: null, engineers: null };
export function contractOf(id, cfg = state.cfg) { return cfg.contracts.find(c => c.id === id) || null; }
export function teamOf(id, cfg = state.cfg) { return cfg.teams.find(t => t.id === id) || null; }
export function contractName(id) { return contractOf(id)?.name || '–'; }
export function teamName(id) { return teamOf(id)?.name || '–'; }
export function activeContracts(cfg = state.cfg) { return cfg.contracts.filter(c => c.active !== false); }
export function codeOf(code, cfg = state.cfg) { return cfg.attendanceCodes.find(c => c.code === code) || null; }
export function codeChip(code) {
  const c = codeOf(code);
  if (!c) return code ? `<span class="code-chip" style="background:#1e3256">${esc(code)}</span>` : '';
  return `<span class="code-chip" title="${esc(c.label)}" style="background:${c.colour}2e;color:${c.colour}">${esc(c.code)}</span>`;
}
export function mergeConfig(stored) {
  const out = structuredClone(DEFAULT_CONFIG);
  const deep = (t, s) => {
    for (const [k, v] of Object.entries(s || {})) {
      if (v && typeof v === 'object' && !Array.isArray(v) && t[k] && typeof t[k] === 'object' && !Array.isArray(t[k])) deep(t[k], v);
      else t[k] = v;
    }
  };
  deep(out, stored);
  return out;
}

/* =====================================================================
   Firestore helpers
   ===================================================================== */
const withId = d => ({ id: d.id, ...d.data() });
export async function fetchAll(coll, ...clauses) {
  const snap = await getDocs(clauses.length ? query(collection(db, coll), ...clauses) : collection(db, coll));
  return snap.docs.map(withId);
}
/** Range on one field only, so no composite indexes are needed. */
export async function fetchRange(coll, from, to, field = 'date') {
  return fetchAll(coll, where(field, '>=', from), where(field, '<=', to));
}
export async function fetchDoc(coll, id) {
  const s = await getDoc(doc(db, coll, id));
  return s.exists() ? withId(s) : null;
}
export function stamp(extra = {}) {
  return { ...extra, updatedAt: serverTimestamp(), updatedBy: state.user?.email || '' };
}
/** ops: [{ type: 'set'|'update'|'delete', ref, data, merge }] — committed in chunks of 450. */
export async function commitInBatches(ops, onProgress) {
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db);
    for (const op of ops.slice(i, i + 450)) {
      if (op.type === 'delete') b.delete(op.ref);
      else if (op.type === 'update') b.update(op.ref, op.data);
      else b.set(op.ref, op.data, { merge: !!op.merge });
    }
    await b.commit();
    onProgress?.(Math.min(i + 450, ops.length), ops.length);
  }
}
export async function getEngineers({ includeLeavers = false, refresh = false } = {}) {
  if (!state.engineers || refresh) {
    state.engineers = (await fetchAll(C.engineers)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', { numeric: true }));
  }
  return includeLeavers ? state.engineers : state.engineers.filter(e => (e.status || 'Active') === 'Active');
}
export function engineerOptions(list, selected, blank = 'Select engineer…') {
  return options(list.map(e => ({ value: e.id, label: e.name })), selected, { blank });
}

/* =====================================================================
   Performance maths — used by screens, reports, league and bonus.
   A dailyPerformance record = one engineer working one day.
   ===================================================================== */
export function aggregate(rows, cfg = state.cfg) {
  const a = { days: 0, booked: 0, completed: 0, meters: 0, aborts: 0, noAccess: 0, miles: 0, target: 0, revenue: 0, cost: 0 };
  for (const r of rows) {
    const c = contractOf(r.contractId, cfg) || {};
    a.days += 1;
    a.booked += num(r.jobsBooked);
    a.completed += num(r.jobsCompleted);
    a.meters += num(r.metersInstalled);
    a.aborts += num(r.aborts);
    a.noAccess += num(r.noAccess);
    a.miles += num(r.miles);
    a.target += num(c.dailyMeterTarget);
    a.revenue += num(r.metersInstalled) * num(c.revenuePerMeter);
    a.cost += num(c.costPerEngineerDay);
  }
  a.completionPct = pct(a.completed, a.booked);
  a.abortPct = pct(a.aborts, a.booked);
  a.milesPerMeter = a.meters ? a.miles / a.meters : null;
  a.metersPerDay = a.days ? a.meters / a.days : null;
  a.targetPct = pct(a.meters, a.target);
  return a;
}
export function attendanceSummary(rows, cfg = state.cfg) {
  const s = { working: 0, nonProductive: 0, holiday: 0, sickness: 0, absence: 0, off: 0, unknown: 0 };
  for (const r of rows) { const t = codeOf(r.code, cfg)?.type || 'unknown'; s[t] = (s[t] || 0) + 1; }
  const present = s.working + s.nonProductive;
  s.present = present;
  s.scheduled = present + s.sickness + s.absence;
  s.attendancePct = pct(present, s.scheduled);
  return s;
}
export function groupBy(rows, keyFn) {
  const m = new Map();
  for (const r of rows) { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
  return m;
}

/* =====================================================================
   UI: toast, modal, confirm
   ===================================================================== */
export function toast(msg, type = '') {
  let box = $('#toasts');
  if (!box) { box = el('<div id="toasts"></div>'); document.body.append(box); }
  const t = el(`<div class="toast ${type}">${esc(msg)}</div>`);
  box.append(t);
  setTimeout(() => t.remove(), type === 'bad' ? 6000 : 3500);
}
export function modal({ title, body, wide = false, actions = [] }) {
  const back = el(`<div class="modal-back"><div class="modal ${wide ? 'wide' : ''}">
    <header><h2>${esc(title)}</h2><button class="x" aria-label="Close">×</button></header>
    <div class="body"></div><footer></footer></div></div>`);
  const close = () => back.remove();
  if (typeof body === 'string') $('.body', back).innerHTML = body; else if (body) $('.body', back).append(body);
  const foot = $('footer', back);
  if (!actions.length) foot.remove();
  for (const a of actions) {
    const b = el(`<button class="btn ${a.kind || ''}">${esc(a.label)}</button>`);
    b.onclick = async () => {
      if (!a.onClick) return close();
      b.disabled = true;
      try { const r = await a.onClick(back, close); if (r !== false) close(); }
      catch (e) { console.error(e); toast(e.message || 'Something went wrong', 'bad'); }
      finally { b.disabled = false; }
    };
    foot.append(b);
  }
  $('.x', back).onclick = close;
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  document.body.append(back);
  return { root: back, close };
}
export function confirmBox(message, { okLabel = 'Confirm', danger = false } = {}) {
  return new Promise(res => {
    const m = modal({
      title: 'Please confirm', body: `<p>${esc(message)}</p>`,
      actions: [{ label: 'Cancel', kind: 'ghost', onClick: () => res(false) }, { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: () => res(true) }],
    });
    $('.x', m.root).addEventListener('click', () => res(false));
  });
}

/* =====================================================================
   Tables
   ===================================================================== */
/** Click a header to sort. Uses data-v on cells when present. */
export function makeSortable(table) {
  $$('th', table).forEach((th, i) => {
    if (th.dataset.nosort !== undefined) return;
    th.classList.add('sortable');
    th.onclick = () => {
      const tbody = table.tBodies[0];
      const dir = th.dataset.dir === 'asc' ? 'desc' : 'asc';
      $$('th', table).forEach(x => { delete x.dataset.dir; $('.arrow', x)?.remove(); });
      th.dataset.dir = dir;
      th.insertAdjacentHTML('beforeend', `<span class="arrow">${dir === 'asc' ? '▲' : '▼'}</span>`);
      const rows = [...tbody.rows].filter(r => !r.classList.contains('total-row') && !r.classList.contains('group-row'));
      const fixed = [...tbody.rows].filter(r => r.classList.contains('total-row'));
      const val = r => { const c = r.cells[i]; if (!c) return ''; const v = c.dataset.v ?? c.textContent.trim(); const n = Number(String(v).replace(/[£$€,%]/g, '')); return v !== '' && Number.isFinite(n) ? n : String(v).toLowerCase(); };
      rows.sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'asc' ? 1 : -1); });
      tbody.append(...rows, ...fixed);
    };
  });
}

/* =====================================================================
   Third-party libraries, loaded only when a page needs them
   ===================================================================== */
const loaded = {};
export function loadScript(src) {
  if (!loaded[src]) loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); });
  return loaded[src];
}
export async function getXLSX() { await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js'); return window.XLSX; }
export async function getChart() {
  await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js');
  const Chart = window.Chart;
  if (!Chart.__themed) {
    Chart.defaults.color = '#8ea2c4';
    Chart.defaults.borderColor = 'rgba(42,67,112,.45)';
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.maintainAspectRatio = false;
    Chart.__themed = true;
  }
  return Chart;
}
const charts = new WeakMap();
/** Draw (or redraw) a Chart.js chart into a canvas. */
export async function drawChart(canvas, config) {
  const Chart = await getChart();
  charts.get(canvas)?.destroy();
  const ch = new Chart(canvas, config);
  charts.set(canvas, ch);
  return ch;
}
export const PALETTE = ['#3d8fe0', '#33c48a', '#f3b440', '#a78bfa', '#f06363', '#5aaef0', '#ec8bd0', '#9bd36b'];

/** sheets: { 'Sheet name': [ {col: value}, ... ] } */
export async function exportXlsx(filename, sheets) {
  const XLSX = await getXLSX();
  const wb = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No data' }]);
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : filename + '.xlsx');
}
/** Read the first sheet of an .xlsx / .xls / .csv file into an array of objects. */
export async function readSpreadsheet(file) {
  const XLSX = await getXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: false, dateNF: 'yyyy-mm-dd' });
}
/** Find a value in an uploaded row by any of several possible header names. */
export function pick(row, ...names) {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === n.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (k !== undefined && row[k] !== '') return row[k];
  }
  return '';
}
/** Turn whatever date a spreadsheet gives us into YYYY-MM-DD. */
export function normaliseDate(v) {
  if (!v) return '';
  if (v instanceof Date) return iso(v);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  const d = new Date(s); return isNaN(d) ? '' : iso(d);
}
/** Match an uploaded engineer name / number to the directory. */
export function matchEngineer(list, value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return null;
  return list.find(e => String(e.employeeNumber || '').toLowerCase() === v) ||
    list.find(e => String(e.name || '').toLowerCase() === v) ||
    list.find(e => String(e.email || '').toLowerCase() === v) || null;
}

/* =====================================================================
   Page shell & sign-in check
   ===================================================================== */
function bootScreen(msg = '') {
  let b = $('#boot');
  if (!b) { b = el(`<div id="boot"><div class="center"><img src="assets/logo.png" alt="${PRODUCT}"><div class="msg"></div></div></div>`); document.body.prepend(b); }
  $('.msg', b).innerHTML = msg;
  return b;
}
function waitForUser() {
  return new Promise(res => { const off = onAuthStateChanged(auth, u => { off(); res(u); }); });
}
export async function logout() { await signOut(auth); location.href = 'login.html'; }

function buildShell(role, cfg, kiosk) {
  const app = $('#app') || document.body;
  const pageEl = $('main.page', app) || app;
  const current = location.pathname.split('/').pop() || 'index.html';
  const allowed = PAGES.filter(p => p.roles.includes(role));
  const groups = CATEGORIES.map(([id, label]) => ({ id, label, pages: allowed.filter(p => p.cat === id) })).filter(g => g.pages.length);
  let closed = {}; try { closed = JSON.parse(localStorage.getItem('cat-nav') || '{}'); } catch (e) { /* ignore */ }

  const shell = el(`<div class="shell">
    <aside class="sidebar">
      <a class="brand" href="${role === 'engineer' ? 'portal.html' : 'index.html'}"><img src="assets/logo.png" alt="${PRODUCT}"><div class="client">${esc(cfg.company.clientName)}</div></a>
      <nav>${role === 'engineer' ? '' : `<div class="nav-group"><div class="nav-items"><a href="index.html" class="${current === 'index.html' ? 'active' : ''}"><span class="ico">🏠</span>Home</a></div></div>`}
      ${groups.map(g => `<div class="nav-group ${closed[g.id] && !g.pages.some(p => p.file === current) ? 'closed' : ''}" data-g="${g.id}">
        <button type="button">${esc(g.label)}<span class="chev">▾</span></button>
        <div class="nav-items">${g.pages.map(p => `<a href="${p.file}" class="${p.file === current ? 'active' : ''}"><span class="ico">${p.icon}</span>${esc(p.name)}</a>`).join('')}</div>
      </div>`).join('')}</nav>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="btn sm ghost menu-btn" type="button">☰</button>
        <div class="title">${esc(document.title.split(' · ')[0])}</div>
        <div class="user"><span class="hide-sm">${esc(state.profile?.name || state.user?.email || '')}</span><span class="badge info">${esc(role)}</span>
          <div class="avatar">${esc((state.profile?.name || state.user?.email || '?').slice(0, 1).toUpperCase())}</div>
          <button class="btn sm ghost" id="signOutBtn" type="button">Sign out</button></div>
      </header>
    </div>
  </div>`);
  $('.main', shell).append(pageEl);
  app.append(shell);
  $$('.nav-group[data-g] > button', shell).forEach(b => b.onclick = () => {
    const g = b.parentElement; g.classList.toggle('closed');
    closed[g.dataset.g] = g.classList.contains('closed');
    try { localStorage.setItem('cat-nav', JSON.stringify(closed)); } catch (e) { /* ignore */ }
  });
  $('.menu-btn', shell).onclick = () => document.body.classList.toggle('nav-open');
  $('#signOutBtn', shell).onclick = logout;
  if (kiosk) document.body.classList.add('kiosk');
}

/**
 * Call at the top of every page.
 * Checks sign-in and role, loads settings, draws the sidebar, then reveals the page.
 * Returns { user, profile, role, cfg, isAdmin }.
 */
export async function initPage({ roles = ['admin', 'manager'], shell = true } = {}) {
  document.title = document.title.includes(PRODUCT) ? document.title : `${document.title} · ${PRODUCT}`;
  if (!$('link[rel=icon]')) document.head.append(el('<link rel="icon" href="assets/favicon.png">'));
  const boot = bootScreen('Loading…');
  const user = await waitForUser();
  if (!user) { location.href = 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() + location.search); return new Promise(() => {}); }
  state.user = user;

  let profile = null;
  try { profile = await fetchDoc(C.users, user.uid); } catch (e) { console.error(e); }
  if (!profile || profile.active === false) {
    bootScreen(`<h2>No access yet</h2><p>You are signed in as <b>${esc(user.email)}</b>, but this account has not been given access.</p>
      <p>Ask an administrator to add you on <b>Users &amp; Access</b>. Setting up a brand-new installation? Open <a href="setup.html">setup</a>.</p>
      <button class="btn" onclick="this.disabled=true">Signing out…</button>`);
    $('#boot .btn').onclick = logout;
    $('#boot .btn').textContent = 'Sign out';
    return new Promise(() => {});
  }
  state.profile = profile;
  const role = profile.role || 'manager';

  if (!roles.includes(role)) {
    if (role === 'engineer') { location.href = 'portal.html'; return new Promise(() => {}); }
    bootScreen(`<h2>Not available</h2><p>Your role (${esc(role)}) can't open this page.</p><a class="btn" href="index.html">Back to home</a>`);
    return new Promise(() => {});
  }

  let stored = null;
  try { stored = (await fetchDoc(C.settings, 'config')) || null; } catch (e) { console.error(e); }
  const cfg = mergeConfig(stored || {});
  state.cfg = cfg;

  const kiosk = new URLSearchParams(location.search).has('tv');
  if (shell) buildShell(role, cfg, kiosk);
  if (!stored && role === 'admin' && !location.pathname.endsWith('data-input.html')) {
    const pageEl = $('main.page');
    pageEl?.prepend(el(`<div class="card" style="border-color:var(--warn);margin-bottom:16px"><b>Settings not saved yet.</b> The system is using default targets. Open <a href="data-input.html">Targets &amp; KPIs</a> to set them for this client.</div>`));
  }
  $('#app')?.removeAttribute('hidden');
  boot.remove();
  return { user, profile, role, cfg, isAdmin: role === 'admin' };
}

/* Shared filter-bar pieces */
export function contractSelect(id, selected = '', blank = 'All contracts') {
  return `<select id="${id}">${options(state.cfg.contracts.map(c => ({ value: c.id, label: c.name })), selected, { blank })}</select>`;
}
export function teamSelect(id, selected = '', blank = 'All teams', contractId = '') {
  const teams = state.cfg.teams.filter(t => !contractId || t.contractId === contractId);
  return `<select id="${id}">${options(teams.map(t => ({ value: t.id, label: `${t.name} — ${t.leader}` })), selected, { blank })}</select>`;
}
/** Quick date-range presets used by report pages. */
export function rangePreset(name) {
  const t = todayISO();
  switch (name) {
    case 'yesterday': { const d = prevWorkingDay(t); return [d, d]; }
    case 'wtd': return [weekStart(t), t];
    case 'lastweek': { const s = addDays(weekStart(t), -7); return [s, addDays(s, 6)]; }
    case 'mtd': return [monthStart(t), t];
    case 'lastmonth': { const s = monthStart(addMonths(monthStart(t), -1)); return [s, monthEnd(s)]; }
    case 'qtd': { const d = parseISO(t); const qm = Math.floor(d.getMonth() / 3) * 3; return [iso(new Date(d.getFullYear(), qm, 1)), t]; }
    case 'ytd': return [t.slice(0, 4) + '-01-01', t];
    default: return [addDays(t, -29), t];
  }
}
export function presetButtons(onPick) {
  const presets = [['yesterday', 'Last working day'], ['wtd', 'This week'], ['lastweek', 'Last week'], ['mtd', 'This month'], ['lastmonth', 'Last month'], ['qtd', 'Quarter'], ['ytd', 'Year']];
  const wrap = el(`<div class="seg">${presets.map(([k, l]) => `<button type="button" data-k="${k}">${l}</button>`).join('')}</div>`);
  $$('button', wrap).forEach(b => b.onclick = () => { $$('button', wrap).forEach(x => x.classList.remove('on')); b.classList.add('on'); onPick(...rangePreset(b.dataset.k)); });
  return wrap;
}
