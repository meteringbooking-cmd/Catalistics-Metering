// Catalistics AI — the data tools Claude can call.
// Each tool reads Firestore on the server (with the admin SDK) and returns a
// small, already-summarised JSON result, so the model never sees raw dumps
// and never has to do arithmetic itself.

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const round = (v, dp = 1) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v * 10 ** dp) / 10 ** dp);
const pct = (a, b) => (b ? (a / b) * 100 : null);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function iso(d) { return d.toISOString().slice(0, 10); }
function addDays(s, n) { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); }
function weekStart(s) { const d = parseISO(s); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - dow); return iso(d); }

/** Which field holds the date, and a plain description, for every collection the AI may read. */
const COLLECTIONS = {
  absences: ['startDate', 'Absence spells: type, first/last day, working days, reason, fit note, return-to-work.'],
  scheduledJobs: ['date', 'Booked jobs per engineer with job type, slot, postcode and outcome (status).'],
  vehicleChecks: ['date', 'Daily vehicle checks: result Pass/Advisory/Fail, defects, resolved.'],
  vanJourneys: ['date', 'First start and last end time per engineer per day, miles.'],
  speedingIncidents: ['date', 'Speeding incidents: speed, limit, location, action taken.'],
  complianceAudits: ['date', 'Audits: category, auditor, score %, result Pass/Fail, actions and their status.'],
  complaints: ['dateReceived', 'Customer complaints: reference, category, status, target date, closed date.'],
  jobRefusals: ['date', 'Jobs refused by engineers, reason, whether accepted as valid.'],
  noAccessVisits: ['attempt1Date', 'No-access jobs with up to three attempts and status.'],
  customerPayments: ['date', 'Compensation / goodwill payments to customers: type, amount, paid.'],
  escalations: ['dateRaised', 'Issues escalated to suppliers/client/other teams: type, summary, status, closed date.'],
  qualifications: ['expiryDate', 'Engineer qualifications: qualification, achieved date, expiry date.'],
  testerCalibrations: ['calibrationDate', 'Test equipment per engineer: make, serial, last calibration date.'],
  additionalPayments: ['date', 'Engineer claims (standby, overtime…): type, quantity, rate, amount, status Pending/Approved/Rejected.'],
  bonusStatements: ['to', 'Approved bonus statements per engineer per period: meters, base, multiplier, deductions, total.'],
  bonusAdjustments: ['date', 'Bonus deductions: reason, amount, percent.'],
  financeEntries: ['date', 'Other costs: month, contract, category, supplier, amount.'],
  meetings: ['date', 'Meetings between team leaders and engineers: type, status, held by.'],
  onCallRota: ['startDate', 'On-call rota: person, role, phone, from/to.'],
  notifications: ['publishDate', 'Notices published to the engineer portal.'],
};
const HIDDEN = new Set(['createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'demo', 'engineerId', 'teamId', 'contractId', 'url', 'path']);

function buildTools(db, cfg, today) {
  const contractOf = id => cfg.contracts.find(c => c.id === id);
  const teamOf = id => cfg.teams.find(t => t.id === id);
  const codeType = code => cfg.attendanceCodes.find(c => c.code === code)?.type || 'unknown';
  const match = (list, v) => {
    if (!v) return null;
    const s = String(v).trim().toLowerCase();
    return list.find(x => x.id.toLowerCase() === s || String(x.name).toLowerCase() === s) ||
      list.find(x => String(x.name).toLowerCase().includes(s)) || undefined;
  };
  const checkDates = (from, to) => {
    if (!ISO.test(from || '') || !ISO.test(to || '')) throw new Error('date_from and date_to must be YYYY-MM-DD');
    if (from > to) throw new Error('date_from is after date_to');
    if ((parseISO(to) - parseISO(from)) / 86400000 > 800) throw new Error('Range too long — keep it under about two years');
  };
  async function range(coll, field, from, to) {
    const snap = await db.collection(coll).where(field, '>=', from).where(field, '<=', to).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  /** Turn contract / team / engineer filters into a predicate. Returns { keep, note } or { error }. */
  function filters({ contract, team, engineer }) {
    const c = contract ? match(cfg.contracts, contract) : null;
    if (contract && !c) return { error: `No contract matches "${contract}". Contracts: ${cfg.contracts.map(x => x.name).join(', ')}` };
    const t = team ? match(cfg.teams, team) : null;
    if (team && !t) return { error: `No team matches "${team}". Teams: ${cfg.teams.map(x => x.name).join(', ')}` };
    const e = engineer ? String(engineer).trim().toLowerCase() : '';
    return {
      keep: r => (!c || r.contractId === c.id) && (!t || r.teamId === t.id) && (!e || String(r.engineerName || '').toLowerCase().includes(e)),
      applied: { contract: c?.name, team: t?.name, engineer: engineer || undefined },
    };
  }
  function aggregate(rows) {
    const a = { engineerDays: 0, jobsBooked: 0, jobsCompleted: 0, meters: 0, aborts: 0, noAccess: 0, miles: 0, meterTarget: 0, revenue: 0, engineerCost: 0 };
    for (const r of rows) {
      const c = contractOf(r.contractId) || {};
      a.engineerDays++; a.jobsBooked += num(r.jobsBooked); a.jobsCompleted += num(r.jobsCompleted); a.meters += num(r.metersInstalled);
      a.aborts += num(r.aborts); a.noAccess += num(r.noAccess); a.miles += num(r.miles); a.meterTarget += num(c.dailyMeterTarget);
      a.revenue += num(r.metersInstalled) * num(c.revenuePerMeter); a.engineerCost += num(c.costPerEngineerDay);
    }
    return {
      ...a, meterTarget: round(a.meterTarget), revenue: round(a.revenue, 2), engineerCost: round(a.engineerCost, 2),
      metersVsTargetPct: round(pct(a.meters, a.meterTarget)), completionPct: round(pct(a.jobsCompleted, a.jobsBooked)),
      abortPct: round(pct(a.aborts, a.jobsBooked)), metersPerEngineerDay: round(a.engineerDays ? a.meters / a.engineerDays : null, 2),
      milesPerMeter: round(a.meters ? a.miles / a.meters : null),
    };
  }
  const groupKey = (by, r) => ({
    contract: () => contractOf(r.contractId)?.name || 'Unknown contract',
    team: () => teamOf(r.teamId)?.name || 'No team',
    engineer: () => r.engineerName || 'Unknown',
    day: () => r.date,
    week: () => 'w/c ' + weekStart(r.date),
    month: () => String(r.date).slice(0, 7),
    code: () => r.code,
  }[by] || (() => 'All'))();
  const group = (rows, by, fn) => {
    const m = new Map();
    for (const r of rows) { const k = groupKey(by, r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); }
    return [...m].map(([k, rs]) => ({ [by === 'none' ? 'group' : by]: k, ...fn(rs) }));
  };

  const defs = [
    {
      name: 'performance_summary',
      description: 'Totals and KPIs from daily performance records (one record = one engineer working one day): engineer days, jobs booked/completed, meters installed, meter target, % of target, completion %, abort %, meters per engineer day, miles per meter, revenue and engineer cost. Optionally filtered and grouped. Use this for any question about output, targets, productivity, completion, aborts, revenue or rankings.',
      input_schema: {
        type: 'object',
        properties: {
          date_from: { type: 'string', description: 'YYYY-MM-DD inclusive' },
          date_to: { type: 'string', description: 'YYYY-MM-DD inclusive' },
          group_by: { type: 'string', enum: ['none', 'contract', 'team', 'engineer', 'day', 'week', 'month'] },
          contract: { type: 'string', description: 'Contract name (optional)' },
          team: { type: 'string', description: 'Team name (optional)' },
          engineer: { type: 'string', description: 'Engineer name or part of it (optional)' },
          sort_by: { type: 'string', enum: ['meters', 'metersVsTargetPct', 'completionPct', 'abortPct', 'metersPerEngineerDay', 'revenue', 'name'], description: 'Optional sort, highest first (name sorts A–Z)' },
          limit: { type: 'integer', description: 'Max groups to return (default 60)' },
        },
        required: ['date_from', 'date_to'],
      },
      async run(i) {
        checkDates(i.date_from, i.date_to);
        const f = filters(i); if (f.error) return { error: f.error };
        const rows = (await range('dailyPerformance', 'date', i.date_from, i.date_to)).filter(f.keep);
        const by = i.group_by || 'none';
        let groups = group(rows, by, aggregate);
        const s = i.sort_by;
        if (s === 'name') groups.sort((a, b) => String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0]), 'en', { numeric: true }));
        else if (s) groups.sort((a, b) => (b[s] ?? -1e9) - (a[s] ?? -1e9));
        else if (['day', 'week', 'month'].includes(by)) groups.sort((a, b) => String(Object.values(a)[0]).localeCompare(String(Object.values(b)[0])));
        const lim = Math.min(Math.max(1, num(i.limit) || 60), 200);
        return { range: [i.date_from, i.date_to], filters: f.applied, recordsMatched: rows.length, groupCount: groups.length, groups: groups.slice(0, lim), overall: by === 'none' ? undefined : aggregate(rows) };
      },
    },
    {
      name: 'attendance_summary',
      description: 'Attendance codes recorded per engineer per day. Returns counts by attendance type (working, nonProductive, holiday, sickness, absence, off) and attendance % = at work ÷ (at work + sickness + absence). Optionally grouped and filtered.',
      input_schema: {
        type: 'object',
        properties: {
          date_from: { type: 'string' }, date_to: { type: 'string' },
          group_by: { type: 'string', enum: ['none', 'contract', 'team', 'engineer', 'day', 'week', 'month', 'code'] },
          contract: { type: 'string' }, team: { type: 'string' }, engineer: { type: 'string' },
        },
        required: ['date_from', 'date_to'],
      },
      async run(i) {
        checkDates(i.date_from, i.date_to);
        const f = filters(i); if (f.error) return { error: f.error };
        const rows = (await range('attendance', 'date', i.date_from, i.date_to)).filter(f.keep);
        const summarise = rs => {
          const s = { working: 0, nonProductive: 0, holiday: 0, sickness: 0, absence: 0, off: 0, unknown: 0 };
          for (const r of rs) s[codeType(r.code)]++;
          const atWork = s.working + s.nonProductive;
          return { ...s, days: rs.length, attendancePct: round(pct(atWork, atWork + s.sickness + s.absence)) };
        };
        const groups = group(rows, i.group_by || 'none', summarise).slice(0, 200);
        return { range: [i.date_from, i.date_to], filters: f.applied, recordsMatched: rows.length, groups };
      },
    },
    {
      name: 'list_engineers',
      description: 'The engineer directory: name, employee number, team, contract, level, employment type, status, start date, vehicle registration.',
      input_schema: { type: 'object', properties: { team: { type: 'string' }, contract: { type: 'string' }, include_leavers: { type: 'boolean' } } },
      async run(i) {
        const f = filters({ contract: i.contract, team: i.team }); if (f.error) return { error: f.error };
        const snap = await db.collection('engineers').get();
        const list = snap.docs.map(d => d.data()).filter(e => (i.include_leavers || (e.status || 'Active') === 'Active') && f.keep(e))
          .map(e => ({ name: e.name, employeeNumber: e.employeeNumber, team: teamOf(e.teamId)?.name, teamLeader: teamOf(e.teamId)?.leader, contract: contractOf(e.contractId)?.name, level: e.level, employment: e.employmentType, status: e.status || 'Active', startDate: e.startDate, vehicleReg: e.vehicleReg }))
          .sort((a, b) => String(a.name).localeCompare(String(b.name), 'en', { numeric: true }));
        return { count: list.length, engineers: list.slice(0, 300) };
      },
    },
    {
      name: 'list_records',
      description: 'Read records from one of the other collections, filtered by date range (on that collection\'s main date field), engineer, team or any exact field value. Returns the total matched plus up to `limit` records. Collections: ' +
        Object.entries(COLLECTIONS).map(([k, [f, d]]) => `${k} (date field ${f}): ${d}`).join(' | '),
      input_schema: {
        type: 'object',
        properties: {
          collection: { type: 'string', enum: Object.keys(COLLECTIONS) },
          date_from: { type: 'string', description: 'Optional YYYY-MM-DD' },
          date_to: { type: 'string', description: 'Optional YYYY-MM-DD' },
          team: { type: 'string' }, engineer: { type: 'string' },
          where: { type: 'object', description: 'Optional exact matches, e.g. {"status":"Open"} or {"result":"Fail"}', additionalProperties: { type: ['string', 'number', 'boolean'] } },
          limit: { type: 'integer', description: 'Default 50, max 200' },
        },
        required: ['collection'],
      },
      async run(i) {
        const spec = COLLECTIONS[i.collection];
        if (!spec) return { error: 'Unknown collection' };
        const f = filters({ team: i.team, engineer: i.engineer }); if (f.error) return { error: f.error };
        let rows;
        if (i.date_from || i.date_to) {
          const from = i.date_from || '0000-01-01', to = i.date_to || '9999-12-31';
          if (i.date_from && !ISO.test(i.date_from)) return { error: 'date_from must be YYYY-MM-DD' };
          if (i.date_to && !ISO.test(i.date_to)) return { error: 'date_to must be YYYY-MM-DD' };
          rows = await range(i.collection, spec[0], from, to);
        } else rows = (await db.collection(i.collection).get()).docs.map(d => ({ id: d.id, ...d.data() }));
        rows = rows.filter(f.keep);
        for (const [k, v] of Object.entries(i.where || {})) rows = rows.filter(r => String(r[k] ?? '').toLowerCase() === String(v).toLowerCase());
        rows.sort((a, b) => String(b[spec[0]] || '').localeCompare(String(a[spec[0]] || '')));
        const lim = Math.min(Math.max(1, num(i.limit) || 50), 200);
        const clean = r => {
          const o = {};
          for (const [k, v] of Object.entries(r)) if (!HIDDEN.has(k) && k !== 'id' && v !== '' && v !== null && v !== undefined) o[k] = v;
          if (r.teamId) o.team = teamOf(r.teamId)?.name;
          if (r.contractId) o.contract = contractOf(r.contractId)?.name;
          return o;
        };
        return { collection: i.collection, dateField: spec[0], totalMatched: rows.length, returned: Math.min(lim, rows.length), records: rows.slice(0, lim).map(clean) };
      },
    },
  ];
  return defs;
}

/** Background the model needs: today, the client's set-up, and how numbers are defined. */
function systemPrompt(cfg, today, assistantName) {
  const c = cfg.company;
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `You are ${assistantName}, the data assistant inside Catalistics, a field-performance platform used by ${c.clientName} to run a team of field engineers (smart meter installation and similar work).

Today is ${today} (${DAYS[parseISO(today).getUTCDay()]}). Working days: ${(c.workingDays || []).map(d => DAYS[d]).join(', ')}. Daily figures are normally entered the next working day, so "yesterday" usually means the previous working day. Currency: ${c.currency}.

CONTRACTS AND TARGETS (meter target is per engineer per working day)
${cfg.contracts.map(x => `- ${x.name}${x.active === false ? ' (inactive)' : ''}: ${x.dailyMeterTarget} meters/engineer/day, completion target ${x.completionTarget}%, max abort ${x.abortRateMax}%, max miles/meter ${x.milesPerMeterMax}, revenue ${c.currency}${x.revenuePerMeter}/meter, cost ${c.currency}${x.costPerEngineerDay}/engineer day`).join('\n')}

TEAMS
${cfg.teams.map(t => `- ${t.name} (leader ${t.leader}) → ${cfg.contracts.find(x => x.id === t.contractId)?.name || 'no contract'}`).join('\n')}

ATTENDANCE CODES
${cfg.attendanceCodes.map(a => `- ${a.code} = ${a.label} (counts as ${a.type})`).join('\n')}

OTHER TARGETS: attendance ${cfg.targets.attendanceTarget}%, vehicle checks ${cfg.targets.vehicleCheckTarget}%, audit pass rate ${cfg.targets.complianceTarget}% (pass mark ${cfg.compliance.passMark}%), complaint response ${cfg.targets.complaintResponseDays} days, escalations closed within ${cfg.targets.escalationTargetDays} days. Bradford Factor trigger ${cfg.absence.bradfordTrigger} over ${cfg.absence.lookbackMonths} months. Bonus: meters above ${cfg.bonus.thresholdMetersPerDay}/day × ${c.currency}${cfg.bonus.ratePerMeter}, minimum completion ${cfg.bonus.minCompletionPct}%.

DEFINITIONS
- Meter target = sum over engineer-days of that contract's daily target. % of target = meters ÷ target.
- Completion % = jobs completed ÷ jobs booked. Abort % = aborts ÷ jobs booked. Miles per meter = miles ÷ meters.
- Revenue = meters × revenue per meter. Engineer cost = engineer days × cost per engineer day.
- Attendance % = days at work ÷ (days at work + sickness + other absence).

HOW TO ANSWER
- Always get figures from the tools. Never estimate or invent numbers, names or dates. If the tools return nothing, say there is no data for that period.
- Work out exact dates yourself (e.g. "last month", "this week" Monday–Sunday, "Q3") and say which dates you used.
- Prefer one well-chosen summarised call (with group_by and sort_by) over many calls. Tool results are already calculated — report them, don't recompute.
- Answer in UK English, briefly and plainly, for a busy operations manager. Lead with the answer, then the key figures. Use a small markdown table when comparing several engineers, teams or periods. Flag anything below target.
- Only answer questions about this business's data and how to read it. Politely decline anything unrelated.`;
}

module.exports = { buildTools, systemPrompt, COLLECTIONS };
