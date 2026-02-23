import React, { useEffect, useState } from 'react'

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

export default function ApplyModal({ job, onClose, onSubmitted }) {
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    fetch(`${API}/apply/${job.id}`, { method: 'POST' })
      .then(r => {
        if (!r.ok) throw new Error('Failed to generate draft')
        return r.json()
      })
      .then(data => {
        setDraft(data)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [job.id])

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-bold text-white">{job.title}</h2>
            <p className="text-sm text-gray-400">{job.company} · {job.location}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex gap-0">
          {/* Job description */}
          <div className="w-1/2 border-r border-gray-800 p-5 overflow-y-auto">
            <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Job Description</h3>
            <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{stripHtml(job.description) || 'No description available.'}</p>
          </div>

          {/* Cover letter + answers */}
          <div className="w-1/2 p-5 overflow-y-auto space-y-4">
            {loading && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <span className="animate-spin">⟳</span> Generating cover letter with AI...
              </div>
            )}

            {!loading && draft && (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Cover Letter</h3>
                  <textarea
                    value={draft.cover_letter}
                    onChange={e => setDraft(d => ({ ...d, cover_letter: e.target.value }))}
                    rows={10}
                    placeholder="Cover letter will appear here. You can edit it before submitting."
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-100
                               placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
                  />
                </div>

                {Object.keys(draft.custom_answers).length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase">Custom Questions</h3>
                    {Object.entries(draft.custom_answers).map(([q, a]) => (
                      <div key={q}>
                        <p className="text-xs text-gray-400 mb-1">{q}</p>
                        <textarea
                          value={a}
                          onChange={e => setDraft(d => ({
                            ...d,
                            custom_answers: { ...d.custom_answers, [q]: e.target.value }
                          }))}
                          rows={3}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs
                                     text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-xs text-red-400 bg-red-950 border border-red-800 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-4">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 underline"
          >
            Open original posting
          </a>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || loading || !draft}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                         rounded-lg font-semibold transition-colors"
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
