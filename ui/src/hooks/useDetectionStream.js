import { useEffect, useRef, useState, useCallback } from 'react'


const WS_URL = 'ws://127.0.0.1:8000/ws/detections'

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
  const enabledRef  = useRef(enabled)
  const connId      = useRef(0)
  const MAX_RETRIES = 5

  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const connect = useCallback(() => {
    const id = ++connId.current
    if (!enabledRef.current) {
      console.log(`[WS-${id}] Connection blocked: Hook is disabled`);
      return
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnState(CONNECTION_STATE.CONNECTING)
    console.log(`[WS-${id}] Connecting to ${WS_URL}...`);
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log(`[WS-${id}] Connected to backend`)
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
    console.log(`[useDetectionStream] Enabled check: ${enabled}`);
    if (!enabled) {
      if (wsRef.current) {
        console.log('[useDetectionStream] Disabling: Closing existing connection');
        disconnect();
      }
      return;
    }
    connect();
    return () => {
      clearTimeout(retryRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect, disconnect]);

  return {
    detections,
    meta,
    connState,
    isConnected: connState === CONNECTION_STATE.CONNECTED,
    reconnect: connect,
    disconnect,
  }
}
