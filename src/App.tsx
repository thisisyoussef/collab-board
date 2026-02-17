import { useEffect } from 'react'
import { auth, db } from './lib/firebase'
import './App.css'

function App() {
  useEffect(() => {
    // Test Firebase initialization
    console.log('Firebase Auth initialized:', !!auth)
    console.log('Firestore initialized:', !!db)
    console.log('Project ID:', import.meta.env.VITE_FIREBASE_PROJECT_ID)
  }, [])

  return (
    <div className="app">
      <h1>CollabBoard</h1>
      <p>Real-time collaborative whiteboard</p>
      <p style={{ fontSize: '0.9rem', color: '#666' }}>
        ✓ Firebase configured
      </p>
    </div>
  )
}

export default App
