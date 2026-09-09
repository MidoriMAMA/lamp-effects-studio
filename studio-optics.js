/* Screen-only LED optics. This does not change frame RGB, timing, or INO output. */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.StudioOptics = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const TAU = Math.PI * 2;
  const SPRITE_SIZE = 128;
  const CACHE_LIMIT = 128;
  const sprites = new Map();
  const bloomStops = [[0, 1], [.10, .94], [.24, .52], [.48, .13], [.75, .025], [1, 0]];
  const scatterStops = [[0, 1], [.28, .96], [.52, .72], [.70, .30], [.86, .075], [1, 0]];
  const lensStops = [[0, 1], [.65, .98], [.88, .78], [1, 0]];
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const smooth = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };
  const profile = kind => kind === 'lens' ? lensStops : kind === 'scatter' ? scatterStops : bloomStops;

  function colorAt(color, alpha) {
    return 'rgba(' + color.join(',') + ',' + alpha + ')';
  }

  function gradient(ctx, x, y, radius, color, stops) {
    const result = ctx.createRadialGradient(x, y, 0, x, y, radius);
    for (const stop of stops) result.addColorStop(stop[0], colorAt(color, stop[1]));
    return result;
  }

  function makeSurface() {
    if (typeof root.OffscreenCanvas === 'function') return new root.OffscreenCanvas(SPRITE_SIZE, SPRITE_SIZE);
    if (root.document && typeof root.document.createElement === 'function') {
      const surface = root.document.createElement('canvas');
      surface.width = surface.height = SPRITE_SIZE;
      return surface;
    }
    return null;
  }

  // Cache normalized chroma, not brightness: fading a white trail reuses one set
  // of sprites. The 128-entry cap bounds backing-store memory to about 8 MiB
  // and holds the small chroma changes caused by rounding faint cold-white RGB.
  function sprite(color, kind) {
    const quantized = color.map(v => Math.min(255, Math.round(v / 4) * 4));
    const key = kind + ':' + quantized.join(',');
    if (sprites.has(key)) {
      const found = sprites.get(key);
      sprites.delete(key);
      sprites.set(key, found);
      return found;
    }
    const surface = makeSurface();
    const local = surface && surface.getContext('2d');
    if (!local) return null;
    const center = SPRITE_SIZE / 2;
    local.fillStyle = gradient(local, center, center, center - 1, quantized, profile(kind));
    local.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    sprites.set(key, surface);
    if (sprites.size > CACHE_LIMIT) sprites.delete(sprites.keys().next().value);
    return surface;
  }

  function glow(ctx, lamp, radius, alpha, kind) {
    if (alpha <= .00001) return;
    ctx.globalAlpha = clamp(alpha, 0, 1);
    const source = lamp[kind];
    if (source) {
      ctx.drawImage(source, lamp.x - radius, lamp.y - radius, radius * 2, radius * 2);
    } else {
      // This fallback also supports a CanvasRenderingContext2D supplied by a
      // non-DOM host. Browser use takes the cached drawImage path above.
      ctx.fillStyle = gradient(ctx, lamp.x, lamp.y, radius, lamp.color, profile(kind));
      ctx.fillRect(lamp.x - radius, lamp.y - radius, radius * 2, radius * 2);
    }
  }

  /**
   * Draw light only, in the caller's current coordinate space.
   * points: physical {x,y} LED centers; frame: corresponding [r,g,b] values.
   * exposure: screen exposure, clamped to 1..8. Returns the count with peak > 8.
   * The caller draws the dark housing/layout first, and selection labels after.
   * No random sparkle, temporal persistence, positions, or frame values are added.
   */
  function draw(ctx, points, frame, exposure) {
    const gain = clamp(Number.isFinite(Number(exposure)) ? Number(exposure) : 3, 1, 8);
    const lamps = [];
    let lit = 0;
    for (let i = 0; i < points.length && i < frame.length; i++) {
      const point = points[i], pixel = frame[i];
      if (!point || !pixel || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
      const values = [0, 1, 2].map(c => Number.isFinite(pixel[c]) ? clamp(pixel[c], 0, 255) : 0);
      const peak = Math.max(...values);
      if (!peak) continue;
      if (peak > 8) lit++;
      const color = values.map(v => Math.round(v / peak * 255));
      const energy = peak / 255 * gain;
      const response = 1 - Math.exp(-energy);
      // This compact glass-scatter term switches on only for the moving head.
      // Exposure alone must not inflate faint remnants into another bright band.
      const scatterStrength = smooth((peak - 40) / 85);
      lamps.push({
        x: point.x, y: point.y, color, energy, response, scatterStrength,
        bloom: sprite(color, 'bloom'), lens: sprite(color, 'lens'),
        scatter: scatterStrength > 0 ? sprite(color, 'scatter') : null
      });
    }

    ctx.save();
    try {
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = ctx.shadowOffsetY = 0;
      ctx.shadowColor = 'rgba(0,0,0,0)';
      if ('filter' in ctx) ctx.filter = 'none';
      ctx.imageSmoothingEnabled = true;

      // Weak points have almost no atmospheric bloom; only bright groups build
      // up a common glow. Additive blending never paints darkness over a neighbor.
      for (const lamp of lamps) {
        glow(ctx, lamp, 68 + 12 * lamp.response, .14 * lamp.response * lamp.response, 'bloom');
        glow(ctx, lamp, 31 + 10 * lamp.response, .58 * (1 - Math.exp(-lamp.energy * .85)), 'bloom');
        // At 47 px spacing, two peak-140 lights at exposure 3 contribute about
        // 1.25 combined alpha at the midpoint. Their cool-white halos therefore
        // join as an overexposed patch; peak <= 40 contributes none of this term.
        glow(ctx, lamp, 39 + 5 * lamp.scatterStrength,
          lamp.scatterStrength * (1 - Math.exp(-lamp.energy * 1.7)), 'scatter');
      }

      // All bloom precedes all LED faces. A low-value LED stays a small, sharp
      // point instead of becoming a large translucent dot at the same brightness.
      for (const lamp of lamps) {
        glow(ctx, lamp, 7.7 + 3.2 * lamp.response, 1 - Math.exp(-lamp.energy * 1.6), 'lens');
      }

      for (const lamp of lamps) {
        const hot = 1 - Math.exp(-lamp.energy * .9);
        const whiten = .82 * (1 - Math.exp(-Math.max(0, lamp.energy - .12) * 1.25));
        const core = lamp.color.map(c => Math.round(c + (255 - c) * whiten));
        ctx.globalAlpha = 1 - Math.exp(-lamp.energy * 2.8);
        ctx.fillStyle = 'rgb(' + core.join(',') + ')';
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, 1.5 + 3.2 * hot, 0, TAU);
        ctx.fill();

        // A very small overexposed highlight is confined to the actual emitter.
        // The surrounding lens and halo retain the input color, including reds.
        ctx.globalAlpha = .78 * Math.pow(lamp.response, 1.65);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lamp.x, lamp.y, .75 + 1.35 * hot, 0, TAU);
        ctx.fill();
      }
    } finally {
      ctx.restore();
    }
    return lit;
  }

  return { draw, clearCache: () => sprites.clear() };
});
