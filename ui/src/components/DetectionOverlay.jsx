import { useEffect, useRef } from 'react'

// Lerp for smooth box movement
function lerp(a, b, t) { return a + (b - a) * t }

const LERP_SPEED = 0.25

export default function DetectionOverlay({ detections, videoRef }) {
  const canvasRef = useRef(null)
  const prevBoxesRef = useRef({})   // track_id → current rendered bbox
  const animFrameRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    let running = true

    function draw() {
      if (!running) return

      const w = video.offsetWidth
      const h = video.offsetHeight

      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, w, h)

      detections.forEach(det => {
        const [xp, yp, wp, hp] = det.bbox
        const targetX = xp * w
        const targetY = yp * h
        const targetW = wp * w
        const targetH = hp * h

        // Lerp from previous position for smooth tracking
        const prev = prevBoxesRef.current[det.track_id]
        let rx, ry, rw, rh
        if (prev) {
          rx = lerp(prev.x, targetX, LERP_SPEED)
          ry = lerp(prev.y, targetY, LERP_SPEED)
          rw = lerp(prev.w, targetW, LERP_SPEED)
          rh = lerp(prev.h, targetH, LERP_SPEED)
        } else {
          rx = targetX; ry = targetY; rw = targetW; rh = targetH
        }
        prevBoxesRef.current[det.track_id] = { x: rx, y: ry, w: rw, h: rh }

        const isDefect = det.defect
        const color = isDefect ? '#EF4444' : '#0EA5E9'
        const bgColor = isDefect ? 'rgba(239,68,68,0.08)' : 'rgba(14,165,233,0.06)'

        // Background fill
        ctx.fillStyle = bgColor
        roundRect(ctx, rx, ry, rw, rh, 6)
        ctx.fill()

        // Glow for defects
        if (isDefect) {
          ctx.shadowColor = '#EF4444'
          ctx.shadowBlur = 12
        }

        // Border
        ctx.strokeStyle = color
        ctx.lineWidth = isDefect ? 2.5 : 2
        roundRect(ctx, rx, ry, rw, rh, 6)
        ctx.stroke()
        ctx.shadowBlur = 0

        // Corner accents (top-left, bottom-right)
        const cs = 10
        ctx.strokeStyle = color
        ctx.lineWidth = 3
        ctx.lineCap = 'round'
        // TL
        ctx.beginPath(); ctx.moveTo(rx + cs, ry); ctx.lineTo(rx, ry); ctx.lineTo(rx, ry + cs); ctx.stroke()
        // TR
        ctx.beginPath(); ctx.moveTo(rx + rw - cs, ry); ctx.lineTo(rx + rw, ry); ctx.lineTo(rx + rw, ry + cs); ctx.stroke()
        // BL
        ctx.beginPath(); ctx.moveTo(rx, ry + rh - cs); ctx.lineTo(rx, ry + rh); ctx.lineTo(rx + cs, ry + rh); ctx.stroke()
        // BR
        ctx.beginPath(); ctx.moveTo(rx + rw - cs, ry + rh); ctx.lineTo(rx + rw, ry + rh); ctx.lineTo(rx + rw, ry + rh - cs); ctx.stroke()

        // Label chip
        const label = `${det.label}  ${Math.round(det.confidence * 100)}%`
        const chipH = 20
        const chipPad = 8
        ctx.font = 'bold 11px Inter, sans-serif'
        const textW = ctx.measureText(label).width
        const chipW = textW + chipPad * 2
        const chipX = rx
        const chipY = ry - chipH - 2

        ctx.fillStyle = isDefect ? '#EF4444' : '#0EA5E9'
        roundRect(ctx, chipX, chipY, chipW, chipH, 4)
        ctx.fill()

        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(label, chipX + chipPad, chipY + 13)

        // Track ID (bottom right of box)
        if (det.track_id) {
          ctx.font = '10px Inter, sans-serif'
          ctx.fillStyle = color
          ctx.fillText(`#${det.track_id}`, rx + rw - 20, ry + rh + 12)
        }
      })

      // Clean up tracks no longer in frame
      const activeIds = new Set(detections.map(d => d.track_id))
      Object.keys(prevBoxesRef.current).forEach(id => {
        if (!activeIds.has(Number(id))) delete prevBoxesRef.current[id]
      })

      animFrameRef.current = requestAnimationFrame(draw)
    }

    animFrameRef.current = requestAnimationFrame(draw)

    return () => {
      running = false
      cancelAnimationFrame(animFrameRef.current)
    }
  }, [detections, videoRef])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
    />
  )
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
