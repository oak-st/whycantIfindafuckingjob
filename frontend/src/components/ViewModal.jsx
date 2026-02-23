import React, { useEffect } from 'react'

const stripHtml = (html) => {
  if (!html) return ''
  return html
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^ +/gm, '')
    .trim()
}

export default function JobPanel({ job, onClose, onApply, onStatusChange }) {
  const cleanDesc = job ? stripHtml(job.description) : ''

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  if (!job) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/60" onClick={onClose} />

      {/* Side panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-[#1c2026] border-l border-[#2a3241] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-[#2a3241] shrink-0">
          <div className="space-y-1 flex-1 min-w-0 pr-4">
            <h2 className="text-base font-bold text-white leading-snug">{job.title}</h2>
            <p className="text-sm text-slate-400">
              {job.company}{job.location ? ` · ${job.location}` : ''}
            </p>
            <div className="flex flex-wrap gap-3 pt-0.5 text-xs">
              {job.salary && <span className="text-green-400">{job.salary}</span>}
              {job.posted_date && <span className="text-slate-500">{job.posted_date}</span>}
              {job.relevance_score != null && (
                <span className={`font-medium ${
                  job.relevance_score >= 8 ? 'text-amber-400' :
                  job.relevance_score >= 6 ? 'text-lime-400' : 'text-slate-600'
                }`}>{job.relevance_score}/10 relevance</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white text-xl leading-none shrink-0 mt-0.5 transition-colors"
          >✕</button>
        </div>

        {/* Description */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {cleanDesc ? (
            <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{cleanDesc}</p>
          ) : (
            <p className="text-sm text-slate-500 italic">No description available — open the original posting to view details.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2a3241] flex items-center justify-between gap-4 shrink-0">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-slate-300 hover:text-white underline transition-colors"
          >
            Open original posting
          </a>
          {job.status !== 'applied' && (
            <div className="flex gap-2">
              <button
                onClick={() => { onStatusChange(job.id, 'saved'); onClose() }}
                className="px-4 py-2 text-sm bg-[#252d38] hover:bg-[#2e3845] rounded-lg transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => { onClose(); onApply(job) }}
                className="px-5 py-2 text-sm bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-semibold transition-colors"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
