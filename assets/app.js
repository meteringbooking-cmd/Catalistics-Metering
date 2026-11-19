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
  qualificationSubmissions: 'qualificationSubmissions', // certificates sent in by engineers, awaiting approval
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
    { id: 'contract-a', name: 'Contract A', colour: '#4f46e5', active: true, dailyMeterTarget: 4, completionTarget: 85, abortRateMax: 10, milesPerMeterMax: 12, revenuePerMeter: 120, costPerEngineerDay: 230 },
    { id: 'contract-b', name: 'Contract B', colour: '#0d9488', active: true, dailyMeterTarget: 3.5, completionTarget: 80, abortRateMax: 12, milesPerMeterMax: 15, revenuePerMeter: 135, costPerEngineerDay: 230 },
  ],
  teams: [
    { id: 'team-1', name: 'Team 1', leader: 'Team Leader 1', contractId: 'contract-a' },
    { id: 'team-2', name: 'Team 2', leader: 'Team Leader 2', contractId: 'contract-a' },
    { id: 'team-3', name: 'Team 3', leader: 'Team Leader 3', contractId: 'contract-b' },
    { id: 'team-4', name: 'Team 4', leader: 'Team Leader 4', contractId: 'contract-b' },
  ],
  attendanceCodes: [
    { code: 'X', label: 'Working', type: 'working', colour: '#16a34a' },
    { code: 'T', label: 'Training', type: 'nonProductive', colour: '#0284c7' },
    { code: 'A', label: 'Office / admin day', type: 'nonProductive', colour: '#64748b' },
    { code: 'H', label: 'Holiday', type: 'holiday', colour: '#7c3aed' },
    { code: 'S', label: 'Sickness', type: 'sickness', colour: '#dc2626' },
    { code: 'U', label: 'Unauthorised absence', type: 'absence', colour: '#d97706' },
    { code: 'O', label: 'Rest day / not scheduled', type: 'off', colour: '#94a3b8' },
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
  ['work-screen.html', 'Work Screen', 'screens', 'monitor', 'Live view of every contract: meters against target, completion, aborts, attendance and a 10-day trend.'],
  ['office-screen.html', 'Office Screen', 'screens', 'tv', 'Big-number wall display that rotates through each contract and the day\'s top performers.'],
  ['daily-performance.html', 'Daily Performance', 'screens', 'calendarDay', 'Previous working day by team and engineer, against each contract\'s targets.'],
  ['weekly-performance.html', 'Weekly Performance', 'screens', 'calendarRange', 'Five-week view per engineer: meters, average per day and completion.'],

  ['submit-performance.html', 'Submit Performance', 'data', 'edit', 'Enter or upload each engineer\'s figures for a day. Re-open any date to amend it.'],
  ['attendance.html', 'Attendance', 'data', 'userCheck', 'Record each engineer\'s attendance code for the day, and see the month as a calendar.'],
  ['scheduling.html', 'Job Scheduling', 'data', 'route', 'Upload and manage booked jobs per engineer; set outcomes and send totals to performance.'],

  ['catalistics-ai.html', 'Catalistics AI', 'reports', 'sparkles', 'Ask questions about your data in plain English and get answers from the live figures.'],
  ['executive-dashboard.html', 'Executive Dashboard', 'reports', 'building', 'Month-to-date headline numbers, revenue forecast and the issues that need attention.'],
  ['performance-report.html', 'Performance Report', 'reports', 'trending', 'Any date range by contract, team and engineer, with charts and Excel export.'],
  ['league-table.html', 'League Table', 'reports', 'trophy', 'Engineers ranked on a weighted score of meters, completion, aborts, attendance and compliance.'],
  ['finance.html', 'Finance', 'reports', 'pound', 'Revenue, costs, margin and month-end forecast per contract.'],

  ['bonus-calculator.html', 'Bonus Calculator', 'pay', 'target', 'Bonus per engineer from meters, quality and deductions. Approve to publish to the portal.'],
  ['additional-payments.html', 'Additional Payments', 'pay', 'receipt', 'Approve, amend or reject standby, overtime and other claims, and export for payroll.'],

  ['engineers.html', 'Engineers', 'people', 'users', 'The engineer directory: contract, team, level, employment type and status.'],
  ['absences.html', 'Absences', 'people', 'heartPulse', 'Absence records with Bradford Factor and trigger alerts.'],
  ['capacity.html', 'Capacity Planner', 'people', 'barChart', 'Available engineer-days and meter capacity per team for the weeks ahead.'],
  ['on-call.html', 'On-Call Rota', 'people', 'phone', 'Who is on call and when.'],
  ['meetings.html', 'Meetings', 'people', 'messages', 'One-to-ones, van audits, ride-alongs and reviews by team leader.'],

  ['compliance-audits.html', 'Compliance Audits', 'quality', 'clipboardCheck', 'Audit results with pass rates by team, engineer and category, and open actions.'],
  ['complaints.html', 'Complaints', 'quality', 'megaphone', 'Customer complaints with target response dates and status.'],
  ['job-refusals.html', 'Job Refusals', 'quality', 'ban', 'Jobs refused by engineers, with reasons.'],
  ['no-access.html', 'No Access Visits', 'quality', 'door', 'No-access jobs with up to three attempts recorded.'],
  ['customer-payments.html', 'Customer Payments', 'quality', 'card', 'Compensation and goodwill payments made to customers.'],
  ['escalations.html', 'Escalations', 'quality', 'flag', 'Issues raised with suppliers or other teams, and how long they have been open.'],
  ['skills-matrix.html', 'Skills Matrix', 'quality', 'grid', 'Every engineer\'s qualifications with expiry dates, colour-coded.'],
  ['tester-calibration.html', 'Tester Calibration', 'quality', 'wrench', 'Test equipment per engineer with calibration due dates.'],

  ['vehicle-checks.html', 'Vehicle Checks', 'fleet', 'truck', 'Daily vehicle checks, defects, and who was working without a check.'],
  ['van-times.html', 'Van Times', 'fleet', 'clock', 'First start and last finish per day: late starts, early finishes and long days.'],
  ['speeding.html', 'Speeding', 'fleet', 'gauge', 'Speeding incidents by engineer and team.'],

  ['portal.html', 'Engineer Portal', 'portal', 'smartphone', 'What an engineer sees: their figures, bonus, claims, notices and documents.', ['admin', 'manager', 'engineer']],
  ['notifications.html', 'Portal Notices', 'portal', 'bell', 'Publish notices to all engineers, a team or one engineer.'],
  ['documents.html', 'Portal Documents', 'portal', 'folder', 'Upload policies, forms and guides for engineers to read in the portal.'],

  ['data-input.html', 'Targets & KPIs', 'admin', 'sliders', 'Every target, KPI, rate, contract, team and list used across the system.', ['admin']],
  ['users.html', 'Users & Access', 'admin', 'shield', 'Create sign-ins and choose what each person can see.', ['admin']],
  ['ai-usage.html', 'AI Usage', 'admin', 'activity', 'Every question asked of Catalistics AI, by whom, and what it cost against the monthly budget.', ['admin']],
  ['demo-data.html', 'Demo Data', 'admin', 'database', 'Fill the system with sample data for a demonstration, or clear it again.', ['admin']],
].map(([file, name, cat, icon, desc, roles]) => ({ file, name, cat, icon, desc, roles: roles || ['admin', 'manager'] }));

/* =====================================================================
   "Add data" menu — every way of putting data into the system.
   ?add=1 opens the page's add form straight away.
   ===================================================================== */
export const QUICK_ADD = [
  ['Daily data', [
    ['submit-performance.html', 'Daily figures', 'Type or upload a spreadsheet', 'edit'],
    ['attendance.html', 'Attendance', 'Codes for a day, or upload a spreadsheet', 'userCheck'],
    ['scheduling.html?add=1', 'Booked job', 'Add one, or upload a job list', 'route'],
  ]],
  ['People', [
    ['engineers.html?add=1', 'Engineer', 'Add to the directory', 'users'],
    ['absences.html?add=1', 'Absence', 'Sickness or other absence', 'heartPulse'],
    ['meetings.html?add=1', 'Meeting', 'One-to-one, van audit, review', 'messages'],
    ['on-call.html?add=1', 'On-call rota', 'Who is on call', 'phone'],
  ]],
  ['Quality & compliance', [
    ['compliance-audits.html?add=1', 'Audit result', '', 'clipboardCheck'],
    ['complaints.html?add=1', 'Complaint', '', 'megaphone'],
    ['skills-matrix.html?add=1', 'Qualification', 'With certificate', 'grid'],
    ['job-refusals.html?add=1', 'Job refusal', '', 'ban'],
    ['no-access.html?add=1', 'No access visit', '', 'door'],
    ['customer-payments.html?add=1', 'Customer payment', '', 'card'],
    ['escalations.html?add=1', 'Escalation', '', 'flag'],
    ['tester-calibration.html?add=1', 'Tester calibration', '', 'wrench'],
  ]],
  ['Fleet', [
    ['vehicle-checks.html?add=1', 'Vehicle check', '', 'truck'],
    ['van-times.html?add=1', 'Van times', 'Or import a tracking export', 'clock'],
    ['speeding.html?add=1', 'Speeding incident', '', 'gauge'],
  ]],
  ['Pay & finance', [
    ['additional-payments.html?add=1', 'Additional payment claim', '', 'receipt'],
    ['bonus-calculator.html?tab=ded&add=1', 'Bonus deduction', '', 'target'],
    ['finance.html?add=1', 'Cost', 'Vehicles, fuel, stock…', 'pound'],
  ]],
  ['Engineer portal', [
    ['notifications.html?add=1', 'Notice', 'Publish to engineers', 'bell'],
    ['documents.html?add=1', 'Document', 'Upload a file', 'folder'],
  ]],
];

/* =====================================================================
   Line icons (24×24, stroke = currentColor)
   ===================================================================== */
const CAL = '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>';
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  tv: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="m17 2-5 5-5-5"/>',
  calendarDay: CAL + '<rect x="7" y="13" width="4" height="4" rx="1"/>',
  calendarRange: CAL + '<path d="M7 14h4M13 18h4"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  userCheck: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2"/><path d="m16 11 2 2 4-4"/>',
  route: '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>',
  sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
  building: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
  trending: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8"/><path d="M18 2H6v7a6 6 0 0 0 12 0Z"/>',
  pound: '<path d="M18 7c0-5.3-8-5.3-8 0v13"/><path d="M6 13h10M6 20h12"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  receipt: '<path d="M5 2h14v20l-3-2-2 2-2-2-2 2-2-2-3 2Z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
  users: '<circle cx="9" cy="7" r="4"/><path d="M2 21v-2a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v2M16 3.1a4 4 0 0 1 0 7.8M22 21v-2a4 4 0 0 0-3-3.9"/>',
  heartPulse: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/><path d="M3.2 12H9l.5-1 2 4.5 2-7 1.5 3.5h5.3"/>',
  barChart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V7M18 17v-8"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  messages: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/><path d="M8 9h8M8 13h5"/>',
  clipboardCheck: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3Z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  door: '<path d="M13 4h3a2 2 0 0 1 2 2v14M2 20h3M13 20h9M10 12v.01"/><path d="M13 4.6v16.8a1 1 0 0 1-1.2 1L5 21V5.6a2 2 0 0 1 1.5-1.9l4-1A2 2 0 0 1 13 4.6Z"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1Z"/><path d="M4 22v-7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9Z"/>',
  truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.2-.6l-3.5-4.4A1 1 0 0 0 17.5 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9l-.8-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-2.6-6.4L21 8"/><path d="M21 3v5h-5"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevronLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  chevronUp: '<path d="m18 15-6-6-6 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3Z"/><path d="M12 9v4M12 17h.01"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1Z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
};
/** Inline SVG icon. icon('download') → <svg …> */
export function icon(name, size = 16, cls = '') {
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}

/** Colours for charts, matching the theme. */
export const CHART = { accent: '#4f46e5', target: '#d97706', line: '#101828', good: '#16a34a', bad: '#e11d48', teal: '#0d9488' };

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
  if (!c) return code ? `<span class="code-chip" style="background:#e6e8ec">${esc(code)}</span>` : '';
  return `<span class="code-chip" title="${esc(c.label)}" style="background:${c.colour}1f;color:${c.colour}">${esc(c.code)}</span>`;
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
    <header><h2>${esc(title)}</h2><button class="x" aria-label="Close">${icon('x', 18)}</button></header>
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
      th.insertAdjacentHTML('beforeend', `<span class="arrow">${icon(dir === 'asc' ? 'chevronUp' : 'chevronDown', 12)}</span>`);
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
    Chart.defaults.color = '#5b6474';
    Chart.defaults.borderColor = '#eceef2';
    Chart.defaults.font.family = 'Inter, system-ui, sans-serif';
    Chart.defaults.plugins.legend.labels.boxWidth = 10;
    Chart.defaults.plugins.legend.labels.boxHeight = 10;
    Chart.defaults.plugins.tooltip.backgroundColor = '#101828';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.elements.bar.borderRadius = 4;
    Chart.defaults.elements.line.borderWidth = 2;
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
export const PALETTE = ['#4f46e5', '#0d9488', '#d97706', '#7c3aed', '#e11d48', '#0284c7', '#db2777', '#65a30d'];

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
  if (!b) { b = el(`<div id="boot"><div class="center"><img src="assets/logo-dark.png" alt="${PRODUCT}"><div class="msg"></div></div></div>`); document.body.prepend(b); }
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
      <nav>${role === 'engineer' ? '' : `<div class="nav-group"><div class="nav-items"><a href="index.html" class="${current === 'index.html' ? 'active' : ''}">${icon('home', 17)}Home</a></div></div>`}
      ${groups.map(g => `<div class="nav-group ${closed[g.id] && !g.pages.some(p => p.file === current) ? 'closed' : ''}" data-g="${g.id}">
        <button type="button">${esc(g.label)}<span class="chev">${icon('chevronDown', 13)}</span></button>
        <div class="nav-items">${g.pages.map(p => `<a href="${p.file}" class="${p.file === current ? 'active' : ''}">${icon(p.icon, 17)}${esc(p.name)}</a>`).join('')}</div>
      </div>`).join('')}</nav>
    </aside>
    <div class="main">
      <header class="topbar">
        <button class="btn sm ghost menu-btn" type="button" aria-label="Menu">${icon('menu', 18)}</button>
        <div class="title">${esc(document.title.split(' · ')[0])}</div>
        ${role === 'engineer' ? '' : `<div class="add-menu"><button class="btn primary sm" type="button" id="addMenuBtn">${icon('plus', 15)} Add data</button>
          <div class="add-panel" hidden>${QUICK_ADD.map(([g, items]) => `<div class="add-group"><div class="add-head">${esc(g)}</div>${items.map(([href, name, sub, ic]) =>
            `<a href="${href}">${icon(ic, 16)}<span><b>${esc(name)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></a>`).join('')}</div>`).join('')}</div></div>`}
        <div class="user"><span class="hide-sm">${esc(state.profile?.name || state.user?.email || '')}</span><span class="badge info" style="text-transform:capitalize">${esc(role)}</span>
          <div class="avatar">${esc((state.profile?.name || state.user?.email || '?').slice(0, 1).toUpperCase())}</div>
          <button class="btn sm ghost" id="signOutBtn" type="button">${icon('logout', 15)} Sign out</button></div>
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
  const addBtn = $('#addMenuBtn', shell);
  if (addBtn) {
    const panel = $('.add-panel', shell);
    addBtn.onclick = e => { e.stopPropagation(); panel.hidden = !panel.hidden; };
    document.addEventListener('click', e => { if (!panel.contains(e.target)) panel.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.hidden = true; });
  }
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

  let profile = null, readError = null;
  try { profile = await fetchDoc(C.users, user.uid); } catch (e) { console.error(e); readError = e; }
  if (readError) {
    bootScreen(`<h2>Can't reach the database</h2><p>You are signed in as <b>${esc(user.email)}</b>, but the database refused the request (${esc(readError.code || readError.message)}).</p>
      <p>This usually means the Firestore security rules haven't been deployed yet. From the Catalistics folder run <code>firebase deploy --only firestore</code>, then open <a href="setup.html">setup</a> again with the same email and password.</p>
      <button class="btn">Sign out</button>`);
    $('#boot .btn').onclick = logout;
    return new Promise(() => {});
  }
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
    pageEl?.prepend(el(`<div class="card" style="border-color:var(--warn);background:var(--warn-soft);margin-bottom:16px"><b>Settings not saved yet.</b> The system is using default targets. Open <a href="data-input.html">Targets &amp; KPIs</a> to set them for this client.</div>`));
  }
  $('#app')?.removeAttribute('hidden');
  boot.remove();
  return { user, profile, role, cfg, isAdmin: role === 'admin' };
}

/** Upload a file to Firebase Storage. Returns { path, url }. Throws if Storage isn't switched on. */
export async function uploadFile(folder, file, onProgress) {
  const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js');
  const path = `${folder}/${Date.now()}-${String(file.name).replace(/[^\w.\-]+/g, '_')}`;
  const task = uploadBytesResumable(ref(getStorage(app), path), file);
  await new Promise((res, rej) => task.on('state_changed', snap => onProgress?.(snap.bytesTransferred / snap.totalBytes), rej, res));
  return { path, url: await getDownloadURL(task.snapshot.ref) };
}

/** True (once) when the page was opened with ?add=1 from the Add data menu. */
export function wantsAdd() {
  const q = new URLSearchParams(location.search);
  if (!q.has('add')) return false;
  q.delete('add');
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
  return true;
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
