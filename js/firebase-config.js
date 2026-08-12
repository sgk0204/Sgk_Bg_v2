/* ==========================================
   FIREBASE CONFIGURATION
   ------------------------------------------
   1. Go to https://console.firebase.google.com and create a project
      (free "Spark" plan is enough for personal use).
   2. Project settings (gear icon) -> General -> "Your apps" -> click the
      "</>" web icon -> register an app -> copy the firebaseConfig object
      it gives you and paste the values below.
   3. In the left sidebar: Build -> Authentication -> Get started ->
      Sign-in method -> enable "Email/Password" (and "Google" too, if you
      want the "Continue with Google" button to work).
   4. In the left sidebar: Build -> Firestore Database -> Create database
      -> start in PRODUCTION mode -> pick a region close to you.
   5. Firestore -> Rules tab -> paste the rules from this project's
      README.md (under "Firestore security rules") -> Publish.
      This is what makes sure each user can only read/write their OWN
      data, even though everyone shares the same database.
   ========================================== */

const firebaseConfig = {
  apiKey: "AIzaSyAZBxhNkutxmAos2COXcskjyI8_rS5Aumk",
  authDomain: "sgk-bg-v2.firebaseapp.com",
  projectId: "sgk-bg-v2",
  storageBucket: "sgk-bg-v2.firebasestorage.app",
  messagingSenderId: "484971771651",
  appId: "1:484971771651:web:51b306b1440d803cbf5b36",
  measurementId: "G-TM81SSK3TX"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
