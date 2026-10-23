// ============================================================
// NAGAR NIGAM — Firebase Configuration
// Project: nagar-nigam-attendance
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth }        from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore }   from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyBrvClUMUQ_kSCpMMeuS7W2B-MHoVl08NY",
  authDomain:        "nagar-nigam-attendance.firebaseapp.com",
  projectId:         "nagar-nigam-attendance",
  storageBucket:     "nagar-nigam-attendance.firebasestorage.app",
  messagingSenderId: "329256152372",
  appId:             "1:329256152372:web:435a2994317e101d1b0961",
  measurementId:     "G-R5BJNFYF6G"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

export { auth, db };
