# Firebase Setup

This project is already connected to Firebase. Use this file as the current
operational checklist, not a from-scratch setup guide.

## Current State

- Firebase project: `petchmukda-bot`
- Firestore database ID: `petchmukda-bot`
- Firebase web config: `src/firebase/firebaseConfig.json`
- Project aliases: `.firebaserc`
- Firestore rules/indexes: `firestore.rules`, `firestore.indexes.json`
- Storage rules: `storage.rules`
- Production auth path: LINE Login -> Cloud Function -> Firebase custom token
- Local auth path: Firebase Auth emulator with dev login buttons

Google Sign-in is not part of the current setup. Do not enable or document it
for this project.

## Deploy Rules From This Repo

You do not need to copy/paste rules into the Firebase Console. `firebase.json`
already points Firebase CLI at the local rules and index files.

First check that the CLI is logged in and using the right project:

```bash
npx -y firebase-tools@latest login
npx -y firebase-tools@latest use
```

Deploy Firestore rules/indexes and Storage rules:

```bash
npx -y firebase-tools@latest deploy --only firestore,storage --project petchmukda-bot
```

Run a dry run first when you want validation without changing production:

```bash
npx -y firebase-tools@latest deploy --only firestore,storage --project petchmukda-bot --dry-run
```

Console copy/paste should be treated as a fallback only, because it can drift
from the repo.

## Deploy App And Functions

Build the web app before deploying Hosting:

```bash
npm run build
npx -y firebase-tools@latest deploy --only hosting --project petchmukda-bot
```

Deploy Cloud Functions:

```bash
npx -y firebase-tools@latest deploy --only functions --project petchmukda-bot
```

Deploy everything configured in `firebase.json`:

```bash
npm run build
npx -y firebase-tools@latest deploy --project petchmukda-bot
```

## Local Development

Start the Firebase emulators and Vite dev server:

```bash
npm run dev
```

The dev script starts Auth, Firestore, Functions, and Storage emulators, then
runs the app with emulator connections enabled. The login screen shows dev login
buttons only in emulator/dev mode.

For emulator demo data, use the seed button on the dev login screen. Do not run
the production seed helper unless you intentionally want to write the initial
seed data into the live Firestore database.

## Auth Notes

- Production users sign in with LINE Login only.
- `VITE_LINE_LOGIN_CHANNEL_ID` is the frontend LINE Login channel ID.
- `lineAuth` exchanges the LINE auth code for a Firebase custom token.
- `ADMIN_LINE_USER_ID` identifies the configured admin LINE account.
- Employee access depends on `employees/{employeeId}.lineUserId` matching the
  Firebase Auth `uid`.
- Admin access depends on the Firebase custom claim `admin: true`.

If LINE credentials or admin LINE user IDs change, update Firestore
`config/secrets`. A Functions redeploy is only needed when you change function
code or non-LINE runtime env.

## Troubleshooting

### Missing or insufficient permissions

Deploy the current rules from this repo, then check the signed-in user's
`lineUserId` link or `admin` custom claim.

### LINE Login says channel ID is missing

Set `VITE_LINE_LOGIN_CHANNEL_ID` in `.env.local`, then restart the dev server.

### `auth/invalid-custom-token`

Check that Functions are deployed to `petchmukda-bot`, LINE Login credentials
are current, and the custom token is created by the same Firebase project.

### Storage upload denied

Deploy `storage.rules`, confirm the user is signed in, and confirm the uploaded
file is an image under 8 MB.
