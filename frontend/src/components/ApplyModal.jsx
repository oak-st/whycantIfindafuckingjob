import React, { useEffect, useState, useRef } from 'react'

const stripHtml = (html) => {
  if (!html) return ''
  let text = html
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^ +/gm, '')
  return text.trim()
}

const API = '/api'

const ATS_LABELS = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  workday: 'Workday',
  smartrecruiters: 'SmartRecruiters',
  unknown: 'Unknown ATS',
}

export default function ApplyModal({ job, onClose, onSubmitted }) {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Auto-fill state
  const [fillStatus, setFillStatus] = useState('idle') // idle | starting | filling | filled | error
  const [fillMessage, setFillMessage] = useState('')
  const [fillAts, setFillAts] = useState('')
  const pollRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`${API}/apply/${job.id}`, { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to generate draft')
        return r.json()
      })
      .then(data => { setDraft(data); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [job.id])

  // Clean up polling on unmount
  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const startPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/apply/${job.id}/automate/status`)
        const data = await res.json()
        setFillStatus(data.status === 'idle' ? 'idle' : data.status)
        setFillMessage(data.message || '')
        setFillAts(data.ats || fillAts)
        if (data.status === 'filled' || data.status === 'error' || data.status === 'idle') {
          clearInterval(pollRef.current)
        }
      } catch { /* ignore */ }
    }, 1500)
  }

  const handleAutoFill = async () => {
    if (!draft) return
    setFillStatus('starting')
    setFillMessage('Starting browser...')
    setError('')
    if (pollRef.current) clearInterval(pollRef.current)
    try {
      const res = await fetch(`${API}/apply/${job.id}/automate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cover_letter: draft.cover_letter,
          custom_answers: draft.custom_answers,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setFillAts(data.ats || '')
      setFillStatus('filling')
      startPoll()
    } catch (e) {
      setError(e.message)
      setFillStatus('idle')
    }
  }

  const handleMarkApplied = async () => {
    setSubmitting(true)
    try {
      await fetch(`${API}/apply/${job.id}/automate/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cover_letter: draft?.cover_letter || '',
          custom_answers: draft?.custom_answers || {},
        }),
      })
      if (pollRef.current) clearInterval(pollRef.current)
      onSubmitted(job.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API}/apply/${job.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cover_letter: draft.cover_letter,
          custom_answers: draft.custom_answers,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSubmitted(job.id)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const isFilling = fillStatus === 'starting' || fillStatus === 'filling'
  const isFilled = fillStatus === 'filled'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#1c2026] border border-[#2a3241] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3241]">
          <div>
            <h2 className="text-base font-bold text-white">{job.title}</h2>
            <p className="text-sm text-slate-400">{job.company} · {job.location}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex gap-0">
          {/* Job description */}
          <div className="w-1/2 border-r border-[#2a3241] p-5 overflow-y-auto">
            <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Job Description</h3>
            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed">{stripHtml(job.description) || 'No description available.'}</p>
          </div>

          {/* Cover letter + answers */}
          <div className="w-1/2 p-5 overflow-y-auto space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="animate-spin">⟳</span> Generating cover letter with AI...
              </div>
            )}

            {!loading && draft && (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-2">Cover Letter</h3>
                  <textarea
                    value={draft.cover_letter}
                    onChange={e => setDraft(d => ({ ...d, cover_letter: e.target.value }))}
                    rows={10}
                    placeholder="Cover letter will appear here. You can edit it before submitting."
                    className="w-full bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-xs text-slate-100
                               placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none leading-relaxed"
                  />
                </div>

                {Object.keys(draft.custom_answers).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-500 uppercase">Custom Questions</h3>
                    {Object.entries(draft.custom_answers).map(([q, a]) => (
                      <div key={q}>
                        <p className="text-xs text-slate-400 mb-1">{q}</p>
                        <textarea
                          value={a}
                          onChange={e => setDraft(d => ({
                            ...d,
                            custom_answers: { ...d.custom_answers, [q]: e.target.value }
                          }))}
                          rows={3}
                          className="w-full bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-xs
                                     text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/30 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Auto-fill status */}
            {(isFilling || isFilled || fillStatus === 'error') && (
              <div className={`rounded-lg px-4 py-3 text-xs border ${
                isFilled ? 'bg-green-950/40 border-green-800 text-green-300'
                : fillStatus === 'error' ? 'bg-red-950 border-red-900 text-red-300'
                : 'bg-[#252d38] border-[#334155] text-slate-300'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isFilling && <span className="animate-spin">⟳</span>}
                    {isFilled && <span>✓</span>}
                    {fillStatus === 'error' && <span>✕</span>}
                    <span>
                      {fillAts && <span className="font-semibold mr-1">{ATS_LABELS[fillAts] || fillAts}:</span>}
                      {fillMessage}
                    </span>
                  </div>
                  {fillStatus === 'error' && (
                    <button
                      onClick={() => { setFillStatus('idle'); setFillMessage('') }}
                      className="shrink-0 px-2 py-1 rounded bg-red-900 hover:bg-red-800 text-red-200 transition-colors"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-950 border border-red-900 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a3241] flex items-center justify-between gap-4">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-300 hover:text-white underline transition-colors"
          >
            Open original posting
          </a>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-[#252d38] hover:bg-[#2e3845] rounded-lg transition-colors"
            >
              Cancel
            </button>

            {isFilled ? (
              <button
                onClick={handleMarkApplied}
                disabled={submitting}
                className="px-5 py-2 text-sm bg-green-600 hover:bg-green-500 text-white disabled:opacity-40
                           rounded-lg font-semibold transition-colors"
              >
                {submitting ? 'Saving...' : 'Mark as Applied'}
              </button>
            ) : (
              <>
                <button
                  onClick={handleAutoFill}
                  disabled={isFilling || loading || !draft}
                  className="px-5 py-2 text-sm bg-blue-500 hover:bg-blue-400 text-white disabled:opacity-40
                             rounded-lg font-semibold transition-colors"
                >
                  {isFilling ? 'Filling form...' : 'Auto-fill Application'}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || loading || !draft || isFilling}
                  className="px-5 py-2 text-sm bg-[#252d38] hover:bg-[#2e3845] text-slate-300 disabled:opacity-40
                             rounded-lg font-semibold transition-colors"
                  title="Mark as applied without automation"
                >
                  {submitting ? 'Saving...' : 'Manual'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
