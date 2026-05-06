import { useState, useRef, useCallback } from 'react'

const OCR_SERVER = 'http://localhost:5000'

const ACCENT   = '#2563EB'
const SUCCESS  = '#22C55E'
const DANGER   = '#EF4444'
const MUTED    = '#64748B'
const BORDER   = '#E2E8F0'
const SURFACE  = '#F8FAFC'

export default function OCRPanel() {
  const [activeTab, setActiveTab]   = useState('image')   // 'image' | 'video'
  const [file, setFile]             = useState(null)
  const [preview, setPreview]       = useState(null)
  const [dragging, setDragging]     = useState(false)
  const [loading, setLoading]       = useState(false)
  const [result, setResult]         = useState(null)
  const [error, setError]           = useState(null)
  const [frameSkip, setFrameSkip]   = useState(5)
  const [voteThresh, setVoteThresh] = useState(5)

  const imageInputRef = useRef()
  const videoInputRef = useRef()

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFile = useCallback((f) => {
    if (!f) return
    setFile(f)
    setResult(null)
    setError(null)
    if (activeTab === 'image') {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
  }, [activeTab])

  const switchTab = (tab) => {
    setActiveTab(tab)
    setFile(null)
    setPreview(null)
    setResult(null)
    setError(null)
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = ()  => setDragging(false)
  const onDrop      = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]) }

  // ── Run OCR ───────────────────────────────────────────────────────────────
  const runOCR = async () => {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)

    const fd = new FormData()
    fd.append('file', file)

    try {
      let url, data
      if (activeTab === 'image') {
        url = `${OCR_SERVER}/api/ocr/image`
        const res = await fetch(url, { method: 'POST', body: fd })
        data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')
      } else {
        fd.append('frame_skip', frameSkip)
        fd.append('vote_threshold', voteThresh)
        url = `${OCR_SERVER}/api/ocr/video`
        const res = await fetch(url, { method: 'POST', body: fd })
        data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Server error')
      }
      setResult({ ...data, mode: activeTab })
    } catch (err) {
      if (err.message.includes('Failed to fetch')) {
        setError('Cannot reach OCR server. Make sure it is running: cd OCR && python server.py')
      } else {
        setError(err.message)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = {
    background: '#FFFFFF', border: `1px solid ${BORDER}`,
    borderRadius: 10, padding: 20,
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto', background: SURFACE, padding: 20, gap: 16 }}>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>Train Number OCR</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
          background: '#EFF6FF', color: ACCENT, border: `1px solid #BFDBFE`
        }}>
          OCR SERVER · PORT 5000
        </span>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>

        {/* ── Left: Upload ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 340, flexShrink: 0 }}>

          {/* Tabs */}
          <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 8, padding: 4, gap: 4 }}>
            {['image', 'video'].map(t => (
              <button key={t} onClick={() => switchTab(t)} style={{
                flex: 1, padding: '6px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontWeight: 600, fontSize: 12,
                background: activeTab === t ? '#FFFFFF' : 'transparent',
                color: activeTab === t ? '#0F172A' : MUTED,
                boxShadow: activeTab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all .15s'
              }}>
                {t === 'image' ? '🖼 Image' : '🎬 Video'}
              </button>
            ))}
          </div>

          {/* Drop zone */}
          <div
            onClick={() => (activeTab === 'image' ? imageInputRef : videoInputRef).current.click()}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            style={{
              border: `2px dashed ${dragging ? ACCENT : BORDER}`,
              borderRadius: 10, padding: '32px 16px', textAlign: 'center', cursor: 'pointer',
              background: dragging ? '#EFF6FF' : '#FFFFFF', transition: 'all .15s',
            }}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>{activeTab === 'image' ? '🖼️' : '🎬'}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
              {file ? file.name : 'Drop file here'}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {activeTab === 'image' ? 'JPG · PNG · WebP' : 'MP4 · AVI · MOV'}
            </div>
            <input ref={imageInputRef} type="file" accept="image/*" hidden
              onChange={e => handleFile(e.target.files[0])} />
            <input ref={videoInputRef} type="file" accept="video/*" hidden
              onChange={e => handleFile(e.target.files[0])} />
          </div>

          {/* Image preview */}
          {preview && (
            <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
              <img src={preview} alt="preview"
                style={{ width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', background: '#000' }} />
            </div>
          )}

          {/* Video options */}
          {activeTab === 'video' && file && (
            <div style={{ ...card, display: 'flex', gap: 16 }}>
              {[['Frame skip', frameSkip, setFrameSkip], ['Vote threshold', voteThresh, setVoteThresh]].map(([label, val, setter]) => (
                <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                  <span style={{ fontSize: 11, color: MUTED, fontWeight: 600 }}>{label}</span>
                  <input type="number" value={val} min={1} max={30}
                    onChange={e => setter(Number(e.target.value))}
                    style={{
                      border: `1px solid ${BORDER}`, borderRadius: 6, padding: '5px 8px',
                      fontSize: 13, color: '#0F172A', background: SURFACE, width: '100%'
                    }} />
                </label>
              ))}
            </div>
          )}

          {/* Run button */}
          <button onClick={runOCR} disabled={!file || loading} style={{
            padding: '11px 0', border: 'none', borderRadius: 8, cursor: file && !loading ? 'pointer' : 'not-allowed',
            background: file && !loading ? ACCENT : '#CBD5E1',
            color: '#FFFFFF', fontWeight: 700, fontSize: 13, transition: 'background .15s'
          }}>
            {loading ? (activeTab === 'video' ? 'Processing video…' : 'Running OCR…') : 'Run OCR'}
          </button>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: `1px solid #FECACA`,
              borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#DC2626'
            }}>
              {error}
            </div>
          )}
        </div>

        {/* ── Right: Results ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Detected number */}
          <div style={{
            ...card, display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '32px 24px', gap: 8
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 }}>
              Detected Train Number
            </span>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, border: `3px solid ${BORDER}`,
                  borderTopColor: ACCENT, borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite'
                }} />
                <span style={{ fontSize: 12, color: MUTED }}>
                  {activeTab === 'video' ? 'Processing frames…' : 'Analysing image…'}
                </span>
              </div>
            ) : result ? (
              <span style={{
                fontSize: 52, fontWeight: 800, letterSpacing: 6,
                color: result.best ? SUCCESS : DANGER,
                fontVariantNumeric: 'tabular-nums'
              }}>
                {result.best || 'Not detected'}
              </span>
            ) : (
              <span style={{ fontSize: 14, color: '#CBD5E1' }}>Upload a file and click Run OCR</span>
            )}
          </div>

          {/* Image: detections table */}
          {result?.mode === 'image' && result.detections?.length > 0 && (
            <div style={{ ...card, overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: .5 }}>
                All Detections
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: SURFACE }}>
                    {['#', 'Text', 'Confidence', 'Match'].map(h => (
                      <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.detections.map((d, i) => {
                    const pct = Math.round(d.confidence * 100)
                    const isMatch = result.train_number_candidates?.includes(d.text.replace(/\s/g, ''))
                    return (
                      <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '8px 14px', color: MUTED }}>{i + 1}</td>
                        <td style={{ padding: '8px 14px', fontWeight: 600, color: '#0F172A' }}>{d.text}</td>
                        <td style={{ padding: '8px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: MUTED, fontSize: 11, minWidth: 32 }}>{pct}%</span>
                            <div style={{ flex: 1, height: 5, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, borderRadius: 3 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '8px 14px' }}>
                          {isMatch
                            ? <span style={{ color: SUCCESS, fontWeight: 700, fontSize: 11 }}>✓ Train No.</span>
                            : <span style={{ color: '#CBD5E1', fontSize: 11 }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Video: vote table */}
          {result?.mode === 'video' && (
            <div style={{ ...card, overflow: 'hidden', padding: 0 }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: .5 }}>
                Vote Table
              </div>
              {Object.keys(result.votes || {}).length === 0 ? (
                <div style={{ padding: 20, color: MUTED, fontSize: 12, textAlign: 'center' }}>No candidates detected</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: SURFACE }}>
                      {['Number', 'Votes'].map(h => (
                        <th key={h} style={{ padding: '8px 14px', textAlign: 'left', color: MUTED, fontWeight: 600, fontSize: 11, borderBottom: `1px solid ${BORDER}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.votes).sort((a, b) => b[1] - a[1]).map(([num, votes]) => (
                      <tr key={num} style={{ borderTop: `1px solid ${BORDER}` }}>
                        <td style={{ padding: '8px 14px', fontWeight: num === result.best ? 700 : 400, color: num === result.best ? SUCCESS : '#0F172A' }}>{num}</td>
                        <td style={{ padding: '8px 14px', color: MUTED }}>{votes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ padding: '10px 16px', borderTop: `1px solid ${BORDER}`, fontSize: 11, color: MUTED }}>
                Frames read: {result.frames_read} · Processed: {result.frames_processed} · Detection events: {result.detection_log?.length ?? 0}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
