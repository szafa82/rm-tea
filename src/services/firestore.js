import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export async function loadTeaClub() {

    const ref = doc(db, "teaClub", "main");

    const snap = await getDoc(ref);

    if (!snap.exists()) {

        throw new Error("teaClub/main not found");

    }

    return snap.data();

}
