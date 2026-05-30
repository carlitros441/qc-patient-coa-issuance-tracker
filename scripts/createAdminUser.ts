import admin from "firebase-admin";
import { DEFAULT_SETTINGS } from "../src/constants";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD before running this script.");
  console.error("Example: $env:ADMIN_EMAIL='qc-admin@example.com'; $env:ADMIN_PASSWORD='ChangeMe123!'; npm.cmd run create-admin");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

async function createAdminUser() {
  let user;
  try {
    user = await admin.auth().getUserByEmail(email!);
    console.log(`Found existing Firebase Auth user: ${user.uid}`);
  } catch {
    user = await admin.auth().createUser({
      email,
      password,
      emailVerified: true,
      disabled: false
    });
    console.log(`Created Firebase Auth user: ${user.uid}`);
  }

  const settingsRef = admin.firestore().doc("settings/global");
  const settingsSnap = await settingsRef.get();
  const currentRoles = settingsSnap.exists ? settingsSnap.data()?.userRoles ?? {} : {};

  await settingsRef.set(
    {
      ...DEFAULT_SETTINGS,
      ...(settingsSnap.exists ? settingsSnap.data() : {}),
      userRoles: {
        ...currentRoles,
        [user.uid]: "Admin"
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: "bootstrap-script"
    },
    { merge: true }
  );

  console.log(`Assigned Admin role to ${email}.`);
}

createAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
