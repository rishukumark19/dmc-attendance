# 🔥 Firebase Setup Guide — नगर निगम Attendance System

## Why Firebase?
Firebase is Google's free cloud database. Once set up, ALL staff can log in from
their own phones and ALL data is shared in real-time. The admin sees everything
from any device.

---

## Step 1 — Create a Firebase Project

1. Go to: https://console.firebase.google.com/
2. Click **"Add project"**
3. Name it: `nagar-nigam-attendance`
4. Disable Google Analytics (not needed)
5. Click **Create Project**

---

## Step 2 — Enable Authentication

1. In left sidebar → **Build** → **Authentication**
2. Click **Get started**
3. Under **Sign-in method** tab → Click **Email/Password**
4. Toggle **Enable** → Save

---

## Step 3 — Create Firestore Database

1. In left sidebar → **Build** → **Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (we'll secure it later)
4. Select a location (e.g., `asia-south1` for India)
5. Click **Done**

---

## Step 4 — Get Your Config Keys

1. Go to **Project Settings** (gear icon top left)
2. Scroll to **Your apps** section
3. Click **Add app** → Choose **Web** (</> icon)
4. Register app name: `nagar-nigam-web`
5. Copy the `firebaseConfig` object shown

---

## Step 5 — Update the Config File

Open: `js/firebase-config.js`

Replace the placeholder values with your actual values:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← your actual key
  authDomain:        "nagar-nigam-attendance.firebaseapp.com",
  projectId:         "nagar-nigam-attendance",
  storageBucket:     "nagar-nigam-attendance.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc..."
};
```

---

## Step 6 — Create the First Admin Account

After Firebase is configured, open browser console on index.html and run:

```javascript
// This only needs to be done ONCE
import { auth, db } from './js/firebase-config.js';
import { createUserWithEmailAndPassword } from "...firebase-auth...";
import { doc, setDoc, serverTimestamp } from "...firebase-firestore...";

const cred = await createUserWithEmailAndPassword(auth, 'admin@nagarnigam.local', 'YOUR_ADMIN_PASSWORD');
await setDoc(doc(db, 'staff', cred.user.uid), {
  name: 'Admin',
  empId: 'ADMIN',
  role: 'admin',
  active: true,
  createdAt: serverTimestamp()
});
```

OR — use the Admin panel's "Add Staff" with role=admin once logged in.

---

## Step 7 — Firestore Security Rules (Important!)

Go to Firestore → **Rules** tab and set:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Staff can read/write their own profile
    match /staff/{uid} {
      allow read: if request.auth.uid == uid;
      allow write: if request.auth != null && get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.role == 'admin';
    }

    // Attendance: staff can create their own, admin can read all
    match /attendance/{docId} {
      allow create: if request.auth != null && request.resource.data.staffId == request.auth.uid;
      allow update: if request.auth.uid == resource.data.staffId;
      allow read:   if request.auth != null && (
        resource.data.staffId == request.auth.uid ||
        get(/databases/$(database)/documents/staff/$(request.auth.uid)).data.role == 'admin'
      );
    }
  }
}
```

---

## How Staff Login Works

- Staff login **email** = `{EMPID_lowercase}@nagarnigam.local`
  - Example: EMP001 → `emp001@nagarnigam.local`
- Staff login **password** = their PIN (set when Admin adds them)
- Admin adds staff via the Admin panel — they do NOT register themselves

---

## File Structure

```
attendance-website/
├── index.html        ← Login page (everyone starts here)
├── staff.html        ← Staff: check-in / check-out
├── admin.html        ← Admin: manage staff, view all, salary report
├── css/
│   └── style.css     ← Shared design system
├── js/
│   └── firebase-config.js  ← Firebase config (fill this in!)
└── assets/
    └── logo.png      ← Nagar Nigam logo
```

---

## Notes

- **Server timestamps** are used for check-in/check-out — staff CANNOT fake the time by changing their phone clock
- Data is stored in Firestore (cloud) — accessible from any device, anywhere
- The website works on mobile browsers without installing an app
