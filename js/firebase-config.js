// Firebase Config (Compat Version)
const firebaseConfig = {
    apiKey: "AIzaSyB0oPTLEYuNiWCx5s9GmZzGzyH1z-HXwb8",
    authDomain: "onlineadmission-f85c6.firebaseapp.com",
    projectId: "onlineadmission-f85c6",
    storageBucket: "onlineadmission-f85c6.firebasestorage.app",
    messagingSenderId: "996707362986",
    appId: "1:996707362986:web:fea98a07bea032ff7e48d3",
    measurementId: "G-6H910NXDM1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log("Persistence failed: Multiple tabs open");
        } else if (err.code == 'unimplemented') {
            console.log("Persistence not supported");
        }
    });
