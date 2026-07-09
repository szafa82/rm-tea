import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase.js";

export async function loadTeaClub() {
  const ref = doc(db, "teaClub", "main");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Firestore document teaClub/main not found");
  }

  return snap.data();
}
