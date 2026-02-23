import React, { useEffect, useState } from 'react'

const API = '/api'

const sourceLabel = (src) =>
  src.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

const SOURCE_COLORS = {
  glassdoor:   'bg-green-950 text-green-400',
  google:      'bg-red-950 text-red-400',
  amazon:      'bg-orange-950 text-orange-400',
  microsoft:   'bg-sky-950 text-sky-400',
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
  openai:      'bg-[#252d38] text-slate-300',
  coinbase:    'bg-blue-950 text-blue-300',
  robinhood:   'bg-green-950 text-green-400',
  stripe:      'bg-violet-950 text-violet-400',
  airbnb:      'bg-rose-950 text-rose-400',
  lyft:        'bg-pink-950 text-pink-400',
  reddit:      'bg-orange-950 text-orange-400',
  palantir:    'bg-[#252d38] text-slate-300',
  figma:       'bg-purple-950 text-purple-400',
  zoom:        'bg-blue-950 text-blue-300',
}

const SORT_KEYS = ['avg_score', 'total', 'saved', 'applied', 'denied']

const scoreColor = (score) => {
  if (score == null) return 'text-slate-600'
  if (score >= 8) return 'text-amber-400'
  if (score >= 6) return 'text-lime-400'
  return 'text-slate-500'
}

const ScoreBar = ({ score }) => {
  if (score == null) return <span className="text-slate-600 text-xs">—</span>
  const pct = Math.round((score / 10) * 100)
  const color = score >= 8 ? 'bg-amber-400' : score >= 6 ? 'bg-lime-400' : 'bg-slate-600'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-[#252d38] rounded-full h-1.5 shrink-0">
        <div className={`${color} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-medium ${scoreColor(score)}`}>{score}</span>
    </div>
  )
}

export default function Insights() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState('avg_score')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    fetch(`${API}/stats/sources`)
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? -1
    const bv = b[sortKey] ?? -1
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const SortIcon = ({ k }) => {
    if (k !== sortKey) return <span className="text-slate-700 ml-1">↕</span>
    return <span className="text-blue-400 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>
  }

  const thCls = (k) =>
    `px-4 py-3 font-medium cursor-pointer select-none hover:text-slate-200 transition-colors ${
      sortKey === k ? 'text-slate-200' : 'text-slate-500'
    }`

  if (loading) return <div className="text-center text-slate-500 py-20">Loading...</div>

  const totals = rows.reduce((acc, r) => {
    acc.total  += r.total
    acc.saved  += r.saved
    acc.applied+= r.applied
    acc.denied += r.denied
    return acc
  }, { total: 0, saved: 0, applied: 0, denied: 0 })

  const allScores = rows.flatMap(r => r.avg_score != null ? [r.avg_score] : [])
  const overallAvg = allScores.length
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10
    : null

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-white">Source Performance</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Sources',     value: rows.length,      color: 'text-slate-200' },
          { label: 'Total Jobs',  value: totals.total,     color: 'text-slate-200' },
          { label: 'Saved',       value: totals.saved,     color: 'text-blue-400' },
          { label: 'Applied',     value: totals.applied,   color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-[#1c2026] border border-[#2a3241] rounded-xl px-4 py-3">
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="text-center text-slate-500 py-20">
          <p className="text-lg mb-1">No data yet</p>
          <p className="text-sm">Run a crawl first to see source stats</p>
        </div>
      ) : (
        <div className="bg-[#1c2026] border border-[#2a3241] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2a3241] text-left text-xs uppercase">
                <th className="px-4 py-3 font-medium text-slate-500">Source</th>
                <th className={thCls('avg_score')} onClick={() => handleSort('avg_score')}>
                  Avg Score <SortIcon k="avg_score" />
                </th>
                <th className={thCls('total')} onClick={() => handleSort('total')}>
                  Crawled <SortIcon k="total" />
                </th>
                <th className={thCls('saved')} onClick={() => handleSort('saved')}>
                  Saved <SortIcon k="saved" />
                </th>
                <th className={thCls('applied')} onClick={() => handleSort('applied')}>
                  Applied <SortIcon k="applied" />
                </th>
                <th className={thCls('denied')} onClick={() => handleSort('denied')}>
                  Denied <SortIcon k="denied" />
                </th>
                <th className="px-4 py-3 font-medium text-slate-500">Deny Rate</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(row => {
                const denyRate = row.total > 0 ? Math.round((row.denied / row.total) * 100) : 0
                const badge = SOURCE_COLORS[row.source] || 'bg-[#252d38] text-slate-300'
                return (
                  <tr key={row.source} className="border-b border-[#2a3241] last:border-0 hover:bg-[#252d38]/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
                        {sourceLabel(row.source)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar score={row.avg_score} />
                    </td>
                    <td className="px-4 py-3 text-slate-300 tabular-nums">{row.total}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={row.saved > 0 ? 'text-blue-400 font-medium' : 'text-slate-600'}>{row.saved}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={row.applied > 0 ? 'text-green-400 font-medium' : 'text-slate-600'}>{row.applied}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className={row.denied > 0 ? 'text-red-400' : 'text-slate-600'}>{row.denied}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#252d38] rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${denyRate > 50 ? 'bg-red-500' : denyRate > 25 ? 'bg-orange-500' : 'bg-slate-600'}`}
                            style={{ width: `${denyRate}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums">{denyRate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {rows.length > 1 && (
              <tfoot>
                <tr className="border-t border-[#334155] bg-[#252d38]/30">
                  <td className="px-4 py-3 text-xs text-slate-500 font-medium uppercase">Totals</td>
                  <td className="px-4 py-3">
                    {overallAvg != null && <ScoreBar score={overallAvg} />}
                  </td>
                  <td className="px-4 py-3 text-slate-300 font-medium tabular-nums">{totals.total}</td>
                  <td className="px-4 py-3 text-blue-400 font-medium tabular-nums">{totals.saved}</td>
                  <td className="px-4 py-3 text-green-400 font-medium tabular-nums">{totals.applied}</td>
                  <td className="px-4 py-3 text-red-400 font-medium tabular-nums">{totals.denied}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                    {totals.total > 0 ? Math.round((totals.denied / totals.total) * 100) : 0}%
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}
