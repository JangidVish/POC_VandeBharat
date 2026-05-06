// Mock detection sequences — cycles every 100ms to simulate real-time inference
// bbox format: [x_pct, y_pct, w_pct, h_pct] (percentages of video dimensions)

export const DETECTION_SEQUENCES = [
  // Frames 0-4: Wheel + Axle box
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.98, bbox: [0.08, 0.35, 0.22, 0.38], defect: false, track_id: 1 },
      { id: 2, label: "Axle Box Cover", confidence: 0.95, bbox: [0.55, 0.40, 0.18, 0.28], defect: false, track_id: 2 },
    ]
  },
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.97, bbox: [0.09, 0.36, 0.22, 0.37], defect: false, track_id: 1 },
      { id: 2, label: "Axle Box Cover", confidence: 0.94, bbox: [0.56, 0.41, 0.18, 0.28], defect: false, track_id: 2 },
      { id: 3, label: "Brake Pad", confidence: 0.96, bbox: [0.30, 0.55, 0.16, 0.20], defect: false, track_id: 3 },
    ]
  },
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.98, bbox: [0.10, 0.35, 0.22, 0.38], defect: false, track_id: 1 },
      { id: 2, label: "Axle Box Cover", confidence: 0.96, bbox: [0.57, 0.40, 0.17, 0.28], defect: false, track_id: 2 },
      { id: 3, label: "Brake Pad", confidence: 0.95, bbox: [0.31, 0.56, 0.16, 0.20], defect: false, track_id: 3 },
      { id: 4, label: "Coil Spring", confidence: 0.93, bbox: [0.70, 0.30, 0.14, 0.22], defect: false, track_id: 4 },
    ]
  },
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.97, bbox: [0.10, 0.36, 0.22, 0.37], defect: false, track_id: 1 },
      { id: 3, label: "Brake Pad", confidence: 0.96, bbox: [0.32, 0.55, 0.16, 0.20], defect: false, track_id: 3 },
      { id: 4, label: "Coil Spring", confidence: 0.94, bbox: [0.71, 0.31, 0.14, 0.22], defect: false, track_id: 4 },
      { id: 5, label: "Yaw Damper", confidence: 0.91, bbox: [0.44, 0.22, 0.15, 0.25], defect: false, track_id: 5 },
    ]
  },
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.98, bbox: [0.11, 0.35, 0.22, 0.38], defect: false, track_id: 1 },
      { id: 3, label: "Brake Pad", confidence: 0.97, bbox: [0.33, 0.55, 0.16, 0.20], defect: false, track_id: 3 },
      { id: 5, label: "Yaw Damper", confidence: 0.92, bbox: [0.45, 0.22, 0.15, 0.25], defect: false, track_id: 5 },
    ]
  },
  // Frames 5-7: Defect appears!
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.98, bbox: [0.11, 0.35, 0.22, 0.38], defect: false, track_id: 1 },
      { id: 3, label: "Brake Pad", confidence: 0.97, bbox: [0.33, 0.55, 0.16, 0.20], defect: false, track_id: 3 },
      { id: 6, label: "Wheel Shelling", confidence: 0.89, bbox: [0.12, 0.50, 0.14, 0.16], defect: true, track_id: 6, severity: "HIGH" },
    ]
  },
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.98, bbox: [0.11, 0.36, 0.22, 0.37], defect: false, track_id: 1 },
      { id: 6, label: "Wheel Shelling", confidence: 0.93, bbox: [0.12, 0.51, 0.14, 0.16], defect: true, track_id: 6, severity: "HIGH" },
      { id: 7, label: "Crack Detected", confidence: 0.97, bbox: [0.14, 0.52, 0.10, 0.12], defect: true, track_id: 7, severity: "CRITICAL" },
    ]
  },
  {
    detections: [
      { id: 6, label: "Wheel Shelling", confidence: 0.95, bbox: [0.12, 0.51, 0.14, 0.16], defect: true, track_id: 6, severity: "HIGH" },
      { id: 7, label: "Crack Detected", confidence: 0.97, bbox: [0.14, 0.53, 0.10, 0.12], defect: true, track_id: 7, severity: "CRITICAL" },
      { id: 3, label: "Brake Pad", confidence: 0.96, bbox: [0.34, 0.56, 0.16, 0.20], defect: false, track_id: 3 },
    ]
  },
  // Frames 8-9: Back to normal components
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.98, bbox: [0.12, 0.35, 0.22, 0.38], defect: false, track_id: 1 },
      { id: 3, label: "Brake Pad", confidence: 0.95, bbox: [0.35, 0.55, 0.16, 0.20], defect: false, track_id: 3 },
      { id: 8, label: "Anti-Roll Bar", confidence: 0.90, bbox: [0.60, 0.60, 0.20, 0.15], defect: false, track_id: 8 },
    ]
  },
  {
    detections: [
      { id: 1, label: "Wheel Assembly", confidence: 0.97, bbox: [0.12, 0.36, 0.22, 0.37], defect: false, track_id: 1 },
      { id: 8, label: "Anti-Roll Bar", confidence: 0.92, bbox: [0.61, 0.60, 0.20, 0.15], defect: false, track_id: 8 },
      { id: 9, label: "Brake Disc", confidence: 0.94, bbox: [0.38, 0.38, 0.18, 0.24], defect: false, track_id: 9 },
    ]
  },
]

// Timeline events corresponding to detection sequences
export const TIMELINE_EVENTS = [
  { time: "00:02", message: "Wheel Assembly detected", type: "normal" },
  { time: "00:03", message: "Axle Box Cover detected", type: "normal" },
  { time: "00:05", message: "Brake Pad detected — Track #3", type: "normal" },
  { time: "00:07", message: "Coil Spring detected", type: "normal" },
  { time: "00:09", message: "Yaw Damper detected — Track #5", type: "normal" },
  { time: "00:11", message: "⚠ Wheel Shelling detected — HIGH severity", type: "warning" },
  { time: "00:12", message: "🔴 CRACK DETECTED — CRITICAL — 97% confidence", type: "critical" },
  { time: "00:15", message: "Anti-Roll Bar detected — Track #8", type: "normal" },
  { time: "00:17", message: "Brake Disc detected — Track #9", type: "normal" },
]
