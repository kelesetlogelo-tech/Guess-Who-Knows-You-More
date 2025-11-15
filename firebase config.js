// -----------------------------
//  FIREBASE CONFIGURATION FILE
// -----------------------------

// This file assumes Firebase SDK scripts are loaded first in index.html:
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"></script>
// <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js"></script>

// Initialize Firebase
try {
const firebaseConfig = {
     apiKey: "AIzaSyCtx_K76mH3agerccTXMc08W8sqKXUI_pA",
  authDomain: "wishing-well-2025.firebaseapp.com",
  databaseURL: "https://wishing-well-2025-default-rtdb.firebaseio.com",
  projectId: "wishing-well-2025",
  storageBucket: "wishing-well-2025.firebasestorage.app",
  messagingSenderId: "643053862807",
  appId: "1:643053862807:web:54ddb442035fda90ce8ed2"
};

// Initialize app + database
  const app = firebase.initializeApp(firebaseConfig);
  const db = firebase.database();

  // Expose globally for other scripts
  window.firebase = firebase;
  window.db = db;

  console.log("✅ Firebase initialized successfully — window.db and window.firebase are set");
} catch (err) {
  console.error("🔥 Firebase init error (check config):", err);
}

