import { useEffect, useMemo, useRef } from 'react';
import { useMap } from 'react-leaflet';
import type { Site } from '@/features/sites/types';
import type { CurrentObservation } from '@/features/weather/types';
import { buildWindSamples, interpolateWind, windSpeedColor, type WindSample } from '../windField';
import { isInsideIndia, randomPointInIndia } from '../indiaBoundary';
import { buildStateBoundary, type BoundaryCheck } from '../stateBoundaryGeometry';
import type { DistrictFeature } from '../districtGeo';

const INDIA_BOUNDARY: BoundaryCheck = { isInside: isInsideIndia, randomPoint: randomPointInIndia };

interface WindFlowLayerProps {
  sites: Site[];
  observations: Record<string, CurrentObservation>;
  enabled: boolean;
  /** The selected state's own real boundary polygon(s) (LiveMapPage's
   *  `selectedStateFeatures` - two features for a combined circle). When
   *  provided (a state is picked), the flow field is confined to just this
   *  state's edge instead of the whole country. `sites`/`observations` are
   *  already state-scoped by the caller, but without also clipping the
   *  particle field itself, the inverse-distance interpolation
   *  (windField.ts) has no reason to stop at the state's edge and keeps
   *  extrapolating that one state's samples across the entire visible map -
   *  which reads as every state's wind flowing when only one actually has
   *  real data behind it. Omit (or pass an empty array) for the nationwide
   *  view, which falls back to the whole-India boundary as before. */
  boundaryFeatures?: DistrictFeature[];
}

// Matches the reference product's look (Skymet's wind layer) - a dense,
// fine hair-like streak texture covering the whole area, not a sparse
// scatter of big comet-tailed arrows. That means far more, much shorter and
// thinner strokes than this layer originally drew - see PARTICLE_COUNT,
// STROKE_WIDTH and TRAIL_FADE below.
const PARTICLE_COUNT = 1800;
const BASE_PX_PER_SEC = 70; // screen speed of a particle riding a REF_SPEED_KMH wind
const REF_SPEED_KMH = 20;
const MIN_PX_PER_SEC = 18; // even "calm" air drifts a little, so it still reads as flow
const MAX_PX_PER_SEC = 200;
const MIN_LIFE_S = 1.2;
const MAX_LIFE_S = 2.4;
const TRAIL_FADE = 0.86; // per-frame alpha retention - lower = shorter, dash-like trails
const STROKE_WIDTH = 1.1; // thin hairline, like the reference's fine streak texture

interface Particle {
  lat: number;
  lon: number;
  age: number;
  maxAge: number;
}

/**
 * Canvas overlay that animates a continuous wind-flow field over Indian
 * territory, matching Skymet's own reference product's look - a dense,
 * fine texture of short hairline streaks drifting in the local wind
 * direction, colored by speed, rather than a sparse scatter of large arrow
 * icons. Each "particle" is really just one short moving line segment with
 * a fast-fading trail (PARTICLE_COUNT of them at once), so the field reads
 * as a continuous, almost fabric-like flow rather than individually
 * trackable comets.
 *
 * Since real wind data only exists at ~20-25 monitored sites (not a dense
 * weather-model grid), the field in between is inverse-distance-weighted
 * interpolation (`windField.ts`) - a visual approximation that gets less
 * trustworthy far from any monitored site, not a measured value.
 *
 * Particles are confined to a real boundary, not the full map canvas - the
 * reference product's texture covers the whole viewport (including
 * neighbouring countries and ocean when zoomed out), but this app only has
 * data/attribution for Indian territory, so both spawning and per-frame
 * movement are clipped. Nationwide (no state picked) that boundary is
 * India's national outline (`indiaBoundary.ts`); once a state is picked,
 * `boundaryFeatures` narrows it to just that state's own real polygon
 * (`stateBoundaryGeometry.ts`) - see that prop's own doc comment for why
 * that additionally matters here (not just a tighter crop).
 *
 * Renders in screen-pixel space (re-projecting each particle's stored
 * lat/lon through the map's current view every frame) so it stays correct
 * across pan/zoom without needing separate move/zoom-event bookkeeping,
 * and reads at a consistent visual speed at any zoom level.
 */
export function WindFlowLayer({ sites, observations, enabled, boundaryFeatures }: WindFlowLayerProps) {
  const map = useMap();
  const particlesRef = useRef<Particle[]>([]);
  const samples = useMemo(() => buildWindSamples(sites, observations), [sites, observations]);
  const samplesRef = useRef<WindSample[]>(samples);
  samplesRef.current = samples;

  // Same "keep the running animation in place" pattern as samplesRef below -
  // picking a state changes the boundary without tearing down the canvas or
  // resetting every particle's trail; particles that land outside the new,
  // narrower boundary on their very next step get respawned inside it within
  // a frame or two via the same `leftBoundary` check spawning already used.
  const boundary = useMemo(
    () => buildStateBoundary(boundaryFeatures ?? []) ?? INDIA_BOUNDARY,
    [boundaryFeatures]
  );
  const boundaryRef = useRef<BoundaryCheck>(boundary);
  boundaryRef.current = boundary;

  useEffect(() => {
    if (!enabled) return undefined;

    const container = map.getContainer();
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '450'; // above tiles/polygons, below Leaflet's own controls (>1000) and popups
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const size = map.getSize();
      canvas.width = size.x * dpr;
      canvas.height = size.y * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A fresh canvas is blank - respawn everyone so trails don't start
      // as a single frozen frame stretched across the new dimensions.
      particlesRef.current = spawnAll(size.x, size.y);
    }

    function randomParticleAt(xPx: number, yPx: number): Particle {
      const ll = map.containerPointToLatLng([xPx, yPx]);
      // A screen pixel chosen at random may land outside the active boundary
      // (the visible viewport usually extends past it, more so once a
      // single state is the boundary) - fall back to a random point
      // actually inside it rather than spawning one that would immediately
      // get clipped, so particle density stays even instead of thinning out
      // near the edge.
      const active = boundaryRef.current;
      const { lat, lon } = active.isInside(ll.lat, ll.lng) ? { lat: ll.lat, lon: ll.lng } : active.randomPoint();
      return { lat, lon, age: Math.random() * MAX_LIFE_S, maxAge: MIN_LIFE_S + Math.random() * (MAX_LIFE_S - MIN_LIFE_S) };
    }

    function spawnAll(width: number, height: number): Particle[] {
      return Array.from({ length: PARTICLE_COUNT }, () => randomParticleAt(Math.random() * width, Math.random() * height));
    }

    resize();
    map.on('resize', resize);

    let raf = 0;
    let lastT = performance.now();

    function frame(t: number) {
      const dt = Math.min(0.05, (t - lastT) / 1000); // clamp so a dropped/backgrounded frame doesn't fling particles
      lastT = t;
      const size = map.getSize();

      // Fade existing trails (destination-in multiplies existing alpha,
      // leaving untouched/transparent areas alone - the basemap underneath
      // is never tinted, only the particle strokes themselves fade).
      ctx!.globalCompositeOperation = 'destination-in';
      ctx!.fillStyle = `rgba(0,0,0,${TRAIL_FADE})`;
      ctx!.fillRect(0, 0, size.x, size.y);
      ctx!.globalCompositeOperation = 'source-over';

      const currentSamples = samplesRef.current;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        const screenOld = map.latLngToContainerPoint([p.lat, p.lon]);

        const { u, v } = interpolateWind(p.lat, p.lon, currentSamples);
        const speed = Math.hypot(u, v);
        const pxPerSec = clamp(BASE_PX_PER_SEC * (speed / REF_SPEED_KMH), MIN_PX_PER_SEC, MAX_PX_PER_SEC);
        const inv = speed > 1e-3 ? 1 / speed : 0;
        const dx = u * inv * pxPerSec * dt;
        const dy = -v * inv * pxPerSec * dt; // screen y grows downward; north (+v) is up

        const screenNew = { x: screenOld.x + dx, y: screenOld.y + dy };
        p.age += dt;

        const offscreen = screenNew.x < -20 || screenNew.y < -20 || screenNew.x > size.x + 20 || screenNew.y > size.y + 20;
        // Only project+check boundary-containment when it's not already
        // offscreen, since that's the common case and containerPointToLatLng
        // isn't free.
        const llNew = offscreen ? null : map.containerPointToLatLng([screenNew.x, screenNew.y]);
        const leftBoundary = llNew ? !boundaryRef.current.isInside(llNew.lat, llNew.lng) : false;

        if (p.age >= p.maxAge || offscreen || leftBoundary || currentSamples.length === 0) {
          particles[i] = randomParticleAt(Math.random() * size.x, Math.random() * size.y);
          continue;
        }

        p.lat = llNew!.lat;
        p.lon = llNew!.lng;

        // Fade in over the first ~15% of life and out over the last ~25%,
        // so particles don't pop in/out abruptly.
        const lifeFrac = p.age / p.maxAge;
        const fade = lifeFrac < 0.15 ? lifeFrac / 0.15 : lifeFrac > 0.75 ? (1 - lifeFrac) / 0.25 : 1;

        const alpha = Math.max(0, Math.min(1, fade));

        ctx!.strokeStyle = windSpeedColor(speed, alpha);
        ctx!.lineWidth = STROKE_WIDTH;
        ctx!.lineCap = 'round';
        ctx!.beginPath();
        ctx!.moveTo(screenOld.x, screenOld.y);
        ctx!.lineTo(screenNew.x, screenNew.y);
        ctx!.stroke();
      }

      raf = requestAnimationFrame(frame);
    }

    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      map.off('resize', resize);
      container.removeChild(canvas);
    };
    // Deliberately excludes `samples`/`boundary` - both handled via refs so
    // a new observation snapshot or a state pick/clear updates the running
    // animation in place instead of restarting it (which would reset every
    // particle's trail and cause a visible flicker on every state change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, map]);

  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
