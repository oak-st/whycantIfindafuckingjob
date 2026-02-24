import React, { useState } from 'react'

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Invalid username or password')
      const data = await res.json()
      localStorage.setItem('auth_token', data.token)
      onLogin()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#151920]">
      <div className="w-full max-w-sm px-4">
        <div className="bg-[#1c2026] border border-[#2a3241] rounded-2xl p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-white mb-1">Job Hunter</h1>
          <p className="text-sm text-slate-400 mb-6">Sign in to continue</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin"
                autoFocus
                className="w-full bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm
                           text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="••••••••"
                className="w-full bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm
                           text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !form.username || !form.password}
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-40
                         rounded-xl font-semibold text-sm transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
