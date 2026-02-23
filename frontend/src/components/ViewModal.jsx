import React from 'react'

export default function ViewModal({ job, cleanDesc, onClose, onApply }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-800">
          <div className="space-y-0.5 flex-1 min-w-0 pr-4">
            <h2 className="text-base font-bold text-white leading-snug">{job.title}</h2>
            <p className="text-sm text-gray-400">{job.company}{job.location ? ` · ${job.location}` : ''}</p>
            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              {job.salary && <span className="text-green-400">{job.salary}</span>}
              {job.posted_date && <span className="text-gray-500">{job.posted_date}</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Description */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {cleanDesc ? (
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
              {cleanDesc}
            </p>
          ) : (
            <p className="text-sm text-gray-500 italic">No description available.</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-800 flex items-center justify-between gap-4">
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-400 hover:text-indigo-300 underline"
          >
            Open original posting ↗
          </a>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
            {job.status !== 'applied' && (
              <button
                onClick={() => { onClose(); onApply(job) }}
                className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg font-semibold transition-colors"
              >
                Apply
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
