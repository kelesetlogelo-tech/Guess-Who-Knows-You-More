// firebase-config.js (template) - fill in your config and rules appropriately.
// Example (do NOT commit secrets publicly). Replace placeholders with your actual project values.

const firebaseConfig = {
  apiKey: "AIzaSyCtx_K76mH3agerccTXMc08W8sqKXUI_pA",
  authDomain: "wishing-well-2025.firebaseapp.com",
  databaseURL: "https://wishing-well-2025-default-rtdb.firebaseio.com"
  projectId: "wishing-well-2025",
  storageBucket: "wishing-well-2025.firebasestorage.app",
  messagingSenderId: "643053862807",
  appId: "1:643053862807:web:54ddb442035fda90ce8ed2"  
};

if (!window.firebase || !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
window.db = firebase.database();
console.log("Firebase initialized successfully — window.db is set");
}




