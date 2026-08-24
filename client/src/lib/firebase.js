// Firebase Client Initialization for SubhOne
// Supports Google Sign-In, Phone OTP Authentication & Firebase Analytics
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  signOut,
} from "firebase/auth";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyDFOfxU_92sQLnNFneUPVaspWp0yRdhXZU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "subhone-8f3f2.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://subhone-8f3f2-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "subhone-8f3f2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "subhone-8f3f2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "909179742332",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:909179742332:web:de8a5138aed2da1aebc1f9",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CVDPHRZ7M3",
};

// Initialize Firebase only once
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Safe Analytics Initialization in browser environment
export let analytics = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch((err) => {
    console.debug("Firebase analytics not initialized in this context:", err);
  });
}

// Configure Google Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

/**
 * Sign in using Google Popup and retrieve user profile + Firebase ID Token
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const idToken = await user.getIdToken();
    return {
      user: {
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        phone: user.phoneNumber,
        photoURL: user.photoURL,
      },
      idToken,
    };
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    throw error;
  }
}

/**
 * Setup Invisible reCAPTCHA verifier for Phone Auth
 */
export function setupRecaptcha(containerId = "recaptcha-container") {
  if (typeof window === "undefined") return null;
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA solved
      },
      "expired-callback": () => {
        if (window.recaptchaVerifier) {
          window.recaptchaVerifier.clear();
          window.recaptchaVerifier = null;
        }
      },
    });
  }
  return window.recaptchaVerifier;
}

/**
 * Send Phone OTP via Firebase
 */
export async function sendFirebasePhoneOtp(formattedPhoneNumber, appVerifier) {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhoneNumber, appVerifier);
    return confirmationResult;
  } catch (error) {
    console.error("Firebase Phone OTP Error:", error);
    throw error;
  }
}

/**
 * Sign out from Firebase
 */
export async function firebaseSignOut() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Firebase Sign-Out Error:", error);
  }
}

export default app;
