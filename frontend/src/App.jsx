import React from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Applications from './pages/Applications'
import Settings from './pages/Settings'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-white text-black'
            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-900 px-6 py-3 flex items-center gap-6">
        <span className="text-lg font-bold text-white mr-4">Job Hunter</span>
        <nav className="flex gap-2">
          <NavItem to="/" label="Dashboard" />
          <NavItem to="/applications" label="Applications" />
          <NavItem to="/settings" label="Settings" />
        </nav>
      </header>
      <main className="flex-1 p-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/applications" element={<Applications />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  )
}
