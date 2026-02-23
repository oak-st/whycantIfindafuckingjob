import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import JobCard from '../components/JobCard'
import ApplyModal from '../components/ApplyModal'
import JobPanel from '../components/ViewModal'

const API = '/api'
const POLL_INTERVAL = 3000

export default function Dashboard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [crawlState, setCrawlState] = useState({ status: 'idle', message: 'Idle', jobs_found: 0 })
  const [filter, setFilter] = useState({ source: 'all', status: 'new', salary_min: '', salary_max: '' })
  const [applyJob, setApplyJob] = useState(null)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [ageFilter, setAgeFilter] = useState('all')
  const [sort, setSort] = useState('date')
  const [showHidden, setShowHidden] = useState(false)
  const [hiddenJobs, setHiddenJobs] = useState([])

  // ── New state ────────────────────────────────────────────────────────────────
  const [panelJob, setPanelJob] = useState(null)
  const [viewMode, setViewMode] = useState('grid')
  const [confirmClear, setConfirmClear] = useState(false)
  const [seenIds, setSeenIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('seenJobIds') || '[]')) }
    catch { return new Set() }
  })

  const markSeen = useCallback((id) => {
    setSeenIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem('seenJobIds', JSON.stringify([...next]))
      return next
    })
  }, [])

  const openPanel = useCallback((job) => {
    setPanelJob(job)
    markSeen(job.id)
  }, [markSeen])

  // Source counts derived from current job list (server-side filtered)
  const sourceCounts = useMemo(() => {
    const counts = {}
    jobs.forEach(j => { counts[j.source] = (counts[j.source] || 0) + 1 })
    return counts
  }, [jobs])

  const srcOpt = (value, label) => {
    const c = sourceCounts[value]
    return c ? `${label} (${c})` : label
  }
  // ────────────────────────────────────────────────────────────────────────────

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filter.source !== 'all') params.set('source', filter.source)
      if (filter.status !== 'all') params.set('status', filter.status)
      if (filter.salary_min !== '') params.set('salary_min', filter.salary_min)
      if (filter.salary_max !== '') params.set('salary_max', filter.salary_max)
      const res = await fetch(`${API}/jobs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch jobs')
      const data = await res.json()
      setJobs(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [filter])

  const fetchCrawlStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API}/crawl/status`)
      const data = await res.json()
      setCrawlState(data)
    } catch {
      // ignore
    }
  }, [])

  const fetchHiddenJobs = useCallback(async () => {
    try {
      const [deniedRes, skippedRes] = await Promise.all([
        fetch(`${API}/jobs?status=denied`),
        fetch(`${API}/jobs?status=skipped`),
      ])
      const denied = await deniedRes.json()
      const skipped = await skippedRes.json()
      setHiddenJobs([...denied, ...skipped])
    } catch {
      // ignore
    }
  }, [])

  const parseSalaryMin = (salaryStr) => {
    if (!salaryStr) return null
    const s = salaryStr.toLowerCase()
    const hourly = s.includes('/hr') || s.includes('per hour') || s.includes('/hour')
    const cleaned = s.replace(/[$€£,]/g, '')
    const nums = cleaned.match(/[\d]+(?:\.\d+)?k?/g)
    if (!nums) return null
    try {
      const values = nums.map(n => n.endsWith('k') ? parseFloat(n) * 1000 : parseFloat(n))
      let annual = Math.min(...values)
      if (hourly) annual *= 2080
      return annual
    } catch {
      return null
    }
  }

  useEffect(() => { fetchJobs() }, [fetchJobs])

  useEffect(() => {
    fetchCrawlStatus()
    const interval = setInterval(() => {
      fetchCrawlStatus()
      if (crawlState.status === 'running') fetchJobs()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchCrawlStatus, crawlState.status, fetchJobs])

  useEffect(() => {
    if (showHidden) fetchHiddenJobs()
    else setHiddenJobs([])
  }, [showHidden, fetchHiddenJobs])

  // Clear selection whenever filters change
  useEffect(() => { setSelectedIds(new Set()) }, [filter, search, ageFilter])

  // ── Client-side filtering (search + age) on top of server-side filters ───────
  const filteredJobs = useMemo(() => {
    let result = jobs

    if (ageFilter !== 'all') {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - parseInt(ageFilter, 10))
      result = result.filter(j => new Date(j.crawled_at) >= cutoff)
    }

    const q = search.trim().toLowerCase()
    if (q) {
      result = result.filter(j =>
        j.title.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.location.toLowerCase().includes(q) ||
        j.description.toLowerCase().includes(q)
      )
    }

    if (sort === 'relevance') {
      result = [...result].sort((a, b) => (b.relevance_score ?? -1) - (a.relevance_score ?? -1))
    } else if (sort === 'company') {
      result = [...result].sort((a, b) => a.company.localeCompare(b.company))
    } else if (sort === 'salary') {
      result = [...result].sort((a, b) => {
        const sa = parseSalaryMin(a.salary) ?? -1
        const sb = parseSalaryMin(b.salary) ?? -1
        return sb - sa
      })
    }
    // 'date' — already sorted by crawled_at desc from the API

    return result
  }, [jobs, search, ageFilter, sort])

  // ── Bulk select helpers ───────────────────────────────────────────────────────
  const selectableJobs = filteredJobs.filter(j => j.status !== 'applied' && j.status !== 'skipped')
  const allSelected = selectableJobs.length > 0 && selectableJobs.every(j => selectedIds.has(j.id))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(selectableJobs.map(j => j.id)))
    }
  }

  const handleToggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBulkAction = async (status) => {
    const ids = [...selectedIds]
    await Promise.all(ids.map(id =>
      fetch(`${API}/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    ))
    setJobs(js => js.map(j => selectedIds.has(j.id) ? { ...j, status } : j))
    setSelectedIds(new Set())
  }

  const startCrawl = async () => {
    setError('')
    try {
      const res = await fetch(`${API}/crawl`, { method: 'POST' })
      const data = await res.json()
      setCrawlState(data)
    } catch (e) {
      setError(e.message)
    }
  }

  const stopCrawl = async () => {
    try {
      await fetch(`${API}/crawl/stop`, { method: 'POST' })
    } catch (e) {
      setError(e.message)
    }
  }

  const dismissAllJobs = async () => {
    try {
      const params = new URLSearchParams()
      if (filter.source !== 'all') params.set('source', filter.source)
      if (filter.status !== 'all') params.set('status', filter.status)
      await fetch(`${API}/jobs/dismiss?${params}`, { method: 'POST' })
      setConfirmClear(false)
      fetchJobs()
    } catch (e) {
      setError(e.message)
      setConfirmClear(false)
    }
  }

  const handleStatusChange = async (jobId, status) => {
    try {
      await fetch(`${API}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setJobs(js => js.map(j => j.id === jobId ? { ...j, status } : j))
      setPanelJob(prev => prev?.id === jobId ? { ...prev, status } : prev)
      if (hiddenJobs.some(j => j.id === jobId)) {
        setHiddenJobs(hj => hj.filter(j => j.id !== jobId))
        fetchJobs()
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSubmitted = (jobId) => {
    setJobs(js => js.map(j => j.id === jobId ? { ...j, status: 'applied' } : j))
    setPanelJob(prev => prev?.id === jobId ? { ...prev, status: 'applied' } : prev)
    setApplyJob(null)
  }

  const logRef = useRef(null)
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [crawlState.log, crawlState.current_source])

  const isCrawling = crawlState.status === 'running'
  const visibleCount = filteredJobs.filter(j => j.status !== 'skipped').length

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Job Feed</h1>
          {isCrawling && (
            <p className="text-sm text-zinc-300 mt-0.5">
              <span className="inline-block animate-spin mr-1">⟳</span>
              {crawlState.message} ({crawlState.jobs_found} new)
            </p>
          )}
          {!isCrawling && crawlState.message !== 'Idle' && (
            <p className="text-sm text-zinc-400 mt-0.5">{crawlState.message}</p>
          )}
          {!isCrawling && crawlState.next_crawl_at && (
            <p className="text-sm text-zinc-500 mt-0.5">
              Next auto-crawl: {new Date(crawlState.next_crawl_at).toLocaleString()}
            </p>
          )}
        </div>
        <div className="flex gap-2 items-center">
          {isCrawling && (
            <button
              onClick={stopCrawl}
              className="px-5 py-2 bg-red-900 hover:bg-red-800 text-red-300 rounded-xl text-sm font-semibold transition-colors"
            >
              Stop
            </button>
          )}
          <button
            onClick={startCrawl}
            disabled={isCrawling}
            className="px-5 py-2 bg-white hover:bg-zinc-200 text-black disabled:opacity-50
                       rounded-xl text-sm font-semibold transition-colors"
          >
            {isCrawling ? 'Crawling...' : 'Crawl Now'}
          </button>

          {/* Clear all — two-step confirm */}
          {confirmClear ? (
            <div className="flex gap-1.5 items-center bg-red-950 border border-red-800 rounded-xl px-3 py-1.5">
              <span className="text-xs text-red-300 font-medium">Dismiss all?</span>
              <button
                onClick={dismissAllJobs}
                className="text-xs px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded-lg font-semibold transition-colors"
              >Yes</button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-xs px-2 py-0.5 text-red-400 hover:text-red-200 transition-colors"
              >No</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={isCrawling}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-400 hover:text-zinc-200
                         rounded-xl text-sm transition-colors"
              title="Delete all crawled jobs"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Live crawl log */}
      {(isCrawling || crawlState.log?.length > 0) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {/* Header + progress bar */}
          {!isCrawling && crawlState.log?.length > 0 ? (
            <div className={`px-4 py-3 border-b flex items-center justify-between ${
              crawlState.message?.startsWith('Stopped')
                ? 'border-yellow-900 bg-yellow-950/40'
                : 'border-green-900 bg-green-950/40'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-base ${crawlState.message?.startsWith('Stopped') ? 'text-yellow-400' : 'text-green-400'}`}>
                  {crawlState.message?.startsWith('Stopped') ? '◼' : '✓'}
                </span>
                <span className={`text-sm font-semibold ${crawlState.message?.startsWith('Stopped') ? 'text-yellow-300' : 'text-green-300'}`}>
                  {crawlState.message?.startsWith('Stopped') ? 'Crawl stopped' : 'Crawl complete'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-white">{crawlState.jobs_found} new {crawlState.jobs_found === 1 ? 'job' : 'jobs'} saved</span>
                <span className="text-xs text-zinc-500 ml-2">across {crawlState.log.length} sources</span>
              </div>
            </div>
          ) : (
            <div className="px-4 pt-3 pb-2 border-b border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">Crawl Progress</span>
                <span className="text-xs text-zinc-500">
                  {crawlState.log?.length || 0} / {crawlState.total_sources || '—'} sources
                  {crawlState.total_sources > 0 && (
                    <span className="ml-1 text-zinc-400 font-medium">
                      ({Math.round(((crawlState.log?.length || 0) / crawlState.total_sources) * 100)}%)
                    </span>
                  )}
                </span>
              </div>
              {crawlState.total_sources > 0 && (
                <div className="w-full bg-zinc-800 rounded-full h-1.5">
                  <div
                    className="bg-zinc-200 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.round(((crawlState.log?.length || 0) / crawlState.total_sources) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Log entries */}
          <div ref={logRef} className="max-h-52 overflow-y-auto px-4 py-3 space-y-1 font-mono text-xs">
            {crawlState.log?.map((entry, i) => {
              const pct = crawlState.total_sources > 0
                ? Math.round(((i + 1) / crawlState.total_sources) * 100)
                : null
              return (
                <div key={i} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2 min-w-0">
                    {entry.error
                      ? <span className="text-red-400 shrink-0">✕</span>
                      : <span className="text-green-400 shrink-0">✓</span>
                    }
                    <span className={entry.error ? 'text-red-300' : 'text-zinc-300'}>{entry.source}</span>
                  </span>
                  {pct !== null && (
                    <span className="text-zinc-600 shrink-0">{pct}%</span>
                  )}
                </div>
              )
            })}
            {crawlState.current_source && (
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="inline-block animate-spin shrink-0">⟳</span>
                <span>{crawlState.current_source}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none"
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title, company, location, description..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-9 pr-8 py-2 text-sm
                     text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-white/30"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {['all', 'new', 'saved', 'applied'].map(s => (
            <button key={s}
              onClick={() => setFilter(f => ({ ...f, status: s }))}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter.status === s ? 'bg-white text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Source — dropdown with counts */}
        <select
          value={filter.source}
          onChange={e => setFilter(f => ({ ...f, source: e.target.value }))}
          className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200
                     focus:outline-none focus:ring-2 focus:ring-white/30 cursor-pointer"
        >
          <option value="all">All Sources{jobs.length ? ` (${jobs.length})` : ''}</option>
          <optgroup label="Platforms">
            <option value="glassdoor">{srcOpt('glassdoor', 'Glassdoor')}</option>
          </optgroup>
          <optgroup label="AI & Research">
            <option value="anthropic">{srcOpt('anthropic', 'Anthropic')}</option>
            <option value="databricks">{srcOpt('databricks', 'Databricks')}</option>
            <option value="mistral_ai">{srcOpt('mistral_ai', 'Mistral AI')}</option>
            <option value="openai">{srcOpt('openai', 'OpenAI')}</option>
            <option value="scale_ai">{srcOpt('scale_ai', 'Scale AI')}</option>
            <option value="xai">{srcOpt('xai', 'xAI')}</option>
          </optgroup>
          <optgroup label="Big Tech">
            <option value="amazon">{srcOpt('amazon', 'Amazon')}</option>
            <option value="apple">{srcOpt('apple', 'Apple')}</option>
            <option value="google">{srcOpt('google', 'Google')}</option>
            <option value="microsoft">{srcOpt('microsoft', 'Microsoft')}</option>
            <option value="nvidia">{srcOpt('nvidia', 'Nvidia')}</option>
          </optgroup>
          <optgroup label="Cybersecurity">
            <option value="crowdstrike">{srcOpt('crowdstrike', 'CrowdStrike')}</option>
            <option value="okta">{srcOpt('okta', 'Okta')}</option>
            <option value="pure_storage">{srcOpt('pure_storage', 'Pure Storage')}</option>
            <option value="rubrik">{srcOpt('rubrik', 'Rubrik')}</option>
            <option value="zscaler">{srcOpt('zscaler', 'Zscaler')}</option>
          </optgroup>
          <optgroup label="Data & Cloud">
            <option value="cloudflare">{srcOpt('cloudflare', 'Cloudflare')}</option>
            <option value="datadog">{srcOpt('datadog', 'Datadog')}</option>
            <option value="elastic">{srcOpt('elastic', 'Elastic')}</option>
            <option value="mongodb">{srcOpt('mongodb', 'MongoDB')}</option>
            <option value="snowflake">{srcOpt('snowflake', 'Snowflake')}</option>
          </optgroup>
          <optgroup label="Fintech & Crypto">
            <option value="coinbase">{srcOpt('coinbase', 'Coinbase')}</option>
            <option value="fanduel">{srcOpt('fanduel', 'FanDuel')}</option>
            <option value="robinhood">{srcOpt('robinhood', 'Robinhood')}</option>
            <option value="stripe">{srcOpt('stripe', 'Stripe')}</option>
          </optgroup>
          <optgroup label="Gaming & Entertainment">
            <option value="bungie">{srcOpt('bungie', 'Bungie')}</option>
            <option value="discord">{srcOpt('discord', 'Discord')}</option>
            <option value="epic_games">{srcOpt('epic_games', 'Epic Games')}</option>
            <option value="netflix">{srcOpt('netflix', 'Netflix')}</option>
            <option value="riot_games">{srcOpt('riot_games', 'Riot Games')}</option>
            <option value="roblox">{srcOpt('roblox', 'Roblox')}</option>
          </optgroup>
          <optgroup label="SaaS & Dev Tools">
            <option value="figma">{srcOpt('figma', 'Figma')}</option>
            <option value="palantir">{srcOpt('palantir', 'Palantir')}</option>
            <option value="twilio">{srcOpt('twilio', 'Twilio')}</option>
            <option value="zoom">{srcOpt('zoom', 'Zoom')}</option>
          </optgroup>
          <optgroup label="Consumer & Marketplace">
            <option value="airbnb">{srcOpt('airbnb', 'Airbnb')}</option>
            <option value="lyft">{srcOpt('lyft', 'Lyft')}</option>
            <option value="reddit">{srcOpt('reddit', 'Reddit')}</option>
          </optgroup>
        </select>

        {/* Age filter */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {[
            { key: 'all', label: 'All time' },
            { key: '7',   label: '7d' },
            { key: '14',  label: '14d' },
            { key: '30',  label: '30d' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => setAgeFilter(key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                ageFilter === key ? 'bg-white text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {[
            { key: 'date',      label: 'Date' },
            { key: 'relevance', label: 'Relevance' },
            { key: 'salary',    label: 'Salary' },
            { key: 'company',   label: 'Company' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => setSort(key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                sort === key ? 'bg-white text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setViewMode('grid')}
            title="Grid view"
            className={`px-2.5 py-1 rounded-lg text-sm transition-colors ${
              viewMode === 'grid' ? 'bg-white text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >⊞</button>
          <button
            onClick={() => setViewMode('list')}
            title="List view"
            className={`px-2.5 py-1 rounded-lg text-sm transition-colors ${
              viewMode === 'list' ? 'bg-white text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >☰</button>
        </div>

        {/* Salary */}
        <div className="flex items-center gap-2">
          <input type="number" value={filter.salary_min}
            onChange={e => setFilter(f => ({ ...f, salary_min: e.target.value }))}
            placeholder="Min $"
            className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-100
                       placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
          <span className="text-zinc-600 text-xs">–</span>
          <input type="number" value={filter.salary_max}
            onChange={e => setFilter(f => ({ ...f, salary_max: e.target.value }))}
            placeholder="Max $"
            className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-zinc-100
                       placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/30"
          />
        </div>

        {/* Select-all + count + show hidden */}
        <div className="flex items-center gap-3 ml-auto">
          {selectableJobs.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              title="Select all visible"
              className="w-4 h-4 rounded accent-white cursor-pointer"
            />
          )}
          <span className="text-sm text-zinc-500">{visibleCount} jobs</span>
          <button
            onClick={() => setShowHidden(h => !h)}
            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
              showHidden
                ? 'border-zinc-500 text-zinc-300 bg-zinc-900'
                : 'border-zinc-700 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {showHidden ? 'Hide hidden' : 'Show hidden'}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5">
          <span className="text-sm text-zinc-200 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleBulkAction('saved')}
              className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-white rounded-lg font-medium transition-colors"
            >
              Save all
            </button>
            <button
              onClick={() => handleBulkAction('denied')}
              className="px-3 py-1.5 text-xs bg-red-950 hover:bg-red-900 text-red-400 rounded-lg font-medium transition-colors"
            >
              Deny all
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Job grid / list */}
      {loading ? (
        <div className="text-center text-zinc-500 py-20">Loading...</div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center text-zinc-500 py-20">
          {search ? (
            <>
              <p className="text-lg mb-2">No results for "{search}"</p>
              <button onClick={() => setSearch('')} className="text-sm text-zinc-300 hover:text-white">
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="text-lg mb-2">No jobs yet</p>
              <p className="text-sm">Go to Settings to add your credentials, then click Crawl Now</p>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={handleStatusChange}
              onApply={setApplyJob}
              onView={openPanel}
              isNew={!seenIds.has(job.id)}
              selected={selectedIds.has(job.id)}
              onSelect={handleToggleSelect}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={handleStatusChange}
              onApply={setApplyJob}
              onView={openPanel}
              isNew={!seenIds.has(job.id)}
              compact
              selected={selectedIds.has(job.id)}
              onSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}

      {showHidden && hiddenJobs.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
            Hidden — {hiddenJobs.length} job{hiddenJobs.length !== 1 ? 's' : ''}
          </p>
          <div className={viewMode === 'list'
            ? 'flex flex-col gap-2'
            : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
          }>
            {hiddenJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onStatusChange={handleStatusChange}
                onApply={setApplyJob}
                onView={openPanel}
                compact={viewMode === 'list'}
                selected={false}
                onSelect={null}
                hidden={true}
              />
            ))}
          </div>
        </div>
      )}

      {applyJob && (
        <ApplyModal
          job={applyJob}
          onClose={() => setApplyJob(null)}
          onSubmitted={handleSubmitted}
        />
      )}

      {panelJob && (
        <JobPanel
          job={panelJob}
          onClose={() => setPanelJob(null)}
          onApply={(job) => { setPanelJob(null); setApplyJob(job) }}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  )
}
