import React, { useEffect, useState } from 'react'

const API = '/api'

function formatDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Applications() {
  const [apps, setApps] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    fetch(`${API}/applications`)
      .then(r => r.json())
      .then(data => { setApps(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="text-center text-zinc-500 py-20">Loading...</div>

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-white">Applications</h1>

      {apps.length === 0 ? (
        <div className="text-center text-zinc-500 py-20">
          <p className="text-lg mb-2">No applications yet</p>
          <p className="text-sm">Apply to jobs from the Dashboard</p>
        </div>
      ) : (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500 uppercase">
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Company</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Applied</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {apps.map(app => (
                <React.Fragment key={app.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === app.id ? null : app.id)}
                    className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors cursor-pointer select-none"
                  >
                    <td className="px-4 py-3 text-white font-medium">{app.job?.title || '—'}</td>
                    <td className="px-4 py-3 text-zinc-300">{app.job?.company || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-zinc-800 text-zinc-300">
                        {app.job?.source || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{formatDate(app.applied_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        app.status === 'submitted'
                          ? 'bg-green-950 text-green-400'
                          : app.status === 'error'
                          ? 'bg-red-950 text-red-400'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      {app.job?.url && (
                        <a
                          href={app.job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-zinc-300 hover:text-white underline text-xs transition-colors"
                        >
                          View
                        </a>
                      )}
                    </td>
                  </tr>
                  {expandedId === app.id && (
                    <tr className="border-b border-zinc-800 bg-zinc-900/60">
                      <td colSpan={6} className="px-4 py-4">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">Cover Letter</p>
                        <pre className="text-xs text-zinc-300 whitespace-pre-wrap leading-relaxed font-sans max-h-80 overflow-y-auto">
                          {app.cover_letter || 'No cover letter saved.'}
                        </pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
