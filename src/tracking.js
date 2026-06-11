/**
 * Webcam hand tracking (MediaPipe HandLandmarker) reduced to three curl
 * values — thumb, index, middle — each 0 (open) to 1 (fully curled).
 * Stands in for the glove until it arrives: same interface, a digit curl
 * per channel.
 */
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export class HandTracker {
  constructor() {
    this.video = null;
    this.stream = null;
    this.landmarker = null;
    this.running = false;
  }

  /** @param {HTMLVideoElement} video @param {(curls: {thumb,index,middle}) => void} onCurls */
  async start(video, onCurls) {
    const { FilesetResolver, HandLandmarker } = await import(
      /* @vite-ignore */ `${CDN}/vision_bundle.mjs`
    );
    const fileset = await FilesetResolver.forVisionTasks(`${CDN}/wasm`);
    this.landmarker = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
    });
    this.video = video;
    video.srcObject = this.stream;
    await video.play();

    this.running = true;
    let lastT = -1;
    const loop = () => {
      if (!this.running) return;
      const t = performance.now();
      if (video.readyState >= 2 && t !== lastT) {
        lastT = t;
        const res = this.landmarker.detectForVideo(video, t);
        const lm = res.landmarks?.[0];
        if (lm) onCurls(curlsFromLandmarks(lm));
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.landmarker?.close();
    this.landmarker = null;
  }
}

function angleAt(lm, a, b, c) {
  const v1 = [lm[a].x - lm[b].x, lm[a].y - lm[b].y, lm[a].z - lm[b].z];
  const v2 = [lm[c].x - lm[b].x, lm[c].y - lm[b].y, lm[c].z - lm[b].z];
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const n1 = Math.hypot(...v1);
  const n2 = Math.hypot(...v2);
  return Math.acos(Math.min(1, Math.max(-1, dot / (n1 * n2 || 1))));
}

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/** Straight finger ≈ pi at the PIP; folded ≈ 1 rad. */
function curlsFromLandmarks(lm) {
  return {
    // thumb: bend at IP (landmarks 2-3-4), smaller travel than fingers
    thumb: clamp01((Math.PI - angleAt(lm, 2, 3, 4)) / 1.0),
    index: clamp01((Math.PI - angleAt(lm, 5, 6, 8)) / 2.0),
    middle: clamp01((Math.PI - angleAt(lm, 9, 10, 12)) / 2.0),
  };
}
