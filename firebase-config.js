// Replace with your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCtx_K76mH3agerccTXMc08W8sqKXUI_pA",
  authDomain: "wishing-well-2025.firebaseapp.com",
  databaseURL:"https://console.firebase.google.com/project/wishing-well-2025/database/wishing-well-2025-default-rtdb/data/~2F"
  projectId: "wishing-well-2025",
  storageBucket: "wishing-well-2025.firebasestorage.app",
  messagingSenderId: "643053862807",
  appId: "1:643053862807:web:54ddb442035fda90ce8ed2"  
};

try {
  firebase.initializeApp(firebaseConfig);
  // expose the Database instance on window so other scripts (script.js) can use it
  window.db = firebase.database();
  console.log("Firebase initialized successfully — window.db is set");
} catch (err) {
  console.error("Firebase initialization error:", err);
  // ensure window.db is undefined if init failed
  window.db = undefined;
}
