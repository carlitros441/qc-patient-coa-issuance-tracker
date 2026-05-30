# QC Patient CoA Issuance Tracker

A React, Vite, TypeScript, Firebase Authentication, Firestore, and Firebase Cloud Functions app for tracking QC patient CoA issuance readiness across required assays and documentation steps.

The UI uses an original pastel dollhouse-inspired theme with cat-ear accents and soft QC-friendly cards. It does not include copyrighted artwork, logos, or character assets.

## Features

- Firebase Authentication sign-in gate.
- Patient creation with duplicate coded Patient ID prevention.
- Co-Exist and CARE project assignment.
- Editable workflow sections for Phenotyping, Request Cells, XCelligence, ELISA, and Report.
- Magda and Nisha color-coded assignment badges.
- Progress calculation in 20% increments across the five required workflow steps.
- Ready-for-email detection only when all workflow steps are complete and notification has not been sent.
- Gmail notification confirmation modal with patient, project, recipients, subject, and body preview.
- Secure email sending through a Firebase Cloud Function using Gmail OAuth secrets.
- Firestore audit logs for important patient changes.
- Admin settings for recipients, projects, assignees, email template, and user role mapping.
- Firestore security rules for Admin, QC User, and Viewer roles.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   npm --prefix functions install
   ```

2. Copy `.env.example` to `.env` and fill in the `VITE_FIREBASE_*` values from your Firebase web app.

3. Enable Firebase Authentication with Email/Password sign-in.

4. Create the first admin user in Firebase Auth, then add their UID to `settings/global`:

   ```json
   {
     "userRoles": {
       "AUTH_UID_HERE": "Admin"
     }
   }
   ```

   Or use the bootstrap script with a local Firebase service account:

   ```powershell
   $env:GOOGLE_APPLICATION_CREDENTIALS="C:\path\to\service-account.json"
   $env:ADMIN_EMAIL="qc-admin@example.com"
   $env:ADMIN_PASSWORD="ChangeMe123!"
   npm.cmd run create-admin
   ```

   Use a strong password and do not commit the service account JSON file.

5. Start the app:

   ```bash
   npm run dev
   ```

## Firestore Collections

- `patients`: coded patient records, workflow state, email notification state, and metadata.
- `settings/global`: recipients, projects, assignees, email template, and role mapping.
- `auditLogs`: immutable patient history records.

Patient records intentionally use coded identifiers. Do not store direct PHI unless your Firebase project, access controls, and operating procedures are authorized for that use.

## Gmail Cloud Function

Email sending happens in `functions/src/index.ts`. Gmail OAuth credentials are Firebase Function secrets, never frontend environment variables.

Configure secrets:

```bash
firebase functions:secrets:set GMAIL_CLIENT_ID
firebase functions:secrets:set GMAIL_CLIENT_SECRET
firebase functions:secrets:set GMAIL_REFRESH_TOKEN
firebase functions:secrets:set GMAIL_SENDER
```

The Gmail account must have an OAuth refresh token with Gmail send permission. Deploy the function:

```bash
npm --prefix functions run build
firebase deploy --only functions
```

## Firestore Rules

Rules are in `firestore.rules`.

Deploy them:

```bash
firebase deploy --only firestore:rules
```

Role behavior:

- `Admin`: edit settings, manage users through role mapping, edit patient records, send email notifications.
- `QC User`: add and update workflow records, view dashboard, prepare records.
- `Viewer`: read-only access.

The callable Cloud Function also validates workflow completion before sending Gmail notifications and updates admin-only error details server-side.

## Seed Data

Set `GOOGLE_APPLICATION_CREDENTIALS` to a local service account JSON path, then run:

```bash
npm run seed
```

Do not commit service account files.

## Deployment

### Firebase Hosting

```bash
npm run build
firebase deploy --only hosting
```

### GitHub Repository

Commit this project to GitHub, add the Firebase project configuration to your deployment environment, and connect the repository to Firebase Hosting or run deployments with GitHub Actions and Firebase CLI.

For GitHub Pages, this repository includes `.github/workflows/deploy-pages.yml`. In GitHub, go to repository **Settings > Secrets and variables > Actions** and add these secrets:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
- `VITE_FIREBASE_FUNCTIONS_REGION`

Then go to **Settings > Pages** and set the source to **GitHub Actions**. Push to `main` or run the workflow manually.

If you have GitHub CLI installed and authenticated, you can set the frontend build secrets from your local `.env`:

```powershell
gh auth login
.\scripts\setGithubSecrets.ps1
```

For Firebase Authentication, add the GitHub Pages domain to **Authentication > Settings > Authorized domains**. It will look like `your-user.github.io`.

Gmail sending still requires the deployed Firebase Cloud Function and Firestore/Auth configuration.

## Environment Variables

Frontend variables use the `VITE_` prefix and are safe Firebase web configuration values. Gmail client secrets, refresh tokens, service account keys, and OAuth credentials must never be placed in frontend code or committed to GitHub.
