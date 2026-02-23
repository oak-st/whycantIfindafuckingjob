import React, { useEffect, useState, useCallback, useMemo } from 'react'
import JobCard from '../components/JobCard'
import ApplyModal from '../components/ApplyModal'

const API = '/api'
const POLL_INTERVAL = 3000

export default function Dashboard() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [crawlState, setCrawlState] = useState({ status: 'idle', message: 'Idle', jobs_found: 0 })
  const [filter, setFilter] = useState({ source: 'all', status: 'new', salary_min: '', salary_max: '' })
  const [applyJob, setApplyJob] = useState(null)
  const [error, setError] = useState('')

  // Feature 6 — search
  const [search, setSearch] = useState('')
  // Feature 7 — bulk select
  const [selectedIds, setSelectedIds] = useState(new Set())
  // Feature 8 — age filter
  const [ageFilter, setAgeFilter] = useState('all')

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

  useEffect(() => { fetchJobs() }, [fetchJobs])

  useEffect(() => {
    fetchCrawlStatus()
    const interval = setInterval(() => {
      fetchCrawlStatus()
      if (crawlState.status === 'running') fetchJobs()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchCrawlStatus, crawlState.status, fetchJobs])

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

    return result
  }, [jobs, search, ageFilter])

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

  const handleStatusChange = async (jobId, status) => {
    try {
      await fetch(`${API}/jobs/${jobId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setJobs(js => js.map(j => j.id === jobId ? { ...j, status } : j))
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSubmitted = (jobId) => {
    setJobs(js => js.map(j => j.id === jobId ? { ...j, status: 'applied' } : j))
    setApplyJob(null)
  }

  const isCrawling = crawlState.status === 'running'
  const visibleCount = filteredJobs.filter(j => j.status !== 'skipped').length

  const PLATFORM_SOURCES = new Set(['linkedin', 'glassdoor', 'indeed'])

  // Derive company sources present in the current job list
  const companySources = useMemo(() => {
    const seen = new Set()
    jobs.forEach(j => { if (!PLATFORM_SOURCES.has(j.source)) seen.add(j.source) })
    return [...seen].sort()
  }, [jobs])

  // Pretty-print a snake_case source key: "scale_ai" → "Scale AI"
  const sourceLabel = (key) =>
    key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">Job Feed</h1>
          {isCrawling && (
            <p className="text-sm text-indigo-400 mt-0.5">
              <span className="inline-block animate-spin mr-1">⟳</span>
              {crawlState.message} ({crawlState.jobs_found} new)
            </p>
          )}
          {!isCrawling && crawlState.message !== 'Idle' && (
            <p className="text-sm text-gray-400 mt-0.5">{crawlState.message}</p>
          )}
          {!isCrawling && crawlState.next_crawl_at && (
            <p className="text-sm text-gray-500 mt-0.5">
              Next auto-crawl: {new Date(crawlState.next_crawl_at).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={startCrawl}
          disabled={isCrawling}
          className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50
                     rounded-xl text-sm font-semibold transition-colors"
        >
          {isCrawling ? 'Crawling...' : 'Crawl Now'}
        </button>
      </div>

      {/* Feature 6 — Search bar */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none"
          fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search title, company, location, description..."
          className="w-full bg-gray-900 border border-gray-800 rounded-xl pl-9 pr-8 py-2 text-sm
                     text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Status */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {['all', 'new', 'saved', 'applied'].map(s => (
            <button key={s}
              onClick={() => setFilter(f => ({ ...f, status: s }))}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
                filter.status === s ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Source — platforms */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {[
            { key: 'all',       label: 'All' },
            { key: 'linkedin',  label: 'LinkedIn' },
            { key: 'glassdoor', label: 'Glassdoor' },
            { key: 'indeed',    label: 'Indeed' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => setFilter(f => ({ ...f, source: key }))}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                filter.source === key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Source — companies (dynamic) */}
        {companySources.length > 0 && (
          <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1 flex-wrap">
            {companySources.map(key => (
              <button key={key}
                onClick={() => setFilter(f => ({ ...f, source: key }))}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filter.source === key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {sourceLabel(key)}
              </button>
            ))}
          </div>
        )}

        {/* Feature 8 — Age filter */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
          {[
            { key: 'all', label: 'All time' },
            { key: '7',   label: '7d' },
            { key: '14',  label: '14d' },
            { key: '30',  label: '30d' },
          ].map(({ key, label }) => (
            <button key={key}
              onClick={() => setAgeFilter(key)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                ageFilter === key ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Salary */}
        <div className="flex items-center gap-2">
          <input type="number" value={filter.salary_min}
            onChange={e => setFilter(f => ({ ...f, salary_min: e.target.value }))}
            placeholder="Min $"
            className="w-24 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-100
                       placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <span className="text-gray-600 text-xs">–</span>
          <input type="number" value={filter.salary_max}
            onChange={e => setFilter(f => ({ ...f, salary_max: e.target.value }))}
            placeholder="Max $"
            className="w-24 bg-gray-900 border border-gray-800 rounded-lg px-2 py-1 text-xs text-gray-100
                       placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Select-all + count */}
        <div className="flex items-center gap-2 ml-auto">
          {selectableJobs.length > 0 && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              title="Select all visible"
              className="w-4 h-4 rounded accent-indigo-500 cursor-pointer"
            />
          )}
          <span className="text-sm text-gray-500">{visibleCount} jobs</span>
        </div>
      </div>

      {/* Feature 7 — Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-indigo-950 border border-indigo-800 rounded-xl px-4 py-2.5">
          <span className="text-sm text-indigo-300 font-medium">
            {selectedIds.size} selected
          </span>
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => handleBulkAction('saved')}
              className="px-3 py-1.5 text-xs bg-indigo-700 hover:bg-indigo-600 rounded-lg font-medium transition-colors"
            >
              Save all
            </button>
            <button
              onClick={() => handleBulkAction('skipped')}
              className="px-3 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 rounded-lg font-medium transition-colors"
            >
              Skip all
            </button>
            <button
              onClick={() => handleBulkAction('denied')}
              className="px-3 py-1.5 text-xs bg-red-950 hover:bg-red-900 text-red-400 rounded-lg font-medium transition-colors"
            >
              Deny all
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400 bg-red-950 border border-red-800 rounded-lg px-4 py-2">{error}</p>
      )}

      {/* Job grid */}
      {loading ? (
        <div className="text-center text-gray-500 py-20">Loading...</div>
      ) : filteredJobs.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          {search ? (
            <>
              <p className="text-lg mb-2">No results for "{search}"</p>
              <button onClick={() => setSearch('')} className="text-sm text-indigo-400 hover:text-indigo-300">
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onStatusChange={handleStatusChange}
              onApply={setApplyJob}
              selected={selectedIds.has(job.id)}
              onSelect={handleToggleSelect}
            />
          ))}
        </div>
      )}

      {applyJob && (
        <ApplyModal
          job={applyJob}
          onClose={() => setApplyJob(null)}
          onSubmitted={handleSubmitted}
        />
      )}
    </div>
  )
}
