import React from 'react'

const SOURCE_COLORS = {
  glassdoor:   'bg-green-950 text-green-400',
  indeed:      'bg-purple-950 text-purple-400',
  google:      'bg-red-950 text-red-400',
  amazon:      'bg-orange-950 text-orange-400',
  microsoft:   'bg-sky-950 text-sky-400',
  meta:        'bg-blue-950 text-blue-300',
  apple:       'bg-[#252d38] text-slate-300',
  anthropic:   'bg-rose-950 text-rose-400',
  scale_ai:    'bg-violet-950 text-violet-400',
  xai:         'bg-[#252d38] text-slate-300',
  databricks:  'bg-red-950 text-red-400',
  cloudflare:  'bg-orange-950 text-orange-400',
  datadog:     'bg-purple-950 text-purple-400',
  okta:        'bg-sky-950 text-sky-400',
  zscaler:     'bg-blue-950 text-blue-300',
  pure_storage:'bg-teal-950 text-teal-400',
  rubrik:      'bg-cyan-950 text-cyan-400',
  mongodb:     'bg-green-950 text-green-400',
  elastic:     'bg-yellow-950 text-yellow-400',
  twilio:      'bg-red-950 text-red-400',
  mistral_ai:  'bg-indigo-950 text-indigo-400',
  netflix:     'bg-red-950 text-red-400',
  nvidia:      'bg-green-950 text-green-400',
  crowdstrike: 'bg-orange-950 text-orange-400',
  riot_games:  'bg-rose-950 text-rose-400',
  epic_games:  'bg-blue-950 text-blue-300',
  bungie:      'bg-[#252d38] text-slate-300',
  discord:     'bg-violet-950 text-violet-400',
  roblox:      'bg-red-950 text-red-400',
  fanduel:     'bg-blue-950 text-blue-300',
  snowflake:   'bg-cyan-950 text-cyan-400',
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

const sp = (fn) => (e) => { e.stopPropagation(); fn(e) }

export default function JobCard({
  job, onStatusChange, onApply, onView,
  isNew = false, compact = false,
  selected, onSelect, hidden = false,
}) {
  const cleanDesc = stripHtml(job.description)
  const badge = SOURCE_COLORS[job.source] || 'bg-[#252d38] text-slate-300'
  const selectable = !!onSelect && job.status !== 'applied'
  const statusColors = {
    new:     'border-[#2a3241]',
    saved:   'border-[#4a5a6a]',
    skipped: 'border-[#1e2530] opacity-50',
    applied: 'border-green-800',
    denied:  'border-red-900 opacity-40',
  }

  if ((job.status === 'skipped' || job.status === 'denied') && !hidden) return null

  // ── Hidden card ─────────────────────────────────────────────────────────────
  if (hidden) {
    if (compact) {
      return (
        <div className="bg-[#1c2026] border border-[#2a3241] rounded-xl px-4 py-2.5 flex items-center gap-3 opacity-50 hover:opacity-80 transition-opacity">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>
            {sourceLabel(job.source)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
            job.status === 'denied' ? 'bg-red-950 text-red-400' : 'bg-[#252d38] text-slate-500'
          }`}>{job.status}</span>
          <span className="flex-1 min-w-0 text-sm font-semibold text-white truncate">{job.title}</span>
          <span className="text-xs text-slate-400 shrink-0 hidden sm:block">{job.company}</span>
          {onView && (
            <button onClick={() => onView(job)}
              className="shrink-0 text-xs text-slate-400 hover:text-white transition-colors">
              View
            </button>
          )}
          <a href={job.url} target="_blank" rel="noopener noreferrer"
            className="shrink-0 text-slate-500 hover:text-slate-300 text-sm">↗</a>
          <button
            onClick={() => onStatusChange(job.id, 'new')}
            className="shrink-0 px-2.5 py-1 bg-[#252d38] hover:bg-[#2e3845] rounded-lg text-xs font-semibold transition-colors"
          >Undo</button>
        </div>
      )
    }
    return (
      <div className="bg-[#1c2026] border border-[#2a3241] rounded-xl p-4 space-y-3 opacity-50 hover:opacity-80 transition-opacity">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
                {sourceLabel(job.source)}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                job.status === 'denied' ? 'bg-red-950 text-red-400' : 'bg-[#252d38] text-slate-500'
              }`}>{job.status}</span>
            </div>
            <h3 className="text-sm font-semibold text-white mt-1 leading-snug">{job.title}</h3>
            <p className="text-xs text-slate-400">{job.company}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onView && (
              <button onClick={() => onView(job)}
                className="text-xs text-slate-300 hover:text-white underline">
                View
              </button>
            )}
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-300 text-sm">↗</a>
          </div>
        </div>
        <button
          onClick={() => onStatusChange(job.id, 'new')}
          className="w-full py-1.5 bg-[#252d38] hover:bg-[#2e3845] rounded-lg text-xs font-semibold transition-colors"
        >Undo</button>
      </div>
    )
  }

  // ── Compact (list) mode ──────────────────────────────────────────────────────
  if (compact) {
    return (
      <div
        onClick={() => selectable && onSelect(job.id)}
        className={`
          bg-[#1c2026] border rounded-xl px-4 py-3 flex items-center gap-3 transition-all
          ${statusColors[job.status] || 'border-[#2a3241]'}
          ${selected ? 'ring-1 ring-blue-500/50 ring-offset-1 ring-offset-[#121212]' : ''}
          ${selectable ? 'cursor-pointer hover:border-[#334155]' : ''}
        `}
      >
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${badge}`}>
          {sourceLabel(job.source)}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-white truncate">{job.title}</span>
            {isNew && job.status === 'new' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-bold shrink-0">NEW</span>
            )}
            {job.status === 'saved' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#252d38] text-slate-300 font-medium shrink-0">Saved</span>
            )}
            {job.status === 'applied' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-950 text-green-400 font-medium shrink-0">Applied</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
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
              job.relevance_score >= 6 ? 'text-lime-400' : 'text-slate-600'
            }`}>{job.relevance_score}/10</span>
          )}
        </div>

        {job.crawled_at && (
          <span className="hidden xl:block text-xs text-slate-500 shrink-0 w-20 text-right">
            {crawledAgo(job.crawled_at)}
          </span>
        )}

        {job.status !== 'applied' ? (
          <div className="flex gap-1.5 shrink-0">
            <button onClick={sp(() => onView && onView(job))}
              className="px-2.5 py-1 bg-[#252d38] hover:bg-[#2e3845] rounded-lg text-xs font-semibold transition-colors">View</button>
            <button onClick={sp(() => onStatusChange(job.id, 'saved'))}
              className="px-2.5 py-1 bg-[#252d38] hover:bg-[#2e3845] rounded-lg text-xs font-semibold transition-colors">Save</button>
            <button onClick={sp(() => onStatusChange(job.id, 'denied'))}
              className="px-2.5 py-1 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-colors">Deny</button>
            <button onClick={sp(() => onApply(job))}
              className="px-2.5 py-1 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-semibold transition-colors">Apply</button>
          </div>
        ) : null}

        <a href={job.url} target="_blank" rel="noopener noreferrer"
          onClick={sp(() => {})}
          className="shrink-0 text-slate-500 hover:text-slate-300 text-sm" title="Open original posting">↗</a>
      </div>
    )
  }

  // ── Normal (grid) card ───────────────────────────────────────────────────────
  return (
    <div
      onClick={() => selectable && onSelect(job.id)}
      className={`
        bg-[#1c2026] border rounded-xl p-4 space-y-3 transition-all
        ${statusColors[job.status] || 'border-[#2a3241]'}
        ${selected ? 'ring-1 ring-blue-500/50 ring-offset-1 ring-offset-[#121212]' : ''}
        ${selectable ? 'cursor-pointer hover:border-[#334155]' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
              {sourceLabel(job.source)}
            </span>
            {isNew && job.status === 'new' && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-bold">NEW</span>
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
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-950 text-green-400 font-medium">Applied</span>
            )}
            {job.status === 'saved' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#252d38] text-slate-300 font-medium">Saved</span>
            )}
          </div>
          <h3 className="text-base font-semibold text-white mt-1 leading-snug">{job.title}</h3>
          <p className="text-sm text-slate-400">{job.company}</p>
        </div>

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={sp(() => {})}
          className="shrink-0 text-slate-500 hover:text-slate-300 text-sm leading-none"
          title="Open original posting"
        >↗</a>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-slate-400">
        {job.location && <span>{job.location}</span>}
        {job.salary && <span className="text-green-400">{job.salary}</span>}
        {job.posted_date && <span>{job.posted_date}</span>}
        {job.relevance_score != null && (
          <span className={`font-medium ${
            job.relevance_score >= 8 ? 'text-amber-400' :
            job.relevance_score >= 6 ? 'text-lime-400' : 'text-slate-600'
          }`}>
            {job.relevance_score}/10
          </span>
        )}
        {job.crawled_at && (
          <span className="text-slate-500 ml-auto">{crawledAgo(job.crawled_at)}</span>
        )}
      </div>

      {cleanDesc && (
        <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
          {cleanDesc}
        </p>
      )}

      {job.status !== 'applied' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={sp(() => onApply(job))}
            className="flex-1 py-1.5 bg-blue-500 hover:bg-blue-400 text-white rounded-lg text-xs font-semibold transition-colors"
          >Apply</button>
          <button
            onClick={sp(() => onView && onView(job))}
            className="flex-1 py-1.5 bg-[#252d38] hover:bg-[#2e3845] rounded-lg text-xs font-semibold transition-colors"
          >View</button>
          <button
            onClick={sp(() => onStatusChange(job.id, 'saved'))}
            className="flex-1 py-1.5 bg-[#252d38] hover:bg-[#2e3845] rounded-lg text-xs font-semibold transition-colors"
          >Save</button>
          <button
            onClick={sp(() => onStatusChange(job.id, 'denied'))}
            className="flex-1 py-1.5 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-colors"
            title="Deny: permanently removes this job and blocks it from reappearing"
          >Deny</button>
        </div>
      )}
    </div>
  )
}
