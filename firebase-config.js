// firebase-config.js
// IMPORTANT: replace the REPLACE_ME strings below with your project's values
// This file must be valid JS (not raw JSON). It must run before script.js.

const firebaseConfig = {
  apiKey: "AIzaSyCtx_K76mH3agerccTXMc08W8sqKXUI_pA",
  authDomain: "wishing-well-2025.firebaseapp.com",
  databaseURL:"https://wishing-well-2025-default-rtdb.firebaseio.com",
  projectId: "wishing-well-2025",
  storageBucket: "wishing-well-2025.firebasestorage.app",
  messagingSenderId: "643053862807",
  appId: "1:643053862807:web:54ddb442035fda90ce8ed2"  
};

// initialize
if (!window.firebase || !firebase.apps) {
  // firebase SDK should already be loaded from index.html
}
try {
  firebase.initializeApp(firebaseConfig);
  // expose the realtime database to the window so script.js can use it
  window.db = firebase.database();
  console.log("Firebase initialized successfully — window.db is set");
} catch (e) {
  console.error("Firebase init error (check config):", e);
}




