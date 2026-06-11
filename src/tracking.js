/**
 * Webcam hand tracking (MediaPipe HandLandmarker). Emits the raw landmarks
 * each frame — image-space for the skeleton overlay, metric world-space for
 * fingertip retargeting (see retarget.js) — or null when no hand is in
 * view. Stands in for the glove until it arrives.
 */
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const BONES = [
  [0, 1], [1, 2], [2, 3], [3, 4], // thumb
  [0, 5], [5, 6], [6, 7], [7, 8], // index
  [5, 9], [9, 10], [10, 11], [11, 12], // middle
  [9, 13], [13, 14], [14, 15], [15, 16], // ring
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20], // pinky + palm edge
];

export class HandTracker {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.stream = null;
    this.landmarker = null;
    this.running = false;
  }

  /**
   * @param {HTMLVideoElement} video
   * @param {HTMLCanvasElement} canvas skeleton overlay (same CSS box as video)
   * @param {(update: {image, world}|null) => void} onUpdate landmark arrays, null = no hand
   */
  async start(video, canvas, onUpdate) {
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
    this.canvas = canvas;
    video.srcObject = this.stream;
    await video.play();

    this.running = true;
    const ctx = canvas.getContext('2d');
    const loop = () => {
      if (!this.running) return;
      if (video.readyState >= 2) {
        const res = this.landmarker.detectForVideo(video, performance.now());
        const lm = res.landmarks?.[0];
        const world = res.worldLandmarks?.[0];
        this._draw(ctx, lm);
        onUpdate(lm && world ? { image: lm, world } : null);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  _draw(ctx, lm) {
    const { canvas, video } = this;
    if (canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!lm) return;
    const px = (i) => [lm[i].x * canvas.width, lm[i].y * canvas.height];
    ctx.strokeStyle = '#37d3a0';
    ctx.lineWidth = 2;
    for (const [a, b] of BONES) {
      ctx.beginPath();
      ctx.moveTo(...px(a));
      ctx.lineTo(...px(b));
      ctx.stroke();
    }
    ctx.fillStyle = '#f08a2c';
    for (let i = 0; i < lm.length; i++) {
      const [x, y] = px(i);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  stop() {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.canvas?.getContext('2d').clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.landmarker?.close();
    this.landmarker = null;
  }
}

