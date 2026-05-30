import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_SETTINGS } from "../constants";
import type { AppSettings } from "../types";

const settingsRef = doc(db, "settings", "global");

export function subscribeSettings(callback: (settings: AppSettings) => void) {
  return onSnapshot(settingsRef, (snapshot) => {
    callback(snapshot.exists() ? ({ ...DEFAULT_SETTINGS, ...snapshot.data() } as AppSettings) : DEFAULT_SETTINGS);
  });
}

export async function saveSettings(settings: AppSettings, userId: string) {
  await setDoc(
    settingsRef,
    {
      ...settings,
      updatedAt: serverTimestamp(),
      updatedBy: userId
    },
    { merge: true }
  );
}
