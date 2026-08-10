# Anywork365

Anywork365 is a Nigerian work marketplace built around two related networks:

- clients finding, booking and paying artisans;
- professionals finding opportunities published by recruiters.

The same application serves the public marketplace, role-specific dashboards,
customer support, financial operations and the Android shell. The web
application is the source of truth; the Android app is a Capacitor container
pointing at the production site. Capacitor's iOS dependency is installed, but
an iOS native project is not currently checked into this repository.

## What is in production scope

### Client and artisan marketplace

- artisan registration, profiles, portfolios, verification and reviews;
- category, state and local-government discovery;
- opt-in live location and distance-ranked nearby discovery;
- booking, chat and push notifications;
- client wallet funding through Paystack;
- booking-specific locked funds;
- artisan confirmation, completion, cancellation and refunds;
- pending and available artisan earnings;
- verified-bank withdrawals;
- financial moderation, reconciliation and audit trails.

### Professional and recruiter marketplace

- professional profiles and portfolios;
- recruiter and company profiles;
- vacancy publishing and discovery;
- job applications and application management;
- recruiter workflows for reviewing, shortlisting and hiring candidates.

### Operations

- administrator and support roles;
- account moderation and suspension;
- financial review queues and reports;
- transactional email;
- web and native push notifications;
- encrypted application backups and restore tooling.

## Runtime and dependencies

| Area | Implementation |
| --- | --- |
| Web application | Next.js 15 App Router, React 19, TypeScript |
| UI | Tailwind CSS and repository-owned components |
| Validation | Zod and React Hook Form |
| Identity | Firebase Authentication and Firebase Admin |
| Server session | Firebase session cookie in `__session` |
| Database | MySQL 8 through `mysql2/promise` |
| Payments | Paystack, behind the internal payment-rail interface |
| Email | Resend |
| Mobile | Capacitor 8; Android native project included |
| Native services | Geolocation and push notifications |
| Deployment | Vercel or Node 22/Docker behind Caddy |

Node.js 22 is the supported runtime. Use the Node version declared in
`package.json`; other versions are not part of the supported development or
release environment.

## Repository layout

```text
src/
  app/                    Next.js pages, layouts and route handlers
    api/                  HTTP boundary; authentication and validation live here
    admin/                administration interface
    moderation/           finance and risk operations
    support/              customer-support console
  components/             shared UI and feature components
  hooks/                  browser and authenticated-user hooks
  lib/
    financial/            current ledger, payment, risk and reconciliation code
    firebase/             Firebase client, admin and notification adapters
    auth.ts               server session creation and verification
    db.ts                 MySQL pool and query helpers
    queries.ts            marketplace data access
  types/                  shared application contracts

scripts/
  migrations/             current additive SQL migrations
  schema.sql              baseline schema for a new database
  *.mjs / *.ts            migration, reconciliation, backup and release tools

tests/financial/          deterministic financial and concurrency tests
docs/                     payment architecture and operational runbooks
android/                  generated/synchronised Capacitor Android project
capacitor-public/         native shell bootstrap assets
```

Older migrations remain at the top level of `scripts/` for installations that
predate the consolidated finance migrations. Do not move or rename an applied
migration: operational records refer to the filename.

## Local setup

### Prerequisites

- Node.js 22 and npm;
- MySQL 8;
- a Firebase project with Email/Password and Google providers configured;
- Paystack test credentials for payment work;
- Resend credentials when testing transactional email.

Android builds additionally require a Java 21 runtime and the Android SDK.

### Install and configure

```bash
npm ci
cp .env.example .env.local
```

Populate `.env.local` for the Next.js application. Most operational scripts
load `.env`, so copy or provide the same non-production development values
there before using database or finance scripts.

Never place live secrets in the repository. In particular, Firebase service
accounts, Paystack secret keys, database credentials, reconciliation secrets
and signing keystores must be supplied through the deployment environment.

### Create a development database

For a new, disposable database:

```bash
node scripts/init-db.mjs
```

For an existing database, apply the required migration explicitly and inspect
the output before continuing:

```bash
node scripts/run-migration.mjs scripts/migrations/<migration-file>.sql
```

Finance migrations use dedicated dry-run and apply commands. Do not run finance
SQL manually in production; follow the rollout sequence in the relevant
runbook.

### Start the application

```bash
npm run dev
```

The default local address is `http://localhost:3000`.

There are no repository-owned shared login credentials. Create users through
the normal registration flow or use local seed scripts with credentials you
control.

## Environment configuration

`.env.example` is the maintained inventory. The main groups are:

- `NEXT_PUBLIC_FIREBASE_*`: browser Firebase configuration;
- `FIREBASE_SERVICE_ACCOUNT`: Firebase Admin service-account JSON;
- `MYSQL_*`: database connection and TLS configuration;
- `PAYSTACK_*`: payment rail and environment selection;
- `MONEY_V2_ENABLED` and `MARKETPLACE_FINANCE_V3_ENABLED`: finance rollout
  controls;
- `RECONCILIATION_SECRET` and `FINANCIAL_WORKER_SECRET`: authenticated worker
  endpoints;
- wallet, withdrawal and hold limits;
- `RESEND_*`: transactional email;
- `CHAT_ENCRYPTION_KEY`: encryption key for protected chat data;
- `NEXT_PUBLIC_APP_URL`: canonical application origin.

Paystack environment and key prefixes must agree. Never use live Paystack keys
against a development database or test keys against production financial data.

## Authentication and authorisation

The browser signs in through Firebase. The server exchanges the Firebase ID
token for a one-day, HTTP-only Firebase session cookie. Middleware performs an
expiry-only routing check; protected API handlers perform cryptographic session
verification and load the current user and role from MySQL.

Email verification is required for authenticated application operations. Role
checks belong at the API boundary even when the corresponding UI is hidden.
Current application roles are:

- `client`
- `artisan`
- `professional`
- `recruiter`
- `support`
- `admin`

Support access is intentionally narrower than administrator access. Financial
state must never be changed solely because a page or button is hidden.

## Payments and ledger rules

Money is represented in integer minor units inside the current finance system.
Do not introduce floating-point arithmetic into payment, fee, balance or
withdrawal code.

The normal booking flow is:

1. Paystack verifies a client wallet funding or booking payment.
2. The application posts the verified value to its internal ledger.
3. Booking creation locks funds in a booking-specific account.
4. Completion separates artisan earnings from the versioned platform fee.
5. Artisan earnings remain pending for the configured safety period.
6. A worker makes matured earnings available for withdrawal.
7. Paystack transfer results are reconciled before a withdrawal becomes final.

Callbacks, webhooks and worker retries are expected to repeat. All money-moving
operations must remain idempotent and must preserve the ledger invariants.
Provider processing fees are recorded separately from marketplace revenue.

Read these documents before changing financial behaviour:

- [`docs/wallet-architecture.md`](docs/wallet-architecture.md)
- [`docs/wallet-business-rules.md`](docs/wallet-business-rules.md)
- [`docs/wallet-state-machines.md`](docs/wallet-state-machines.md)
- [`docs/paystack-integration.md`](docs/paystack-integration.md)
- [`docs/wallet-migration-runbook.md`](docs/wallet-migration-runbook.md)
- [`docs/financial-incident-response.md`](docs/financial-incident-response.md)

The seeded marketplace fee is a technical default, not approval of a commercial
rate. Fee, tax and disclosure changes require product, finance and legal signoff.

## Live location

Nearby artisan discovery is based on coordinates explicitly shared by an
artisan and the requesting user's device location. Public responses contain an
area label and calculated distance; they do not return an artisan's raw GPS
coordinates.

Location sharing is opt-in, updates while the application is active and expires
after 30 minutes without a refresh. Do not remove the expiry or expose stored
coordinates without a separate privacy and safety review.

The feature requires:

- the `artisan_live_locations` migration;
- HTTPS in browsers;
- browser or Android location permission;
- a newly published mobile binary whenever native permissions or Capacitor
  plugins change.

## Development checks

Run the checks relevant to the code being changed:

```bash
npm run type-check
npm run build
npm run test:financial
```

`npm run test:financial` covers the financial state machines, money-value
handling, ledger invariants and MySQL concurrency cases. A change to booking
funding, release, refund, dispute, withdrawal or reconciliation code is not
complete without the appropriate financial tests.

The current `lint` script is retained for compatibility but Next.js 15 no longer
ships the old `next lint` command. Use the configured ESLint CLI when restoring
lint enforcement in CI.

## Database change policy

- Make schema changes additive unless a reviewed rollout explicitly allows a
  destructive operation.
- Add a dated migration under `scripts/migrations/`.
- Update `scripts/schema.sql` so new installations match the migrated schema.
- Provide a backfill and rollback or containment plan when existing rows are
  affected.
- Test against a staging copy before production.
- Reconcile financial tables before and after any finance migration.
- Never edit a migration that may already have run in another environment.

## Mobile development

The native shells load `https://anywork365.ng`, configured in
`capacitor.config.json`. Web-only changes become available after web deployment.
Changes to native plugins, Android permissions, icons, splash resources or
Capacitor configuration require a native release.

After changing a Capacitor dependency:

```bash
node node_modules/@capacitor/cli/bin/capacitor sync android
```

Build the Android App Bundle with the repository's release keystore configured,
increment `versionCode`, test the signed build against the production-like
environment, then upload the new `.aab` through Play Console. Do not commit
keystore passwords or generated signing material.

## Deployment

### Vercel

`vercel.json` defines the wallet worker and finance-health schedules. Production
secrets must be configured before enabling the money feature flags. The helper
below validates and configures the expected production variables:

```bash
npm run deploy:configure:production
```

### Docker

The Docker image builds and runs the standalone Node service on port 3000.
`docker-compose.yml` places Caddy in front of the application and persists
verification uploads in a named volume.

```bash
docker compose up --build -d
```

Database migrations are a separate release step. Application startup does not
implicitly migrate production data.

## Release checklist

Before merging or deploying a production change:

1. Review the diff for secrets, generated binaries and unrelated changes.
2. Confirm the commit author is linked to a member of the Anywork365 Vercel team.
3. Run type checking, the production build and affected test suites.
4. Apply and verify migrations in staging.
5. Exercise authentication and the affected role paths.
6. For money changes, complete preflight, migration and reconciliation checks.
7. Verify Paystack mode, webhook configuration and worker secrets.
8. Confirm support and rollback procedures for the release.
9. Deploy the web application.
10. Publish a new mobile build when native code or permissions changed.
11. Monitor errors, financial health, webhooks and reconciliation after release.

## Operational ownership

Production incidents involving payments, account compromise, suspected fraud or
data exposure should be contained before feature work continues. Preserve logs
and provider references, avoid manual ledger edits, and follow the incident and
reconciliation runbooks in `docs/`.

This is proprietary Anywork365 software. Distribution and reuse are governed by
the organisation's internal agreements; the repository is not published under
the MIT licence.

Production deployments are managed through Vercel.
