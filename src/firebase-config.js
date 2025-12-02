import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";

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
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Enable offline persistence
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a a time.
      console.log("Persistence failed: Multiple tabs open");
  } else if (err.code == 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.log("Persistence not supported");
  }
});

export { app, auth, db, storage, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, ref, uploadBytes, getDownloadURL };
