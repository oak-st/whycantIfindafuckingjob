import React, { useEffect, useState } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import Insights from './pages/Insights'
import Settings from './pages/Settings'
import Login from './pages/Login'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-blue-500 text-white'
            : 'text-slate-400 hover:text-slate-100 hover:bg-[#252d38]'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) { setChecking(false); return }
    fetch('/api/auth/me')
      .then(r => { if (r.ok) setAuthed(true) })
      .catch(() => {})
      .finally(() => setChecking(false))
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('auth_token')
    setAuthed(false)
  }

  if (checking) return null

  if (!authed) return <Login onLogin={() => setAuthed(true)} />

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[#2a3241] px-6 py-3 flex items-center gap-6 bg-[#1c2026]">
        <span className="text-lg font-bold text-slate-100 mr-4">Job Hunter</span>
        <nav className="flex gap-2 flex-1">
          <NavItem to="/" label="Dashboard" />
          <NavItem to="/applications" label="Applications" />
          <NavItem to="/insights" label="Insights" />
          <NavItem to="/settings" label="Settings" />
        </nav>
        <button
          onClick={handleLogout}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-3 py-1.5
                     rounded-lg hover:bg-[#252d38]"
        >
          Sign out
        </button>
      </header>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
