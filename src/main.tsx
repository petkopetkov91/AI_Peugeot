import React from 'react'
import ReactDOM from 'react-dom/client'
import ChatWindow from './components/ChatWindow.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ChatWindow />
  </React.StrictMode>,
)