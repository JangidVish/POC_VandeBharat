import { useEffect, useRef, useState, useCallback } from 'react'


const CONNECTION_STATE = {
  CONNECTING: 'connecting',
  CONNECTED:  'connected',
  CLOSED:     'closed',
  ERROR:      'error',
}

export function useDetectionStream(enabled = true) {
  const [detections, setDetections] = useState([])
  const [meta, setMeta] = useState({ fps: 0, latency_ms: 0, frame: 0, mode: 'model' })
  const [connState, setConnState] = useState(CONNECTION_STATE.CLOSED)

  const wsRef       = useRef(null)
  const retryRef    = useRef(null)
  const retryCount  = useRef(0)
  const MAX_RETRIES = 5

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnState(CONNECTION_STATE.CONNECTING)
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected to backend')
      setConnState(CONNECTION_STATE.CONNECTED)
      retryCount.current = 0
    }

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.error) {
          console.error('[WS] Backend error:', data.error)
          return
        }
        setDetections(data.detections ?? [])
        if (data.meta) setMeta(data.meta)
      } catch (err) {
        console.error('[WS] Parse error:', err)
      }
    }

    ws.onerror = () => {
      setConnState(CONNECTION_STATE.ERROR)
    }

    ws.onclose = () => {
      setConnState(CONNECTION_STATE.CLOSED)
      setDetections([])

      // Auto-retry with backoff
      if (retryCount.current < MAX_RETRIES) {
        const delay = Math.min(1000 * 2 ** retryCount.current, 10000)
        retryCount.current += 1
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${retryCount.current}/${MAX_RETRIES})`)
        retryRef.current = setTimeout(connect, delay)
      } else {
        console.warn('[WS] Max retries reached — staying disconnected')
      }
    }
  }, [])

  const disconnect = useCallback(() => {
    clearTimeout(retryRef.current)
    retryCount.current = MAX_RETRIES  // prevent auto-retry
    wsRef.current?.close()
    setDetections([])
    setConnState(CONNECTION_STATE.CLOSED)
  }, [])

  useEffect(() => {
    if (!enabled) return
    connect()
    return () => {
      clearTimeout(retryRef.current)
      wsRef.current?.close()
    }
  }, [enabled, connect])

  return {
    detections,
    meta,
    connState,
    isConnected: connState === CONNECTION_STATE.CONNECTED,
    reconnect: connect,
    disconnect,
  }
}
