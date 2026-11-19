# Catalistics — field performance platform

Catalistics is a web platform for running a field engineering workforce, for example smart meter installation. It covers live wall screens, daily performance and attendance, reports, bonus and pay, people, quality and compliance, fleet, and an engineer self-service portal.

It is **unbranded for the client**. The client's company name, contracts, teams, targets, rates and drop‑down lists are all set on one page, **Targets & KPIs** (`data-input.html`). No targets are fixed in the pages themselves.

- **Front end:** plain HTML, CSS and JavaScript. There is no build step, and every page is a single `.html` file.
- **Back end:** Firebase. This means Authentication (sign‑in), Firestore (data) and Storage (portal documents).
- **Libraries** load from public CDNs only when a page needs them: Chart.js for charts and SheetJS for Excel import and export.

---

## Quick deploy on Windows

Double‑click **`deploy.bat`** and pick an option. It runs the right Firebase commands for this project, so you don't need to type them. You still need the one‑off steps below first: Node.js, `firebase-tools`, `firebase login`, and switching the services on in the console.

> **About GitHub:** the drag‑and‑drop upload on GitHub leaves out files whose names start with a dot (`.firebaserc`, `.gitignore`). That's fine. `deploy.bat` and the commands below all name the project directly with `--project metering-1-22462`.

## 1. Set up the Firebase project (one‑off)

The project in `assets/firebase-config.js` is `metering-1-22462`. In the [Firebase console](https://console.firebase.google.com/):

1. **Authentication** → Sign‑in method → enable **Email/Password**.
2. **Firestore Database** → Create database (production mode, region of your choice).
3. **Storage** → Get started. This is needed only for Portal Documents.
4. **Hosting** → Get started, and click through to the end. Without this, deploying fails with *"Assertion failed: resolving hosting target…"*.
5. **Deploy the security rules.** Install the Firebase CLI, then run these from this folder:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,storage --project metering-1-22462
   ```
   Catalistics AI also needs `firebase deploy --only functions`. See the Catalistics AI section.

   Alternatively, paste `firestore.rules` and `storage.rules` into the Rules tab of each product in the console.

## 2. Host the site

You can use any static host. With Firebase Hosting:

```bash
firebase deploy --only hosting --project metering-1-22462
```

For a quick local look, run `npx serve .` or `python -m http.server`. Pages use ES modules, so they **must be served over http(s)**. Opening them as `file://` will not work.

## 3. First run

1. Open **`setup.html`**. Enter the client's company name and create the first administrator. This works only once, while the database has no settings.
2. You will be taken to **Targets & KPIs**. Set up the following, then press **Save settings**:
   - contracts and their targets
   - teams and team leaders
   - attendance codes
   - KPI targets and bonus rates
   - fleet times and absence triggers
   - lists
3. Add engineers on **Engineers**, or import them from a spreadsheet.
4. Create sign‑ins on **Users & Access**:
   - **Admin:** everything, including settings and users.
   - **Manager:** every operational page.
   - **Engineer:** their own portal only. Each engineer sign‑in must be linked to an engineer record.

### For a sales demonstration

Open **Demo Data** and press **Create demo data**. Every page fills with realistic sample figures. All names are placeholders (Engineer 01, Team Leader 1, Auditor 1 and so on). **Clear demo data** removes only the demo records, because each one is tagged `demo: true`.

---

## Catalistics AI (optional)

Managers and admins can ask questions such as *"Which engineers are below 80% completion this month?"* The answer is worked out from the live data.

**How it works:** the page sends the question to a Firebase **Cloud Function** (`functions/`). The function:
- checks the person is a signed‑in manager or admin
- checks the AI is switched on and the person is within the daily and monthly limits
- lets Claude look up the figures it needs, using four read‑only data tools
- returns the answer and records the cost on **AI Usage**

The Claude API key is stored as a Firebase secret and never appears in the web pages.

**One‑off setup:**
1. Upgrade the Firebase project to the **Blaze (pay as you go)** plan. Cloud Functions require it. Normal use is usually within the free allowance.
2. Get a Claude API key from **platform.claude.com** → API keys. Add some credit to that account.
3. From this folder, in Command Prompt, run:
   ```bash
   cd functions
   npm install
   cd ..
   firebase functions:secrets:set ANTHROPIC_API_KEY --project metering-1-22462
   ```
   Paste the key when asked. Nothing appears on screen while you paste, which is normal.
4. Deploy the function and the updated rules:
   ```bash
   firebase deploy --only functions,firestore --project metering-1-22462
   ```
   If it asks to enable APIs (Cloud Functions, Cloud Build, Artifact Registry, Secret Manager), answer **Y**. The first deploy takes a few minutes.
5. Open **Catalistics AI** in the menu and ask a question.

**Settings** are on Targets & KPIs → **AI assistant**:
- switch the AI on or off
- the model (default `claude-sonnet-5-5`; `claude-haiku-5-5` is much cheaper)
- the token prices used for cost estimates
- the monthly budget and the questions per person per day
- the suggested questions shown on the page

The function runs in `europe-west2` (London). If you change that, change `REGION` in `functions/index.js` **and** `functionsRegion` in `assets/firebase-config.js`.

## Pages

| Area | Page | File |
|---|---|---|
| Live screens | Work Screen (add `?tv=1` for wall display) | `work-screen.html` |
| | Office Screen (rotating TV display) | `office-screen.html` |
| | Daily Performance | `daily-performance.html` |
| | Weekly Performance | `weekly-performance.html` |
| Daily data | Submit Performance (type or upload; re‑open a date to amend) | `submit-performance.html` |
| | Attendance (day + month calendar) | `attendance.html` |
| | Job Scheduling (outcomes → performance) | `scheduling.html` |
| Reports | Catalistics AI (ask questions in plain English) | `catalistics-ai.html` |
| | Executive Dashboard | `executive-dashboard.html` |
| | Performance Report (any range, Excel export) | `performance-report.html` |
| | League Table (weighted score) | `league-table.html` |
| | Finance (revenue, cost, margin, forecast) | `finance.html` |
| Bonus & pay | Bonus Calculator (+ deductions, payroll export) | `bonus-calculator.html` |
| | Additional Payments (claims approval) | `additional-payments.html` |
| People | Engineers | `engineers.html` |
| | Absences (Bradford Factor triggers) | `absences.html` |
| | Capacity Planner | `capacity.html` |
| | On‑Call Rota | `on-call.html` |
| | Meetings | `meetings.html` |
| Quality | Compliance Audits | `compliance-audits.html` |
| | Complaints | `complaints.html` |
| | Job Refusals | `job-refusals.html` |
| | No Access Visits | `no-access.html` |
| | Customer Payments | `customer-payments.html` |
| | Escalations | `escalations.html` |
| | Skills Matrix | `skills-matrix.html` |
| | Tester Calibration | `tester-calibration.html` |
| Fleet | Vehicle Checks (+ "working without a check") | `vehicle-checks.html` |
| | Van Times (late start / early finish / long day) | `van-times.html` |
| | Speeding | `speeding.html` |
| Portal | Engineer Portal (staff can preview any engineer) | `portal.html` |
| | Portal Notices | `notifications.html` |
| | Portal Documents | `documents.html` |
| Admin | Targets & KPIs | `data-input.html` |
| | Users & Access | `users.html` |
| | AI Usage (questions, tokens, cost vs budget) | `ai-usage.html` |
| | Demo Data | `demo-data.html` |
| System | Home, Sign in, First‑time setup | `index.html`, `login.html`, `setup.html` |

## Firestore collections

| Collection | What it holds |
|---|---|
| `settings` | Document `config`: every target, KPI, rate, contract, team, attendance code and list |
| `users` | One document per sign‑in (ID = Firebase Auth UID): name, email, role, linked engineer, active |
| `engineers` | Engineer directory |
| `dailyPerformance` | One per engineer per day (ID `YYYY-MM-DD_engineerId`): booked, completed, meters, aborts, no access, miles |
| `attendance` | One per engineer per day (ID `YYYY-MM-DD_engineerId`): attendance code |
| `scheduledJobs` | Booked jobs and their outcomes |
| `absences` | Absence spells |
| `vehicleChecks`, `vanJourneys`, `speedingIncidents` | Fleet records |
| `complianceAudits`, `complaints`, `jobRefusals`, `noAccessVisits`, `customerPayments`, `escalations` | Quality records |
| `qualifications` | One per engineer per qualification (ID `engineerId_qualification`), with optional certificate file |
| `qualificationSubmissions` | Certificates sent in by engineers from the portal, waiting for approval on the Skills Matrix |
| `testerCalibrations` | Test equipment and calibration dates |
| `additionalPayments` | Claims (Pending / Approved / Rejected) |
| `bonusAdjustments` | Bonus deductions |
| `bonusStatements` | Approved bonus per engineer per period (shown in the portal) |
| `financeEntries` | Other costs per month and contract |
| `onCallRota`, `meetings` | Rota and meetings |
| `notifications`, `portalDocuments` | What engineers see in their portal |
| `aiUsage` | One per AI question: who asked, the question, tokens and estimated cost (written only by the Cloud Function) |

Dates are stored as `YYYY-MM-DD` text. Every query filters on a single field, so **no composite indexes are needed**.

## How the main numbers are worked out

- **Target (meters):** each engineer‑day in `dailyPerformance` adds that contract's *meters per engineer per day*.
- **Completion %** = completed ÷ booked. **Abort %** = aborts ÷ booked. **Miles per meter** = miles ÷ meters.
- **Attendance %** = days at work ÷ (days at work + sickness + other absence). How each code counts is set per code.
- **Revenue** = meters × revenue per meter. **Engineer cost** = engineer days × cost per engineer day.
- **Forecast** = month‑to‑date run rate × working days in the month. Working days and bank holidays come from settings.
- **League score:** each measure is scaled 0–100 across the engineers in the table, then weighted. The weights are set in settings.
- **Bonus** = (meters above the daily threshold × rate + completed jobs × rate) × quality multiplier − deductions.
  - The quality multiplier comes from the engineer's audit pass rate, using the bands in settings.
  - No bonus is paid if completion falls below the minimum set in settings.
- **Bradford Factor** = spells² × days over the look‑back period.

## Moving to another client

1. Create a new Firebase project. Put its settings in **`assets/firebase-config.js`**, and its ID in `.firebaserc`, `deploy.bat` (`PROJECT`) and `firebase.json` (`site`).
2. Deploy the rules and hosting as above, then run `setup.html`. Also change `PROJECT` in `deploy.bat` and `site` in `firebase.json`.
3. On Targets & KPIs → Backup, you can **download** one installation's settings and **load** them into another.
4. Logo files are in `assets/` (`logo.png`, `logo-mark.png`, `logo-wordmark.png`, `favicon.png`).

## Security notes

- Sign‑in is Firebase Authentication on every page. Roles are enforced by `firestore.rules` as well as in the pages.
- Engineers can only read their own records, and can only create *Pending* claims for themselves.
- The first‑admin rule works only while `settings/config` does not exist. Do not delete that document.
- The Firebase web API key in `firebase-config.js` is not a secret. Access is controlled by the rules. Consider also restricting the key to your hosting domain in Google Cloud console → Credentials.
