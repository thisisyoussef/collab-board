import { useEffect, useState } from 'react'
import { auth, db } from './lib/firebase'
import { getAblyClient } from './lib/ably'
import './App.css'

function App() {
  const [status, setStatus] = useState({
    firebase: false,
    ably: false,
    ablyConnected: false,
  })

  useEffect(() => {
    // Test Firebase
    const firebaseOk = !!auth && !!db
    
    // Test Ably
    let ablyOk = false
    let ablyConnected = false
    
    try {
      const ably = getAblyClient()
      ablyOk = !!ably
      
      ably.connection.on('connected', () => {
        setStatus(prev => ({ ...prev, ablyConnected: true }))
        console.log('✓ Ably connected:', ably.connection.id)
      })
      
      ably.connection.on('failed', (error) => {
        console.error('✗ Ably connection failed:', error)
      })
    } catch (error) {
      console.error('✗ Ably initialization failed:', error)
    }
    
    setStatus({
      firebase: firebaseOk,
      ably: ablyOk,
      ablyConnected,
    })
  }, [])

  return (
    <div className="app">
      <h1>CollabBoard</h1>
      <p>Real-time collaborative whiteboard</p>
      
      <div style={{ marginTop: '2rem', fontSize: '0.9rem', color: '#666' }}>
        <div>
          {status.firebase ? '✅' : '❌'} Firebase (Auth + Firestore)
        </div>
        <div>
          {status.ably ? '✅' : '❌'} Ably initialized
        </div>
        <div>
          {status.ablyConnected ? '✅' : '⏳'} Ably connected
        </div>
      </div>
    </div>
  )
}

export default App
