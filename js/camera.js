/**
 * Camera module — wraps MediaDevices API
 */
class Camera {
  constructor() {
    this.stream = null;
    this.video = null;
    this.canvas = null;
  }

  async start(videoEl, canvasEl) {
    this.video = videoEl;
    this.canvas = canvasEl;

    const constraints = {
      video: {
        facingMode: { ideal: 'environment' },
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      // Fallback: any camera
      this.stream = await navigator.mediaDevices.getUserMedia({ video: true });
    }

    videoEl.srcObject = this.stream;
    await new Promise(resolve => {
      videoEl.onloadedmetadata = resolve;
    });
    await videoEl.play();
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
  }

  capture() {
    const v = this.video;
    const c = this.canvas;
    c.width  = v.videoWidth  || 1280;
    c.height = v.videoHeight || 720;
    c.getContext('2d').drawImage(v, 0, 0);
    return c.toDataURL('image/jpeg', 0.92);
  }

  static isAvailable() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}
