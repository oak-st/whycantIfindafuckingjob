import React, { useState } from 'react'

const SOURCE_COLORS = {
  linkedin:    'bg-blue-900 text-blue-300',
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
}

// Pretty-print snake_case source: "scale_ai" → "Scale AI"
const sourceLabel = (src) =>
  src.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

export default function JobCard({ job, onStatusChange, onApply, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false)

  const badge = SOURCE_COLORS[job.source] || 'bg-gray-800 text-gray-300'
  const statusColors = {
    new:     'border-gray-700',
    saved:   'border-indigo-700',
    skipped: 'border-gray-800 opacity-50',
    applied: 'border-green-700',
    denied:  'border-red-900 opacity-40',
  }

  if (job.status === 'skipped' || job.status === 'denied') return null

  return (
    <div className={`
      bg-gray-900 border rounded-xl p-4 space-y-3 transition-all
      ${statusColors[job.status] || 'border-gray-700'}
      ${selected ? 'ring-2 ring-indigo-500 ring-offset-1 ring-offset-gray-950' : ''}
    `}>
      <div className="flex items-start justify-between gap-2">
        {/* Checkbox + meta */}
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
              {job.status === 'applied' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-green-900 text-green-300 font-medium">
                  Applied
                </span>
              )}
              {job.status === 'saved' && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-900 text-indigo-300 font-medium">
                  Saved
                </span>
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
          className="shrink-0 text-xs text-indigo-400 hover:text-indigo-300 underline"
        >
          View
        </a>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        {job.location && <span>{job.location}</span>}
        {job.salary && <span className="text-green-400">{job.salary}</span>}
        {job.posted_date && <span>{job.posted_date}</span>}
      </div>

      {job.description && (
        <div>
          {expanded ? (
            <div className="text-xs text-gray-400 leading-relaxed space-y-1.5 max-h-64 overflow-y-auto pr-1">
              {job.description.split('\n').filter(l => l.trim()).map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
              {job.description.replace(/\n+/g, ' ')}
            </p>
          )}
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs text-indigo-400 hover:text-indigo-300 mt-1"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        </div>
      )}

      {job.status !== 'applied' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onApply(job)}
            className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-semibold transition-colors"
          >
            Apply
          </button>
          <button
            onClick={() => onStatusChange(job.id, 'saved')}
            className="flex-1 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors"
          >
            Save
          </button>
          <button
            onClick={() => onStatusChange(job.id, 'skipped')}
            className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-xs font-semibold transition-colors"
          >
            Skip
          </button>
          <button
            onClick={() => onStatusChange(job.id, 'denied')}
            className="flex-1 py-1.5 bg-red-950 hover:bg-red-900 text-red-400 rounded-lg text-xs font-semibold transition-colors"
            title="Deny: permanently removes this job and blocks it from reappearing"
          >
            Deny
          </button>
        </div>
      )}
    </div>
  )
}
