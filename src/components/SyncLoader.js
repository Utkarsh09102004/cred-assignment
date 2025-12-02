'use client';

export default function SyncLoader({ isVisible, progress = 0, currentPage, totalPages, status }) {
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 w-80 rounded-2xl border border-white/10 bg-[#13111d]/95 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl p-4 text-white animate-slide-up">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[#6d5df5] to-[#5645ee] flex items-center justify-center shadow-lg shadow-[#5645ee]/40">
            <svg
              className="animate-spin h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-30"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-80"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          </div>
        </div>

        <div className="flex-1">
          <div className="font-semibold text-white mb-1">
            {status === 'completed' ? 'Sync completed!' : 'Syncing segments...'}
          </div>

          {currentPage && totalPages && (
            <div className="text-sm text-white/70 mb-2">
              Processing page {currentPage} of {totalPages}
            </div>
          )}

          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#6d5df5] to-[#5645ee] h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-xs text-white/60 mt-1 text-right">
            {Math.round(progress)}%
          </div>
        </div>
      </div>
    </div>
  );
}
