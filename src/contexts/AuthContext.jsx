import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../config/firebase';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Listen to Firebase auth state changes (persists across refreshes)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Fetch extra profile data from Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
          ...userDoc.data(),
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Save user profile to Firestore (called on first sign-up)
  async function saveUserProfile(firebaseUser, extraData = {}) {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const existing = await getDoc(userRef);

    if (!existing.exists()) {
      await setDoc(userRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || extraData.displayName || '',
        photoURL: firebaseUser.photoURL || '',
        createdAt: serverTimestamp(),
        ...extraData,
      });
    }
  }

  // Email/Password Sign Up
  async function signup(email, password, displayName) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    // Set display name on the Firebase user
    await updateProfile(result.user, { displayName });
    // Store profile in Firestore
    await saveUserProfile(result.user, { displayName });
    return result.user;
  }

  // Email/Password Login
  async function login(email, password) {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  }

  // Google Sign-In
  async function loginWithGoogle() {
    const result = await signInWithPopup(auth, googleProvider);
    // Store profile in Firestore (only on first sign-in)
    await saveUserProfile(result.user);
    return result.user;
  }

  // Sign Out
  async function logout() {
    await signOut(auth);
    setUser(null);
  }

  const value = {
    user,
    loading,
    signup,
    login,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
