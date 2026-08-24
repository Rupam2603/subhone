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
    console.error("Google Sign-In Error Code:", error.code, error.message);
    if (error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request") {
      const err = new Error("Sign-in window was closed. Click again when you are ready.");
      err.code = error.code;
      throw err;
    } else if (error.code === "auth/operation-not-allowed") {
      const err = new Error(
        "Google Sign-In is not enabled yet in your Firebase Console. Please visit Firebase Console > Authentication > Sign-in method and enable Google."
      );
      err.code = error.code;
      throw err;
    } else if (error.code === "auth/unauthorized-domain") {
      const err = new Error(
        "This domain is not authorized in Firebase. Please add 'localhost' to Authorized Domains in Firebase Console > Authentication > Settings > Authorized domains."
      );
      err.code = error.code;
      throw err;
    } else if (error.code === "auth/popup-blocked") {
      const err = new Error("Google sign-in pop-up was blocked by your browser. Please allow pop-ups for localhost and try again.");
      err.code = error.code;
      throw err;
    }
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
