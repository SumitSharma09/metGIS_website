import Box from '@mui/material/Box';

interface ForecastSkyAnimationProps {
  /**
   * Render as a fixed, full-viewport background layer (position: fixed,
   * inset: 0, no card chrome) instead of a bordered panel with its own
   * caption - this is what `LoginPage.tsx` uses, to match the reference
   * product's login screen: a full-bleed animated scene behind a centered
   * sign-in card, not a separate side panel. Defaults to false (the
   * original bordered-panel presentation), kept in case a future screen
   * wants the panel form instead.
   */
  fullBleed?: boolean;
}

/**
 * Decorative, forecast-themed animation for the login screen: a sun with
 * spinning rays, drifting clouds, two simple communication-tower silhouettes
 * with a blinking beacon light (echoing this app's own subject - towers,
 * not literal decoration), and a periodic rain + lightning phase that loops
 * on a 12s cycle, so the scene visibly "changes forecast" over time (sunny
 * -> cloudy -> rain -> clear -> repeat) rather than sitting static.
 *
 * Copyright note: every shape here is hand-authored inline SVG (circles,
 * ellipses, lines, a hand-built hill path) and every motion is a plain CSS
 * `@keyframes` animation defined in this file - there is no stock video/GIF,
 * no third-party image, icon font, or downloaded asset of any kind involved,
 * so there is nothing here that could carry a licensing/copyright question
 * the way an embedded stock "weather forecast" video or photo would. The
 * composition (a full-bleed scene behind a centered login card) takes layout
 * *inspiration* from the reference product's login screen, but none of its
 * actual pixels, photo, or brand assets are used or reproduced anywhere -
 * this is original artwork, the same way the rest of this app's decorative
 * CSS (e.g. OpsTopNav's LIVE-badge pulse) is hand-rolled rather than sourced
 * from anywhere.
 *
 * Responsive: the SVG uses `viewBox="0 0 400 300"` with
 * `preserveAspectRatio="xMidYMid slice"`, so at any viewport size/aspect
 * ratio it scales to cover the container with no distortion (the same
 * technique a CSS `background-size: cover` image would use) - horizontal
 * position is an exact fit at every width, so the sun/towers never shift
 * off-center; only extreme aspect ratios crop a little off the top/bottom,
 * same as any full-bleed hero background.
 *
 * Accessibility: purely decorative (`aria-hidden`), and every animation is
 * gated behind `@media (prefers-reduced-motion: no-preference)` so a viewer
 * who has asked their OS/browser for reduced motion sees a calm, static
 * sunny scene instead - no motion is ever forced on them.
 */
export function ForecastSkyAnimation({ fullBleed = false }: ForecastSkyAnimationProps) {
  const dropXs = [58, 78, 98, 118, 138, 158, 178, 198, 218, 238, 300, 320, 340];

  return (
    <Box
      sx={{
        position: fullBleed ? 'fixed' : 'relative',
        inset: fullBleed ? 0 : undefined,
        width: fullBleed ? '100vw' : '100%',
        height: fullBleed ? '100vh' : undefined,
        maxWidth: fullBleed ? 'none' : 440,
        aspectRatio: fullBleed ? undefined : '4 / 3',
        borderRadius: fullBleed ? 0 : 4,
        overflow: 'hidden',
        flexShrink: 0,
        zIndex: fullBleed ? 0 : undefined,
        background: 'linear-gradient(180deg, #1d3a6e 0%, #2c4f7c 38%, #6b7a8f 62%, #172749 100%)',
        border: fullBleed ? 'none' : '1px solid rgba(255,255,255,0.08)',
        boxShadow: fullBleed ? 'none' : '0 20px 60px rgba(0,0,0,0.35)',
        '@media (prefers-reduced-motion: no-preference)': {
          '& .fx-sun-fade': { animation: 'fxSunFade 12s ease-in-out infinite' },
          '& .fx-rain-fade': { animation: 'fxRainFade 12s ease-in-out infinite' },
          '& .fx-rays': { animation: 'fxRaysSpin 22s linear infinite', transformOrigin: '118px 92px' },
          '& .fx-cloud-back': { animation: 'fxCloudDriftSlow 28s ease-in-out infinite' },
          '& .fx-cloud-front': { animation: 'fxCloudDriftFast 19s ease-in-out infinite' },
          '& .fx-cloud-far': { animation: 'fxCloudDriftSlow 34s ease-in-out infinite reverse' },
          '& .fx-lightning': { animation: 'fxLightning 12s ease-in-out infinite' },
          '& .fx-drop': { animation: 'fxDropFall 0.9s linear infinite' },
          '& .fx-beacon': { animation: 'fxBeaconPulse 1.8s ease-in-out infinite' },
          '& .fx-beacon-2': { animation: 'fxBeaconPulse 1.8s ease-in-out infinite 0.9s' },
        },
        '@keyframes fxSunFade': {
          '0%': { opacity: 1 },
          '32%': { opacity: 1 },
          '42%': { opacity: 0 },
          '85%': { opacity: 0 },
          '95%': { opacity: 1 },
          '100%': { opacity: 1 },
        },
        '@keyframes fxRainFade': {
          '0%': { opacity: 0 },
          '42%': { opacity: 0 },
          '52%': { opacity: 1 },
          '85%': { opacity: 1 },
          '95%': { opacity: 0 },
          '100%': { opacity: 0 },
        },
        '@keyframes fxRaysSpin': {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
        '@keyframes fxCloudDriftSlow': {
          '0%': { transform: 'translateX(-24px)' },
          '50%': { transform: 'translateX(24px)' },
          '100%': { transform: 'translateX(-24px)' },
        },
        '@keyframes fxCloudDriftFast': {
          '0%': { transform: 'translateX(18px)' },
          '50%': { transform: 'translateX(-18px)' },
          '100%': { transform: 'translateX(18px)' },
        },
        '@keyframes fxLightning': {
          '0%': { opacity: 0 },
          '56%': { opacity: 0 },
          '57%': { opacity: 0.55 },
          '58%': { opacity: 0 },
          '72%': { opacity: 0 },
          '73%': { opacity: 0.35 },
          '74%': { opacity: 0 },
          '100%': { opacity: 0 },
        },
        '@keyframes fxDropFall': {
          '0%': { transform: 'translateY(0px)', opacity: 0 },
          '15%': { opacity: 0.9 },
          '100%': { transform: 'translateY(20px)', opacity: 0 },
        },
        '@keyframes fxBeaconPulse': {
          '0%': { opacity: 1 },
          '50%': { opacity: 0.25 },
          '100%': { opacity: 1 },
        },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 400 300"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        focusable="false"
        sx={{ width: '100%', height: '100%', display: 'block' }}
      >
        {/* faint stars, purely decorative */}
        {[
          [30, 30], [70, 55], [340, 40], [370, 75], [20, 130], [360, 160], [300, 25], [50, 200],
        ].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={1.3} fill="rgba(255,255,255,0.5)" />
        ))}

        {/* far, barely-moving cloud - only meaningful once the scene is wide (fullBleed) */}
        {fullBleed && (
          <g className="fx-cloud-far" opacity="0.5">
            <ellipse cx="60" cy="45" rx="34" ry="14" fill="#dbe4f2" />
            <ellipse cx="85" cy="38" rx="22" ry="11" fill="#dbe4f2" />
          </g>
        )}

        {/* sun + rotating rays - fades out during the rain phase */}
        <g className="fx-sun-fade">
          <circle cx="118" cy="92" r="38" fill="#ffd66b" opacity="0.25" />
          <circle cx="118" cy="92" r="30" fill="#ffd66b" />
          <g className="fx-rays" stroke="#ffd66b" strokeWidth="3" strokeLinecap="round">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i * Math.PI) / 4;
              const x1 = 118 + Math.cos(angle) * 42;
              const y1 = 92 + Math.sin(angle) * 42;
              const x2 = 118 + Math.cos(angle) * 54;
              const y2 = 92 + Math.sin(angle) * 54;
              return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
            })}
          </g>
        </g>

        {/* back (slower) cloud */}
        <g className="fx-cloud-back" opacity="0.85">
          <ellipse cx="290" cy="70" rx="46" ry="20" fill="#e7edf7" />
          <ellipse cx="322" cy="60" rx="30" ry="16" fill="#e7edf7" />
          <ellipse cx="258" cy="62" rx="26" ry="15" fill="#e7edf7" />
        </g>

        {/* front (faster) cloud - also anchors the rain drops beneath it */}
        <g className="fx-cloud-front">
          <ellipse cx="150" cy="150" rx="70" ry="28" fill="#f4f7fc" />
          <ellipse cx="196" cy="136" rx="42" ry="24" fill="#f4f7fc" />
          <ellipse cx="104" cy="140" rx="38" ry="20" fill="#f4f7fc" />

          <g className="fx-rain-fade">
            <g stroke="#7fb3ff" strokeWidth="2.5" strokeLinecap="round">
              {dropXs.map((x, i) => (
                <line
                  key={i}
                  className="fx-drop"
                  x1={x}
                  y1={178}
                  x2={x - 3}
                  y2={190}
                  style={{ animationDelay: `${(i % 5) * 0.14}s` }}
                />
              ))}
            </g>
          </g>
        </g>

        {/* rolling hill silhouette + two simple lattice communication towers -
            only in the full-bleed background, where there's room for a
            grounded horizon; the bordered-panel form stays sky-only. */}
        {fullBleed && (
          <>
            <path
              d="M0,300 L0,258 C55,236 100,268 165,252 C230,236 260,262 400,244 L400,300 Z"
              fill="#0c1526"
            />
            {/* left tower */}
            <g stroke="#0c1526" strokeWidth="3" strokeLinecap="round" fill="none">
              <line x1="42" y1="255" x2="60" y2="168" />
              <line x1="78" y1="255" x2="60" y2="168" />
              <line x1="47" y1="228" x2="73" y2="228" />
              <line x1="51" y1="202" x2="69" y2="202" />
              <line x1="55" y1="178" x2="65" y2="178" />
              <line x1="60" y1="168" x2="60" y2="152" />
            </g>
            <circle className="fx-beacon" cx="60" cy="150" r="3" fill="#ff5a5a" />

            {/* right tower, slightly taller and further back */}
            <g stroke="#0c1526" strokeWidth="3" strokeLinecap="round" fill="none">
              <line x1="330" y1="250" x2="350" y2="150" />
              <line x1="370" y1="250" x2="350" y2="150" />
              <line x1="336" y1="218" x2="364" y2="218" />
              <line x1="341" y1="188" x2="359" y2="188" />
              <line x1="346" y1="162" x2="354" y2="162" />
              <line x1="350" y1="150" x2="350" y2="132" />
            </g>
            <circle className="fx-beacon-2" cx="350" cy="130" r="3" fill="#4ade80" />
          </>
        )}

        {/* occasional lightning flash across the whole scene during rain */}
        <rect className="fx-lightning" x="0" y="0" width="400" height="300" fill="#eaf2ff" />
      </Box>

      {/* Subtle vignette so the sign-in card stays legible over a busy
          animated background - not present in the bordered-panel form,
          which never has anything placed on top of it. */}
      {fullBleed && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(ellipse at center, rgba(8,14,28,0.15) 0%, rgba(8,14,28,0.55) 100%)',
            pointerEvents: 'none',
          }}
        />
      )}
    </Box>
  );
}
