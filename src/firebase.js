import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA2S8l91elZZ5-m6t2yFkKwLdrOEEWDql0",
  authDomain: "rm-tea-club.firebaseapp.com",
  projectId: "rm-tea-club",
  storageBucket: "rm-tea-club.firebasestorage.app",
  messagingSenderId: "843445768049",
  appId: "1:843445768049:web:8c911e009ad7dee706b0d0",
  measurementId: "G-FX4ZCQX3YH"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
