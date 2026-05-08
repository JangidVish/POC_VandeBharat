import { useState, useRef, useCallback, useEffect } from 'react'

const OCR_SERVER = 'http://localhost:5000'

const ACCENT  = '#2563EB'
const SUCCESS = '#22C55E'
const DANGER  = '#EF4444'
const WARN    = '#F59E0B'
const MUTED   = '#64748B'
const BORDER  = '#E2E8F0'
const SURFACE = '#F8FAFC'

// ── helpers ────────────────────────────────────────────────────────────────────
const card = { background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 20 }

function Badge({ color, children }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
      background: color + '18', color, border: `1px solid ${color}55`,
    }}>{children}</span>
  )
}

function ProgressBar({ value }) {          // 0-100
  return (
    <div style={{ height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        width: `${value}%`, height: '100%',
        background: `linear-gradient(90deg, ${ACCENT}, #60A5FA)`,
        borderRadius: 3, transition: 'width .2s',
      }} />
    </div>
  )
}

// ── main component ─────────────────────────────────────────────────────────────
export default function OCRPanel({ onComplete }) {
  const [activeTab, setActiveTab]   = useState('image')
  const [file, setFile]             = useState(null)
  const [preview, setPreview]       = useState(null)
  const [dragging, setDragging]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState(null)
  const [error, setError]       = useState(null)
  const [voteThresh, setVoteThresh] = useState(5)

  // Interval / FPS (linked — single source of truth is intervalMs)
  const [intervalMs, setIntervalMs]         = useState(500)   // 2 fps default
  const targetFps = parseFloat((1000 / Math.max(intervalMs, 40)).toFixed(2))
  const [videoDuration, setVideoDuration]   = useState(null)
  const estimatedFrames = videoDuration != null
    ? Math.floor(videoDuration / (Math.max(intervalMs, 40) / 1000))
    : null

  const handleIntervalChange = (val) => setIntervalMs(Math.max(40, Number(val) || 40))
  const handleFpsChange      = (val) => setIntervalMs(Math.round(1000 / Math.max(0.1, Number(val) || 1)))

  // video streaming state
  const [streamMeta, setStreamMeta]       = useState(null)   // {total_frames, fps}
  const [streamFrame, setStreamFrame]     = useState(null)   // latest frame event
  const [streamLogs, setStreamLogs]       = useState([])     // rolling log lines
  const [liveVotes, setLiveVotes]         = useState({})
  const [liveThumb, setLiveThumb]         = useState(null)   // base64 thumbnail

  const imageInputRef = useRef()
  const videoInputRef = useRef()
  const logsEndRef    = useRef()
  const abortRef      = useRef(null)

  // auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [streamLogs])

  // ── file handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    setResult(null); setError(null)
    setStreamMeta(null); setStreamFrame(null); setStreamLogs([]); setLiveVotes({}); setLiveThumb(null)
    if (activeTab === 'image') {
      setPreview(URL.createObjectURL(f))
      setVideoDuration(null)
    } else {
      setPreview(null)
      // load duration so we can show estimated frame count
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.src = URL.createObjectURL(f)
      v.onloadedmetadata = () => { setVideoDuration(v.duration); URL.revokeObjectURL(v.src) }
    }
  }, [activeTab])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFile(null); setPreview(null); setResult(null); setError(null)
    setStreamMeta(null); setStreamFrame(null); setStreamLogs([]); setLiveVotes({}); setLiveThumb(null)
    setVideoDuration(null)
  }

  // ── drag & drop ───────────────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = ()  => setDragging(false)
  const onDrop      = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  // ── image OCR (unchanged, single request) ─────────────────────────────────
  const runImageOCR = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const res  = await fetch(`${OCR_SERVER}/api/ocr/image`, { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Server error')
      setResult({ ...data, mode: 'image' })
    } catch (err) {
      setError(err.message.includes('Failed to fetch')
        ? 'Cannot reach OCR server on port 5000 — make sure it is running.'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  // ── video OCR via SSE stream ───────────────────────────────────────────────
  const runVideoOCR = async () => {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    setStreamMeta(null); setStreamFrame(null); setStreamLogs([]); setLiveVotes({}); setLiveThumb(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('interval_ms', intervalMs)
    fd.append('vote_threshold', voteThresh)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(`${OCR_SERVER}/api/ocr/video/stream`, {
        method: 'POST', body: fd, signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Server ${res.status}`)
      }

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buf     = ''

      const pushLog = (line) =>
        setStreamLogs(prev => [...prev.slice(-199), line])   // keep last 200 lines

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop()                          // incomplete tail

        for (const part of parts) {
          const dataLine = part.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue
          let evt
          try { evt = JSON.parse(dataLine.slice(5).trim()) } catch { continue }

          if (evt.type === 'init') {
            setStreamMeta(evt)
            pushLog(`▶ Video opened — processing ${evt.total_frames} frames at every ${evt.interval_ms}ms  |  source ${evt.source_fps} fps  |  vote threshold=${evt.vote_threshold}`)

          } else if (evt.type === 'frame') {
            setStreamFrame(evt)
            setLiveVotes(evt.votes || {})
            if (evt.thumbnail) setLiveThumb(evt.thumbnail)
            if (evt.candidates?.length) {
              pushLog(`  frame ${evt.frame}  →  candidates: [${evt.candidates.join(', ')}]`)
            }
            // log every 50 processed frames even without a match so the user sees activity
            else if (evt.processed % 50 === 0) {
              pushLog(`  frame ${evt.frame}  (processed ${evt.processed})  — no match`)
            }

          } else if (evt.type === 'done') {
            pushLog(`✓ Done — frames read: ${evt.frames_read}, processed: ${evt.frames_processed}`)
            pushLog(evt.best
              ? `✓ Train number confirmed: ${evt.best}`
              : '✗ No train number reached vote threshold')
            setResult({ ...evt, mode: 'video' })
            setLoading(false)

          } else if (evt.type === 'error') {
            throw new Error(evt.message)
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message.includes('Failed to fetch')
        ? 'Cannot reach OCR server on port 5000 — make sure it is running.'
        : err.message)
    } finally {
      setLoading(false)
    }
  }

  const stopVideo = () => {
    abortRef.current?.abort()
    setLoading(false)
    // Confirm whatever was detected so far — pick highest-voted candidate
    if (Object.keys(liveVotes).length > 0) {
      const best = Object.entries(liveVotes).sort((a, b) => b[1] - a[1])[0][0]
      setResult({ best, votes: liveVotes, mode: 'video', frames_read: framesRead, frames_processed: processedCnt })
      setStreamLogs(prev => [
        ...prev,
        `⏹ Stopped by user — confirming best candidate: ${best} (${liveVotes[best]} vote${liveVotes[best] !== 1 ? 's' : ''})`,
      ])
    }
  }

  const runOCR = () => activeTab === 'image' ? runImageOCR() : runVideoOCR()

  // ── derived values ────────────────────────────────────────────────────────
  const progress     = streamFrame ? streamFrame.progress : 0
  const framesRead   = streamFrame?.frame ?? 0
  const totalFrames  = streamMeta?.total_frames ?? 0
  const processedCnt = streamFrame?.processed ?? 0

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', background: SURFACE, padding: 20, gap: 16 }}>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ══ LEFT: upload + controls ══ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 300, flexShrink: 0 }}>

          {/* tabs */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 4, gap: 4 }}>
            {['image', 'video'].map(t => (
              <button key={t} onClick={() => switchTab(t)} style={{
                flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: activeTab === t ? '#FFFFFF' : 'transparent',
                color: activeTab === t ? '#0F172A' : MUTED,
                boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,.1)' : 'none',
                transition: 'all .15s',
              }}>
                {t === 'image' ? '🖼 Image' : '🎬 Video'}
              </button>
            ))}
          </div>

          {/* drop zone */}
          <div
            onClick={() => (activeTab === 'image' ? imageInputRef : videoInputRef).current.click()}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? ACCENT : BORDER}`,
              borderRadius: 10, padding: '28px 16px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? '#EFF6FF' : '#FFFFFF', transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 6 }}>{activeTab === 'image' ? '🖼️' : '🎬'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
              {file ? file.name : 'Drop file here'}
            </div>
            {file && (
              <div style={{ fontSize: 11, color: MUTED }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
            )}
            <div style={{ fontSize: 11, color: '#CBD5E1', marginTop: 4 }}>
              {activeTab === 'image' ? 'JPG · PNG · WebP' : 'MP4 · AVI · MOV'}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={e => handleFile(e.target.files[0])} />
            <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={e => handleFile(e.target.files[0])} />
          </div>

          {/* image preview */}
          {activeTab === 'image' && preview && (
            <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              <img src={preview} alt="preview"
                style={{ width: '100%', maxHeight: 180, objectFit: 'contain', display: 'block', background: '#000' }} />
            </div>
          )}

          {/* video options */}
          {activeTab === 'video' && (
            <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 12, padding: 14 }}>

              {/* interval / fps row */}
              <div style={{ display: 'flex', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Interval (ms)</span>
                  <input type="number" value={intervalMs} min={40} step={10}
                    onChange={e => handleIntervalChange(e.target.value)}
                    style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#0F172A', background: SURFACE, width: '100%' }} />
                  <span style={{ fontSize: 10, color: '#CBD5E1' }}>Min 40 ms (25 fps)</span>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>FPS</span>
                  <input type="number" value={targetFps} min={0.1} step={0.5}
                    onChange={e => handleFpsChange(e.target.value)}
                    style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#0F172A', background: SURFACE, width: '100%' }} />
                  <span style={{ fontSize: 10, color: '#CBD5E1' }}>Frames per second</span>
                </label>
              </div>

              {/* estimated frames */}
              {estimatedFrames != null && (
                <div style={{ background: '#EFF6FF', borderRadius: 6, padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: MUTED }}>Estimated frames to process</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT, fontVariantNumeric: 'tabular-nums' }}>{estimatedFrames.toLocaleString()}</span>
                </div>
              )}

              {/* vote threshold */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>Vote threshold</span>
                <input type="number" value={voteThresh} min={1} max={50}
                  onChange={e => setVoteThresh(Number(e.target.value))}
                  style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 8px', fontSize: 13, color: '#0F172A', background: SURFACE, width: '100%' }} />
                <span style={{ fontSize: 10, color: '#CBD5E1' }}>Min frames to confirm a number</span>
              </label>
            </div>
          )}

          {/* run / stop button */}
          {loading && activeTab === 'video' ? (
            <button onClick={stopVideo} style={{
              padding: '11px 0', border: `1px solid ${DANGER}`, borderRadius: 8, cursor: 'pointer',
              background: '#FEF2F2', color: DANGER, fontWeight: 700, fontSize: 13,
            }}>
              ⏹ Stop
            </button>
          ) : (
            <button onClick={runOCR} disabled={!file || loading} style={{
              padding: '11px 0', border: 'none', borderRadius: 8,
              cursor: file && !loading ? 'pointer' : 'not-allowed',
              background: file && !loading ? ACCENT : '#CBD5E1',
              color: '#FFFFFF', fontWeight: 700, fontSize: 13, transition: 'background .15s',
            }}>
              {loading ? 'Running OCR…' : 'Run OCR'}
            </button>
          )}

          {/* error */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: `1px solid #FECACA`,
              borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#DC2626',
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ══ RIGHT: results / stream ══ */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

          {/* ── detected train number hero ── */}
          <div style={{
            ...card, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '24px', gap: 6,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>
              Detected Bogie No.
            </span>
            {loading && activeTab === 'image' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Spinner /> <span style={{ fontSize: 12, color: MUTED }}>Analysing image…</span>
              </div>
            ) : result ? (
              <span style={{
                fontSize: 52, fontWeight: 800, letterSpacing: 6,
                color: result.best ? SUCCESS : DANGER, fontVariantNumeric: 'tabular-nums',
              }}>
                {result.best || 'Not detected'}
              </span>
            ) : loading && activeTab === 'video' && liveVotes && Object.keys(liveVotes).length > 0 ? (
              // show best live candidate while processing
              <span style={{ fontSize: 40, fontWeight: 800, letterSpacing: 4, color: WARN, fontVariantNumeric: 'tabular-nums' }}>
                {Object.entries(liveVotes).sort((a,b) => b[1]-a[1])[0]?.[0]}
                <span style={{ fontSize: 13, color: MUTED, marginLeft: 10 }}>tentative</span>
              </span>
            ) : (
              <span style={{ fontSize: 14, color: '#CBD5E1' }}>
                {activeTab === 'video' && loading ? 'Waiting for first detection…' : 'Upload a file and click Run OCR'}
              </span>
            )}
          </div>

          {/* ── VIDEO streaming section ── */}
          {activeTab === 'video' && (loading || result) && (
            <div style={{ display: 'flex', gap: 12 }}>

              {/* current frame thumbnail + progress */}
              <div style={{ ...card, padding: 14, display: 'flex', flexDirection: 'column', gap: 10, width: 220, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: .5 }}>
                  Current Frame
                </div>
                <div style={{
                  width: '100%', aspectRatio: '16/9', background: '#0F172A', borderRadius: 6, overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {liveThumb
                    ? <img src={`data:image/jpeg;base64,${liveThumb}`} alt="frame"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Spinner color="#475569" />
                  }
                </div>

                {/* progress bar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <ProgressBar value={result ? 100 : progress} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: MUTED }}>
                    <span>Frame {framesRead} / {totalFrames || '?'}</span>
                    <span>{result ? '100' : progress.toFixed(0)}%</span>
                  </div>
                </div>

                {/* stats row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: MUTED }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Processed</span><span style={{ color: '#0F172A', fontWeight: 600 }}>{processedCnt}</span>
                  </div>
                  {streamMeta && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Interval</span><span style={{ color: '#0F172A', fontWeight: 600 }}>{streamMeta.interval_ms}ms</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Detections</span>
                    <span style={{ color: '#0F172A', fontWeight: 600 }}>{Object.keys(liveVotes).length}</span>
                  </div>
                </div>
              </div>

              {/* vote table */}
              <div style={{ ...card, padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: .5 }}>
                  Live Vote Tally
                </div>
                {Object.keys(liveVotes).length === 0 ? (
                  <div style={{ padding: 20, color: MUTED, fontSize: 12, textAlign: 'center' }}>
                    {loading ? 'Waiting for candidates…' : 'No candidates detected'}
                  </div>
                ) : (
                  <div style={{ overflow: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: SURFACE }}>
                          {['Number', 'Votes', 'Status'].map(h => (
                            <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(liveVotes).sort((a, b) => b[1] - a[1]).map(([num, votes]) => {
                          const isWinner  = result?.best === num
                          const overThresh = votes >= voteThresh
                          return (
                            <tr key={num} style={{ borderTop: `1px solid ${BORDER}`, background: isWinner ? '#F0FDF4' : 'transparent' }}>
                              <td style={{ padding: '7px 12px', fontWeight: 700, color: isWinner ? SUCCESS : '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{num}</td>
                              <td style={{ padding: '7px 12px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ color: MUTED, minWidth: 24 }}>{votes}</span>
                                  <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2 }}>
                                    <div style={{ width: `${Math.min(votes / voteThresh * 100, 100)}%`, height: '100%', background: overThresh ? SUCCESS : ACCENT, borderRadius: 2 }} />
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '7px 12px' }}>
                                {isWinner
                                  ? <Badge color={SUCCESS}>CONFIRMED</Badge>
                                  : overThresh
                                    ? <Badge color={WARN}>THRESHOLD MET</Badge>
                                    : <Badge color={MUTED}>VOTING…</Badge>}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── terminal-style log ── */}
          {activeTab === 'video' && streamLogs.length > 0 && (
            <div style={{
              background: '#0F172A', borderRadius: 8, padding: '10px 14px',
              fontFamily: 'monospace', fontSize: 11, color: '#94A3B8',
              maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1,
            }}>
              {streamLogs.map((line, i) => (
                <div key={i} style={{
                  color: line.startsWith('✓') ? '#4ADE80'
                       : line.startsWith('✗') ? '#F87171'
                       : line.includes('candidates') ? '#FCD34D'
                       : '#94A3B8',
                }}>{line}</div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          {/* ── image mode: detections table ── */}
          {result?.mode === 'image' && result.detections?.length > 0 && (
            <div style={{ ...card, overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: .5 }}>
                All Detections
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: SURFACE }}>
                    {['#', 'Text', 'Confidence', 'Match'].map(h => (
                      <th key={h} style={{ padding: '7px 12px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.detections.map((d, i) => {
                    const pct     = Math.round(d.confidence * 100)
                    const isMatch = result.train_number_candidates?.includes(d.text.replace(/\s/g, ''))
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '7px 12px', color: MUTED }}>{i + 1}</td>
                        <td style={{ padding: '7px 12px', fontWeight: 600, color: '#0F172A' }}>{d.text}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: MUTED, fontSize: 11, minWidth: 32 }}>{pct}%</span>
                            <div style={{ flex: 1, height: 4, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, borderRadius: 2 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '7px 12px' }}>
                          {isMatch
                            ? <Badge color={SUCCESS}>✓ Train No.</Badge>
                            : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── video mode: final summary (after done) ── */}
          {result?.mode === 'video' && (
            <div style={{ ...card, display: 'flex', gap: 24, flexWrap: 'wrap', padding: '14px 20px' }}>
              {[
                ['Frames Read',  result.frames_read],
                ['Frames Processed', result.frames_processed],
                ['Candidates Found', Object.keys(result.votes || {}).length],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 10, color: MUTED, fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5 }}>{label}</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
                </div>
              ))}
            </div>
          )}

          {/* ── proceed to detection ── */}
          {result && onComplete && (
            <div style={{ ...card, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>
                  {result.best ? `Bogie No. locked in: ${result.best}` : 'No bogie number detected — you can still proceed'}
                </span>
                <span style={{ fontSize: 10, color: '#CBD5E1' }}>This will be tagged on the final inspection report</span>
              </div>
              <button
                onClick={() => onComplete(result.best ?? null)}
                style={{
                  padding: '10px 24px', border: 'none', borderRadius: 8, cursor: 'pointer',
                  background: ACCENT, color: '#FFFFFF', fontWeight: 700, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
                }}
              >
                Proceed to Detection →
              </button>
            </div>
          )}

        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function Spinner({ color = '#2563EB' }) {
  return (
    <div style={{
      width: 24, height: 24, border: `3px solid ${color}33`,
      borderTopColor: color, borderRadius: '50%',
      animation: 'spin .7s linear infinite', flexShrink: 0,
    }} />
  )
}
