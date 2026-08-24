// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
// 1. Go to https://console.firebase.google.com
// 2. Create a project (e.g., "loksewa-portal")
// 3. Project Settings -> Your apps -> Web app (</>) -> copy config
// 4. Paste the values below, replacing the PASTE_YOUR_* placeholders
// 5. In Firebase Console enable:
//      - Firestore Database (Start in test mode, then publish firestore.rules)
//      - Authentication -> Sign-in method -> Anonymous -> Enable
//
// Until you paste real values, the site keeps working in
// local-only mode (comments/votes stored per browser).
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyBrt9S7Xqxqvn2wafgpWdz6WiriydghPpU",
  authDomain: "loksewa-portal-8a3ae.firebaseapp.com",
  projectId: "loksewa-portal-8a3ae",
  storageBucket: "loksewa-portal-8a3ae.firebasestorage.app",
  messagingSenderId: "611217654714",
  appId: "1:611217654714:web:d5d5c4d796f1fc9ac3d383"
};

// ---- Do not edit below this line ----
let db = null;
let currentUserId = null;
let firebaseReady = false;

(function initFirebase() {
  var isPlaceholder = Object.keys(firebaseConfig).some(function (key) {
    return typeof firebaseConfig[key] === "string" && firebaseConfig[key].indexOf("PASTE_YOUR_") === 0;
  });

  if (isPlaceholder) {
    console.warn("[Loksewa Portal] Firebase config not filled in yet - running in local-only mode. Edit firebase-config.js to enable shared comments & voting.");
    if (typeof setCloudStatus === "function") setCloudStatus("local", "Firebase config missing - running in local-only mode.");
    return;
  }

  if (typeof firebase === "undefined") {
    console.warn("[Loksewa Portal] Firebase SDK failed to load - running in local-only mode.");
    if (typeof setCloudStatus === "function") setCloudStatus("local", "Firebase SDK failed to load (check internet/adblocker).");
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();

    // Sign in anonymously, retrying a few times in case Firestore/Auth
    // was enabled moments ago and is still propagating.
    var signInAttempts = 0;
    function trySignIn() {
      signInAttempts++;
      firebase.auth().signInAnonymously()
        .then(function (cred) {
          currentUserId = cred.user.uid;
          firebaseReady = true;
          console.log("[Loksewa Portal] Connected - shared comments & voting active.");
          if (typeof setCloudStatus === "function") setCloudStatus("online", "Connected to Firebase - shared comments & voting active.");
          document.dispatchEvent(new Event("firebase-ready"));
        })
        .catch(function (err) {
          console.warn("[Loksewa Portal] Anonymous sign-in attempt " + signInAttempts + " failed:", err.code || "", err.message);
          if (typeof setCloudStatus === "function") setCloudStatus("offline", "Sign-in failed: " + (err.code || err.message));
          if (signInAttempts < 5) {
            setTimeout(trySignIn, 2000 * signInAttempts);
          } else {
            console.error("[Loksewa Portal] Could not connect after several attempts. Check that Authentication > Anonymous is enabled and Firestore rules are published.");
          }
        });
    }
    trySignIn();
  } catch (e) {
    console.warn("[Loksewa Portal] Firebase init error:", e.message);
  }
})();