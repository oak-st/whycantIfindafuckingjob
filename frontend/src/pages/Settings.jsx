import React, { useEffect, useState } from 'react'

const API = '/api'

function Field({ label, type = 'text', value, onChange, placeholder, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-100
                   placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
      />
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-[#1c2026] border border-[#2a3241] rounded-xl p-5 space-y-4">
      <h2 className="text-base font-semibold text-slate-200">{title}</h2>
      {children}
    </div>
  )
}

export default function Settings() {
  const [form, setForm] = useState({
    anthropic_api_key: '',
    search_keywords: 'IT Engineer, Senior IT Engineer, IT Systems Engineer',
    exclude_keywords: '',
    search_location: 'United States',
    work_type: 'any',
    salary_min: '',
    salary_max: '',
    max_jobs: 50,
    auto_crawl_enabled: false,
    auto_crawl_interval_hours: 24,
    show_browser: false,
  })
  const [resumeFile, setResumeFile] = useState(null)
  const [resumeFilename, setResumeFilename] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingResume, setUploadingResume] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const loadSettings = () =>
    fetch(`${API}/settings`)
      .then(r => r.json())
      .then(data => {
        setForm(f => ({
          ...f,
          search_keywords: data.search_keywords || f.search_keywords,
          exclude_keywords: data.exclude_keywords ?? '',
          search_location: data.search_location || f.search_location,
          work_type: data.work_type || 'any',
          salary_min: data.salary_min != null ? String(data.salary_min) : '',
          salary_max: data.salary_max != null ? String(data.salary_max) : '',
          max_jobs: data.max_jobs ?? 50,
          auto_crawl_enabled: data.auto_crawl_enabled ?? false,
          auto_crawl_interval_hours: data.auto_crawl_interval_hours ?? 24,
          show_browser: data.show_browser ?? false,
        }))
        setResumeFilename(data.resume_filename || '')
      })
      .catch(() => {})

  useEffect(() => { loadSettings() }, [])

  const set = (key) => (val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const body = {}
      if (form.anthropic_api_key) body.anthropic_api_key = form.anthropic_api_key
      body.search_keywords = form.search_keywords
      body.exclude_keywords = form.exclude_keywords
      body.search_location = form.search_location
      body.work_type = form.work_type
      if (form.salary_min !== '') body.salary_min = parseInt(form.salary_min, 10)
      if (form.salary_max !== '') body.salary_max = parseInt(form.salary_max, 10)
      body.max_jobs = form.max_jobs
      body.auto_crawl_enabled = form.auto_crawl_enabled
      body.auto_crawl_interval_hours = form.auto_crawl_interval_hours
      body.show_browser = form.show_browser

      const res = await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleResumeUpload = async () => {
    if (!resumeFile) return
    setUploadingResume(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', resumeFile)
      const res = await fetch(`${API}/resume`, { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setResumeFilename(data.filename)
      setResumeFile(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setUploadingResume(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold text-white">Settings</h1>

      <Section title="AI (Cover Letters)">
        <Field label="Anthropic API Key" type="password" value={form.anthropic_api_key} onChange={set('anthropic_api_key')}
          placeholder="sk-ant-..." hint="Used for generating cover letters and custom answers" />
      </Section>

      <Section title="Job Search Preferences">
        <Field label="Keywords (comma-separated)" value={form.search_keywords} onChange={set('search_keywords')}
          placeholder="IT Engineer, Senior IT Engineer" />
        <Field label="Exclude keywords (comma-separated)" value={form.exclude_keywords} onChange={set('exclude_keywords')}
          placeholder="intern, manager, director, staff"
          hint="Jobs whose title contains any of these words will be skipped during crawl" />
        <Field label="Location" value={form.search_location} onChange={set('search_location')}
          placeholder="United States, Remote, New York..." />
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Work Type</label>
          <select
            value={form.work_type}
            onChange={e => set('work_type')(e.target.value)}
            className="bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-100
                       focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          >
            <option value="any">Any</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">On-site</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Salary Range ($/yr) — skip jobs outside this range during crawl</label>
          <div className="flex gap-3">
            <input
              type="number"
              value={form.salary_min}
              onChange={e => set('salary_min')(e.target.value)}
              placeholder="Min (e.g. 80000)"
              className="w-full bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-100
                         placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
            <input
              type="number"
              value={form.salary_max}
              onChange={e => set('salary_max')(e.target.value)}
              placeholder="Max (e.g. 150000)"
              className="w-full bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-100
                         placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">Jobs with no listed salary are always included</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Max jobs per crawl</label>
          <select
            value={form.max_jobs}
            onChange={e => set('max_jobs')(parseInt(e.target.value, 10))}
            className="bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-100
                       focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          >
            <option value={25}>25</option>
            <option value={50}>50 (default)</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="auto_crawl"
              checked={form.auto_crawl_enabled}
              onChange={e => set('auto_crawl_enabled')(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
            <label htmlFor="auto_crawl" className="text-sm font-medium text-slate-300">Auto-crawl</label>
          </div>
          {form.auto_crawl_enabled && (
            <div className="flex items-center gap-2 ml-7">
              <label className="text-sm text-slate-400">Every</label>
              <select
                value={form.auto_crawl_interval_hours}
                onChange={e => set('auto_crawl_interval_hours')(parseInt(e.target.value, 10))}
                className="bg-[#252d38] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-100
                           focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              >
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
              </select>
            </div>
          )}
        </div>
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="show_browser"
            checked={form.show_browser}
            onChange={e => set('show_browser')(e.target.checked)}
            className="w-4 h-4 mt-0.5 rounded accent-emerald-500"
          />
          <div>
            <label htmlFor="show_browser" className="text-sm font-medium text-slate-300">
              Show browser while crawling
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Opens a visible browser window so you can watch the crawl in real time.
              Turn off for silent background crawls.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Resume">
        {resumeFilename && (
          <p className="text-sm text-green-400">Current file: {resumeFilename}</p>
        )}
        <div className="flex items-center gap-3">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={e => setResumeFile(e.target.files[0] || null)}
            className="text-sm text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg
                       file:border-0 file:text-sm file:bg-[#252d38] file:text-slate-200
                       hover:file:bg-[#2e3845] cursor-pointer"
          />
          <button
            onClick={handleResumeUpload}
            disabled={!resumeFile || uploadingResume}
            className="px-4 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-40
                       rounded-lg font-medium transition-colors"
          >
            {uploadingResume ? 'Uploading...' : 'Upload'}
          </button>
        </div>
        <p className="text-xs text-slate-500">PDF, DOCX, or TXT — used for AI cover letter generation</p>
      </Section>

      {error && <p className="text-sm text-red-400 bg-red-950 border border-red-900 rounded-lg px-4 py-2">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white disabled:opacity-40
                   rounded-xl font-semibold text-sm transition-colors"
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  )
}
