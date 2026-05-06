import { useState, useEffect } from 'react'

export default function Header({ fps, isActive, frameCount }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="flex items-center justify-between px-6 border-b"
      style={{ height: 70, background: '#FFFFFF', borderColor: '#E2E8F0', flexShrink: 0 }}>

      {/* Left — Logo + Title */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center rounded-lg"
          style={{ width: 40, height: 40, background: '#2563EB' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M3 17h18M3 12h18M3 7h18" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <circle cx="7" cy="19" r="2" fill="white"/>
            <circle cx="17" cy="19" r="2" fill="white"/>
          </svg>
        </div>
        <div>
          <div className="font-semibold text-sm leading-tight" style={{ color: '#0F172A' }}>
            AI Railway Inspection System
          </div>
          <div className="text-xs" style={{ color: '#64748B' }}>
            Vande Bharat — Real-Time Defect Detection
          </div>
        </div>
      </div>

      {/* Center — Status */}
      <div className="flex items-center gap-2">
        <span className="pulse-dot inline-block rounded-full"
          style={{ width: 10, height: 10, background: isActive ? '#22C55E' : '#94A3B8', flexShrink: 0 }} />
        <span className="text-sm font-semibold tracking-wide"
          style={{ color: isActive ? '#22C55E' : '#94A3B8', letterSpacing: '0.08em' }}>
          {isActive ? 'AI ACTIVE' : 'STANDBY'}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full ml-2"
          style={{ background: '#F0F9FF', color: '#0EA5E9', border: '1px solid #BAE6FD' }}>
          Vande Bharat Express
        </span>
      </div>

      {/* Right — Metrics */}
      <div className="flex items-center gap-5">
        <div className="text-center">
          <div className="text-xs" style={{ color: '#94A3B8' }}>FPS</div>
          <div className="text-lg font-bold leading-none" style={{ color: '#2563EB' }}>{fps}</div>
        </div>
        <div className="w-px h-8" style={{ background: '#E2E8F0' }} />
        <div className="text-center">
          <div className="text-xs" style={{ color: '#94A3B8' }}>FRAMES</div>
          <div className="text-sm font-semibold leading-none" style={{ color: '#0F172A' }}>
            {frameCount.toLocaleString()}
          </div>
        </div>
        <div className="w-px h-8" style={{ background: '#E2E8F0' }} />
        <div className="text-right">
          <div className="text-xs" style={{ color: '#94A3B8' }}>
            {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </div>
          <div className="text-sm font-semibold" style={{ color: '#0F172A' }}>
            {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>
    </header>
  )
}
