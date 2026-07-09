import { doc, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

export async function loadTeaClub() {
  const ref = doc(db, "teaClub", "main");
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Firestore document teaClub/main not found");
  }

  return snap.data();
}

export async function saveMembersToTeaClub(members) {
  const ref = doc(db, "teaClub", "main");
  await updateDoc(ref, {
    "data.members": members,
    updatedAt: serverTimestamp()
  });
}

export async function saveTransactionsToTeaClub(transactions) {
  const ref = doc(db, "teaClub", "main");
  await updateDoc(ref, {
    "data.transactions": transactions,
    updatedAt: serverTimestamp()
  });
}

export async function saveMembersAndTransactionsToTeaClub(members, transactions) {
  const ref = doc(db, "teaClub", "main");
  await updateDoc(ref, {
    "data.members": members,
    "data.transactions": transactions,
    updatedAt: serverTimestamp()
  });
}
