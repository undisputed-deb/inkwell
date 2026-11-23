/* Demo-grade face matcher (UC-03). A face photo becomes a 16x16 grayscale signature;
   login picks the enrolled user with the highest correlation, or nobody.
   Samples never leave the browser (R15.1). NOT secure: a real build would use a trained model. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.Inkwell = root.Inkwell || {}).Biometric = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GRID = 16;
  const ACCEPT = 0.9; // minimum correlation to count as a match

  /** gray: array-like of brightness values, row-major, w*h long. */
  function signature(gray, w, h) {
    const out = new Float32Array(GRID * GRID);
    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const x0 = Math.floor((gx * w) / GRID), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / GRID));
        const y0 = Math.floor((gy * h) / GRID), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / GRID));
        let sum = 0, n = 0;
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += gray[y * w + x]; n++; }
        out[gy * GRID + gx] = sum / n;
      }
    }
    const mean = out.reduce((a, b) => a + b, 0) / out.length;
    const centred = out.map(v => v - mean);
    const norm = Math.sqrt(centred.reduce((a, b) => a + b * b, 0)) || 1;
    return Array.from(centred, v => v / norm); // plain array so it survives JSON/localStorage
  }

  const similarity = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);

  function nearest(sig, users) {
    let best = null;
    for (const u of users) {
      if (!u.sample) continue;
      const score = similarity(sig, u.sample);
      if (score >= ACCEPT && (!best || score > best.score)) best = { id: u.id, score };
    }
    return best;
  }

  /** Browser-only: grab one grayscale frame from a <video>. */
  function frameSignature(video) {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const side = Math.min(video.videoWidth, video.videoHeight); // centre square crop
    ctx.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    const gray = new Float32Array(size * size);
    for (let i = 0; i < gray.length; i++) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    return signature(gray, size, size);
  }

  return { signature, similarity, nearest, frameSignature, ACCEPT };
});
