import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

// Attach auth token to all /api/ requests and handle 401s globally
const _origFetch = window.fetch.bind(window)
window.fetch = async (url, options = {}) => {
  const token = localStorage.getItem('auth_token')
  if (token && typeof url === 'string' && url.startsWith('/api/') && url !== '/api/auth/login') {
    options = { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } }
  }
  const res = await _origFetch(url, options)
  if (res.status === 401 && typeof url === 'string' && url.startsWith('/api/') && url !== '/api/auth/login') {
    localStorage.removeItem('auth_token')
    window.location.reload()
  }
  return res
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)
