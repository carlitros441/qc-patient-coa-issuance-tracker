import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export interface SendEmailPayload {
  patientDocId: string;
  recipients: string[];
  subject: string;
  body: string;
}

export async function sendEmailNotification(payload: SendEmailPayload) {
  const callable = httpsCallable<SendEmailPayload, { ok: boolean }>(functions, "sendCoaEmailNotification");
  return callable(payload);
}
