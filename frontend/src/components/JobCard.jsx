import React from 'react'

const SOURCE_COLORS = {
  glassdoor:   'bg-green-900 text-green-300',
  indeed:      'bg-purple-900 text-purple-300',
  google:      'bg-red-900 text-red-300',
  amazon:      'bg-orange-900 text-orange-300',
  microsoft:   'bg-sky-900 text-sky-300',
  meta:        'bg-blue-950 text-blue-200',
  apple:       'bg-zinc-800 text-zinc-300',
  anthropic:   'bg-rose-900 text-rose-300',
  scale_ai:    'bg-violet-900 text-violet-300',
  xai:         'bg-slate-800 text-slate-300',
  databricks:  'bg-red-950 text-red-300',
  cloudflare:  'bg-orange-950 text-orange-300',
  datadog:     'bg-purple-950 text-purple-300',
  okta:        'bg-sky-950 text-sky-300',
  zscaler:     'bg-blue-800 text-blue-200',
  pure_storage:'bg-teal-900 text-teal-300',
  rubrik:      'bg-cyan-900 text-cyan-300',
  mongodb:     'bg-green-950 text-green-300',
  elastic:     'bg-yellow-900 text-yellow-300',
  twilio:      'bg-red-800 text-red-200',
  mistral_ai:  'bg-indigo-900 text-indigo-300',
  netflix:     'bg-red-700 text-red-100',
  nvidia:      'bg-green-700 text-green-100',
  crowdstrike: 'bg-orange-800 text-orange-200',
  riot_games:  'bg-rose-800 text-rose-200',
  epic_games:  'bg-blue-700 text-blue-100',
  bungie:      'bg-gray-700 text-gray-200',
  discord:     'bg-violet-800 text-violet-200',
  roblox:      'bg-red-900 text-red-200',
  fanduel:     'bg-blue-800 text-blue-200',
  snowflake:   'bg-cyan-800 text-cyan-200',
}

const sourceLabel = (src) =>
  src.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

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

const crawledAgo = (iso) => {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7)   return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function JobCard({
  job, onStatusChange, onApply, onView,
  isNew = false, compact = false,
  selected, onSelect, hidden = false,
}) {
  const cleanDesc = stripHtml(job.description)
  const badge = SOURCE_COLORS[job.source] || 'bg-gray-800 text-gray-300'
  const statusColors = {
    new:     'border-gray-700',
    saved:   'border-indigo-700',
    skipped: 'border-gray-800 opacity-50',
    applied: 'border-green-700',
    denied:  'border-red-900 opacity-40',
  }

  if ((job.status === 'skipped' || job.status === 'denied') && !hidden) return null

  // ── Hidden card ─────────────────────────────────────────────────────────────
  if (hidden) {
    if (compact) {
      return (
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5 flex items-center gap-3 opacity-50 hover:opacity-80 transition-opacity">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>
            {sourceLabel(job.source)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
            job.status === 'denied' ? 'bg-red-950 text-red-400' : 'bg-gray-800 text-gray-500'
          }`}>{job.status}</span>
          <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{job.title}</span>
          <span className="text-xs text-gray-400 shrink-0 hidden sm:block">{job.company}</span>
          {onView && (
            <button onClick={() => onView(job)}
              className="shrink-0 text-xs text-gray-400 hover:text-gray-200 transition-colors">
              View
            </button>
          )}
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-gray-500 hover:text-gray-300 text-sm">↗</a>
          <button
            onClick={() => onStatusChange(job.id, 'new')}
            className="shrink-0 px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors"
          >Undo</button>
        </div>
      )
    }
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3 opacity-50 hover:opacity-80 transition-opacity">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
                {sourceLabel(job.source)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                job.status === 'denied' ? 'bg-red-950 text-red-400' : 'bg-gray-800 text-gray-500'
              }`}>{job.status}</span>
            </div>
            <h3 className="text-sm font-semibold text-white mt-1 leading-snug">{job.title}</h3>
            <p className="text-xs text-gray-400">{job.company}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onView && (
              <button onClick={() => onView(job)}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline">
                View
              </button>
            )}
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-300 text-sm">↗</a>
          </div>
        </div>
        <button
          onClick={() => onStatusChange(job.id, 'new')}
          className="w-full py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors"
        >
          Undo
        </button>
      </div>
    )
  }

  // ── Compact (list) mode ──────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className={`
        bg-gray-900 border rounded-xl px-4 py-3 flex items-center gap-3 transition-all
        ${statusColors[job.status] || 'border-gray-700'}
        ${selected ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-gray-950' : ''}
      `}>
        {onSelect && job.status !== 'applied' && (
          <input
            type="checkbox"
            checked={selected || false}
            onChange={() => onSelect(job.id)}
            onClick={e => e.stopPropagation()}
            className="w-4 h-4 shrink-0 rounded accent-indigo-500 cursor-pointer"
          />
        )}

        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>
          {sourceLabel(job.source)}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{job.title}</span>
            {isNew && job.status === 'new' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold shrink-0">NEW</span>
            )}
            {job.status === 'saved' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-300 font-medium shrink-0">Saved</span>
            )}
            {job.status === 'applied' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-medium shrink-0">Applied</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="shrink-0">{job.company}</span>
            {job.location && <span className="shrink-0 truncate">· {job.location}</span>}
            {job.salary && <span className="text-green-400 shrink-0">{job.salary}</span>}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-2 shrink-0">
          {job.relevance_score >= 8 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">▲ Top</span>
          )}
          {job.relevance_score != null && (
            <span className={`text-xs font-medium w-8 text-right ${
              job.relevance_score >= 8 ? 'text-amber-400' :
              job.relevance_score >= 6 ? 'text-lime-400' : 'text-gray-600'
            }`}>{job.relevance_score}/10</span>
          )}
        </div>

        {job.crawled_at && (
          <span className="hidden xl:block text-xs text-gray-500 shrink-0 w-20 text-right">
            {crawledAgo(job.crawled_at)}
          </span>
        )}

        {job.status !== 'applied' ? (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onView && onView(job)}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors">View</button>
            <button onClick={() => onStatusChange(job.id, 'saved')}
              className="px-2.5 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors">Save</button>
            <button onClick={() => onStatusChange(job.id, 'denied')}
              className="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-colors">Deny</button>
            <button onClick={() => onApply(job)}
              className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold transition-colors">Apply</button>
          </div>
        ) : null}

        <a href={job.url} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-gray-500 hover:text-gray-300 text-sm" title="Open original posting">↗</a>
      </div>
    )
  }

  // ── Normal (grid) card ───────────────────────────────────────────────────────
  return (
    <div className={`
      bg-gray-900 border rounded-xl p-4 space-y-3 transition-all
      ${statusColors[job.status] || 'border-gray-700'}
      ${selected ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-gray-950' : ''}
    `}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          {onSelect && job.status !== 'applied' && (
            <input
              type="checkbox"
              checked={selected || false}
              onChange={() => onSelect(job.id)}
              onClick={e => e.stopPropagation()}
              className="mt-1 w-4 h-4 shrink-0 rounded accent-indigo-500 cursor-pointer"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
                {sourceLabel(job.source)}
              </span>
              {isNew && job.status === 'new' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-600 text-white font-bold">NEW</span>
              )}
              {job.relevance_score >= 8 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  ▲ Top Match
                </span>
              )}
              {job.relevance_score >= 6 && job.relevance_score < 8 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-lime-500/10 text-lime-400 border border-lime-500/20">
                  Good Match
                </span>
              )}
              {job.status === 'applied' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-medium">Applied</span>
              )}
              {job.status === 'saved' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-300 font-medium">Saved</span>
              )}
            </div>
            <h3 className="text-base font-semibold text-white mt-1 leading-snug">{job.title}</h3>
            <p className="text-sm text-gray-400">{job.company}</p>
          </div>
        </div>

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-gray-500 hover:text-gray-300 text-sm leading-none"
          title="Open original posting"
        >↗</a>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        {job.location && <span>{job.location}</span>}
        {job.salary && <span className="text-green-400">{job.salary}</span>}
        {job.posted_date && <span>{job.posted_date}</span>}
        {job.relevance_score != null && (
          <span className={`font-medium ${
            job.relevance_score >= 8 ? 'text-amber-400' :
            job.relevance_score >= 6 ? 'text-lime-400' : 'text-gray-600'
          }`}>
            {job.relevance_score}/10
          </span>
        )}
        {job.crawled_at && (
          <span className="text-gray-500 ml-auto">{crawledAgo(job.crawled_at)}</span>
        )}
      </div>

      {cleanDesc && (
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
          {cleanDesc}
        </p>
      )}

      {job.status !== 'applied' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApply(job)}
            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold transition-colors"
          >Apply</button>
          <button
            onClick={() => onView && onView(job)}
            className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors"
          >View</button>
          <button
            onClick={() => onStatusChange(job.id, 'saved')}
            className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors"
          >Save</button>
          <button
            onClick={() => onStatusChange(job.id, 'denied')}
            className="flex-1 py-1.5 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-colors"
            title="Deny: permanently removes this job and blocks it from reappearing"
          >Deny</button>
        </div>
      )}
    </div>
  )
}
