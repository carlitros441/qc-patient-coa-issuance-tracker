import admin from "firebase-admin";
import { google } from "googleapis";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

admin.initializeApp();

const clientId = defineSecret("GMAIL_CLIENT_ID");
const clientSecret = defineSecret("GMAIL_CLIENT_SECRET");
const refreshToken = defineSecret("GMAIL_REFRESH_TOKEN");
const sender = defineSecret("GMAIL_SENDER");

function encodeMessage({ to, subject, body, from }: { to: string[]; subject: string; body: string; from: string }) {
  const message = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    body
  ].join("\n");
  return Buffer.from(message).toString("base64url");
}

const defaultWorkflowSteps = [
  { id: "phenotyping", name: "Phenotyping", type: "core" },
  { id: "requestCells", name: "Request Cells", type: "core" },
  { id: "xCelligence", name: "XCelligence", type: "core" },
  { id: "elisa", name: "ELISA", type: "core" },
  { id: "report", name: "Report", type: "core" }
];

function getConfiguredWorkflowSteps(settings: FirebaseFirestore.DocumentData | undefined) {
  const workflowSteps = Array.isArray(settings?.workflowSteps) && settings?.workflowSteps.length > 0
    ? settings.workflowSteps
    : defaultWorkflowSteps;
  const seen = new Set<string>();
  return [
    ...workflowSteps.filter((step: { id?: string; name?: string; type?: string }) => {
      if (!step.id || !step.name || seen.has(step.id)) return false;
      seen.add(step.id);
      return true;
    }),
    ...defaultWorkflowSteps.filter((step) => !seen.has(step.id))
  ];
}

function isWorkflowReady(patient: FirebaseFirestore.DocumentData, settings: FirebaseFirestore.DocumentData | undefined) {
  const workflow = patient.workflow;
  const customAssays = Array.isArray(patient.customAssays) ? patient.customAssays : [];
  return getConfiguredWorkflowSteps(settings).every((step: { id: string; type: string }) => {
    if (step.type === "core") return workflow?.[step.id]?.status === "Completed";
    return customAssays.find((assay: { id?: string }) => assay.id === step.id)?.status === "Completed";
  }) && patient.emailNotification?.sent === false;
}

export const sendCoaEmailNotification = onCall(
  { region: "us-central1", secrets: [clientId, clientSecret, refreshToken, sender] },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Sign in is required.");

    const { patientDocId, recipients, subject, body } = request.data as {
      patientDocId?: string;
      recipients?: string[];
      subject?: string;
      body?: string;
    };

    if (!patientDocId || !Array.isArray(recipients) || recipients.length === 0 || !subject || !body) {
      throw new HttpsError("invalid-argument", "Patient, recipients, subject, and body are required.");
    }

    const patientRef = admin.firestore().collection("patients").doc(patientDocId);
    const patientSnap = await patientRef.get();
    if (!patientSnap.exists) throw new HttpsError("not-found", "Patient record not found.");

    const patient = patientSnap.data()!;
    const settingsSnap = await admin.firestore().doc("settings/global").get();
    const ready = isWorkflowReady(patient, settingsSnap.data());

    if (!ready) throw new HttpsError("failed-precondition", "Workflow is not ready for email notification.");

    try {
      const oauth2 = new google.auth.OAuth2(clientId.value(), clientSecret.value());
      oauth2.setCredentials({ refresh_token: refreshToken.value() });
      const gmail = google.gmail({ version: "v1", auth: oauth2 });
      await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodeMessage({ to: recipients, subject, body, from: sender.value() })
        }
      });

      await patientRef.update({
        "emailNotification.sent": true,
        "emailNotification.status": "Sent",
        "emailNotification.sentAt": admin.firestore.FieldValue.serverTimestamp(),
        "emailNotification.recipients": recipients,
        "emailNotification.subject": subject,
        "emailNotification.lastError": "",
        overallStatus: "Ready for CoA",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid
      });

      await admin.firestore().collection("auditLogs").add({
        patientDocId,
        action: "Sent CoA email notification",
        changedField: "emailNotification",
        previousValue: "Ready to Send",
        newValue: "Sent",
        userId: request.auth.uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { ok: true };
    } catch (error) {
      await patientRef.update({
        "emailNotification.status": "Failed",
        "emailNotification.lastError": error instanceof Error ? error.message.slice(0, 1000) : "Unknown Gmail API error",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: request.auth.uid
      });
      throw new HttpsError("internal", "Email notification failed.");
    }
  }
);
