import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import Login from './components/Login';
import MapPage from './components/MapPage';
import "./App.css";

const firebaseConfig = {
  apiKey: "AIzaSyBJM9jjJyY9hPHGinBHZWECoGLBe15ZFA8",
  authDomain: "authenticated-map-app-90b0b.firebaseapp.com",
  projectId: "authenticated-map-app-90b0b",
  storageBucket: "authenticated-map-app-90b0b.appspot.com",
  messagingSenderId: "147758084976",
  appId: "1:147758084976:web:68997d7b2acccb310895b5"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

function App() {
  const [user, setUser] = useState(undefined); // initially undefined means "checking auth"

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged(currentUser => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  if (user === undefined) {
    return <p style={{ textAlign: 'center' }}>Loading...</p>;
  }

  return (
    <Routes>
      <Route path="/login" element={!user ? <Login /> : <Navigate to="/map" />} />
      <Route path="/map" element={user ? <MapPage /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={user ? "/map" : "/login"} />} />
    </Routes>
  );
}

export default App;
