import admin from "firebase-admin";

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

const patients = [
  {
    patientId: "PT-001",
    patientIdLower: "pt-001",
    project: "Co-Exist",
    overallStatus: "In Process",
    notes: "Example coded record.",
    workflow: {
      phenotyping: { status: "Completed", performedDate: "2026-05-20", assignedTo: "Magda", notes: "" },
      requestCells: { status: "Completed", requestedDate: "2026-05-21", assignedTo: "Nisha", notes: "" },
      xCelligence: { status: "In Process", assignedTo: "Magda", notes: "" },
      elisa: { status: "Not Started", assignedTo: "Magda", notes: "" },
      report: { status: "Not Started", assignedTo: "Nisha", notes: "" }
    },
    emailNotification: { sent: false, status: "Not Ready", sentAt: null, recipients: [], subject: "QC CoA Ready for Patient PT-001 - Co-Exist", lastError: "" }
  },
  {
    patientId: "PT-002",
    patientIdLower: "pt-002",
    project: "CARE",
    overallStatus: "Ready for Email",
    notes: "Ready example.",
    workflow: {
      phenotyping: { status: "Completed", performedDate: "2026-05-18", assignedTo: "Nisha", notes: "" },
      requestCells: { status: "Completed", requestedDate: "2026-05-18", assignedTo: "Magda", notes: "" },
      xCelligence: { status: "Completed", assignedTo: "Magda", notes: "" },
      elisa: { status: "Completed", assignedTo: "Nisha", notes: "" },
      report: { status: "Completed", assignedTo: "Magda", notes: "" }
    },
    emailNotification: { sent: false, status: "Ready to Send", sentAt: null, recipients: [], subject: "QC CoA Ready for Patient PT-002 - CARE", lastError: "" }
  }
];

async function seed() {
  await db.doc("settings/global").set({
    emailRecipients: ["qc-coa-notifications@example.com"],
    projects: ["Co-Exist", "CARE"],
    assignees: ["Magda", "Nisha"],
    emailTemplate: `Hello,

The QC workflow for Patient [Patient ID] under the [Project] project has been completed.

Completed items:

* Phenotyping
* Request Cells
* xCELLIGENCE
* ELISA
* Report

The patient record is now ready for CoA issuance.

Thank you.`,
    userRoles: {},
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  for (const patient of patients) {
    await db.collection("patients").add({
      ...patient,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: "seed",
      updatedBy: "seed"
    });
  }

  console.log("Seed data written.");
}

seed().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
