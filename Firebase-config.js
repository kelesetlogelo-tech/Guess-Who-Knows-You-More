import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyCtx_K76mH3agerccTXMc08W8sqKXUI_pA",
    authDomain: "wishing-well-2025.firebaseapp.com",
    databaseURL:"https://wishing-well-2025-default-rtdb.firebaseio.com",
    projectId: "wishing-well-2025",
    storageBucket: "wishing-well-2025.firebasestorage.app",
    messagingSenderId: "643053862807",
    appId: "1:643053862807:web:54ddb442035fda90ce8ed2"  
};

const app = initializeApp(firebaseConfig);
window.db = getDatabase(app);
console.log("✅ Firebase initialized successfully");

