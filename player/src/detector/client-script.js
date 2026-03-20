/**
 * Detector client script builder.
 *
 * Responsibilities:
 * - Generate browser-side motion detection script.
 * - Use MediaPipe Hands for gesture detection (raise, swipe).
 * - Fall back to pixel-based detection for presence.
 * - Keep detector algorithm isolated from server route logic.
 */

/**
 * Builds detector script for browser execution.
 *
 * @param {object} options - Script options.
 * @param {string} options.detectorToken - One-time detector token.
 * @param {string} options.currentState - Initial state on render.
 * @param {object} options.detectorConfig - Detector settings.
 * @returns {string} JavaScript source code.
 */
function buildDetectorClientScript({ detectorToken, currentState, detectorConfig }) {
  return `
    const detectorConfig = ${JSON.stringify(detectorConfig)};

    async function initMovementDetector() {
      const token = ${JSON.stringify(detectorToken)};
      const initialState = ${JSON.stringify(currentState)};
      const camEl = document.getElementById('movementCam');
      const dotEl = document.getElementById('movementDot');
      const statusEl = document.getElementById('movementStatus');
      const toastEl = document.getElementById('movementToast');
      if (!token || !camEl || !dotEl || !statusEl || !toastEl) return;

      function setDetectorUi(active, label) {
        dotEl.classList.toggle('active', Boolean(active));
        statusEl.textContent = label;
      }

      function showMovementToast() {
        toastEl.classList.add('visible');
        setTimeout(() => toastEl.classList.remove('visible'), 1400);
      }

      async function sendDetectorEvent(type, extra = {}) {
        await fetch('/detector/events', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-detector-token': token
          },
          body: JSON.stringify({ type, source: 'motion_detector', ...extra })
        });
      }

      /* ── Debug overlay ── */
      const debugOverlay = document.createElement('div');
      debugOverlay.id = 'detectorDebug';
      debugOverlay.style.cssText = 'position:fixed;left:14px;top:14px;z-index:25;'
        + 'width:320px;padding:10px;border-radius:10px;font-family:monospace;font-size:11px;'
        + 'background:rgba(0,0,0,0.82);color:#a5f3a0;border:1px solid rgba(100,255,100,0.25);'
        + 'pointer-events:none;line-height:1.5;display:none;';
      document.body.appendChild(debugOverlay);

      const debugCanvas = document.createElement('canvas');
      debugCanvas.style.cssText = 'width:100%;border-radius:6px;margin-bottom:6px;'
        + 'border:1px solid rgba(255,255,255,0.15);';
      debugOverlay.appendChild(debugCanvas);

      const debugText = document.createElement('pre');
      debugText.style.cssText = 'margin:0;white-space:pre-wrap;';
      debugOverlay.appendChild(debugText);

      let debugVisible = false;
      try { debugVisible = localStorage.getItem('ids_debug') === '1'; } catch(_) {}
      if (debugVisible) debugOverlay.style.display = 'block';
      document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key.toLowerCase() === 'v') {
          debugVisible = !debugVisible;
          debugOverlay.style.display = debugVisible ? 'block' : 'none';
          try { localStorage.setItem('ids_debug', debugVisible ? '1' : '0'); } catch(_) {}
        }
      });

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDetectorUi(false, 'Camera API unavailable');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15 } },
          audio: false
        }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
        camEl.srcObject = stream;
      } catch (e) {
        setDetectorUi(false, 'Camera blocked');
        return;
      }

      /* ── MediaPipe Hands initialization ── */
      let handLandmarker = null;
      let mpReady = false;

      async function initMediaPipeHands() {
        try {
          if (typeof HandLandmarker === 'undefined' || typeof FilesetResolver === 'undefined') {
            console.warn('[detector] MediaPipe not loaded from CDN — HandLandmarker or FilesetResolver missing');
            console.warn('[detector] HandLandmarker:', typeof HandLandmarker, '| FilesetResolver:', typeof FilesetResolver);
            return;
          }
          console.log('[detector] Loading MediaPipe vision WASM...');
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
          );
          console.log('[detector] WASM loaded, creating HandLandmarker...');

          /* Try GPU first, fall back to CPU */
          async function createWithDelegate(delegate) {
            return HandLandmarker.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                delegate: delegate
              },
              runningMode: 'VIDEO',
              numHands: 1,
              minHandDetectionConfidence: 0.3,
              minHandPresenceConfidence: 0.3,
              minTrackingConfidence: 0.3
            });
          }

          try {
            handLandmarker = await createWithDelegate('GPU');
            console.log('[detector] MediaPipe Hands ready (GPU)');
          } catch (gpuErr) {
            console.warn('[detector] GPU delegate failed, falling back to CPU:', gpuErr.message);
            handLandmarker = await createWithDelegate('CPU');
            console.log('[detector] MediaPipe Hands ready (CPU)');
          }
          mpReady = true;
        } catch (e) {
          console.error('[detector] MediaPipe init failed:', e);
        }
      }

      setDetectorUi(false, 'Loading hand tracking model...');

      /* Wait for the ES module to expose MediaPipe globals on window */
      if (typeof HandLandmarker === 'undefined' || typeof FilesetResolver === 'undefined') {
        console.log('[detector] Waiting for MediaPipe module to load...');
        await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('[detector] MediaPipe module load timed out after 15s');
            resolve();
          }, 15000);
          window.addEventListener('mediapipe-loaded', () => {
            clearTimeout(timeout);
            console.log('[detector] MediaPipe module loaded');
            resolve();
          }, { once: true });
        });
      }

      await initMediaPipeHands();

      /* ── Pixel-based presence detection canvas ── */
      const hiddenCanvas = document.createElement('canvas');
      const ctx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
      let lastFrame = null;
      let backgroundFrame = null;

      /* ── State variables ── */
      let lastAnalysisAt = 0;
      let lastDetectedAt = 0;
      let presenceStreak = 0;
      let handRaiseStreak = 0;
      let swipeRightStreak = 0;
      let swipeLeftStreak = 0;
      let motionStreak = 0;
      let menuReadyAt = Number.POSITIVE_INFINITY;

      /* Presence confirmation */
      let presenceFirstDetectedAt = 0;
      let presenceConfirmStreak = 0;

      /* MediaPipe hand tracking */
      let prevPalmX = null;
      let smoothedVelocity = 0;
      let handDetectedStreak = 0;

      /* Config shortcuts */
      const analyzeEveryMs = detectorConfig.analyzeEveryMs;
      const movementPixelThreshold = detectorConfig.movementPixelThreshold;
      const foregroundDeltaThreshold = detectorConfig.foregroundDeltaThreshold;
      const backgroundAlpha = detectorConfig.backgroundAlpha;
      const minPresenceRatio = detectorConfig.minPresenceRatio;
      const minPresenceBoxRatio = detectorConfig.minPresenceBoxRatio;
      const maxPresenceBoxRatio = detectorConfig.maxPresenceBoxRatio;
      const minMotionRatio = detectorConfig.minMotionRatio;
      const motionStreakRequired = detectorConfig.motionStreakRequired;
      const presenceStreakRequired = detectorConfig.presenceStreakRequired;
      const presenceConfirmGapMs = detectorConfig.presenceConfirmGapMs;
      const presenceConfirmStreakRequired = detectorConfig.presenceConfirmStreakRequired;
      const handRaiseStreakRequired = detectorConfig.handRaiseStreakRequired;
      const handDirectionStreakRequired = detectorConfig.handDirectionStreakRequired;
      const menuDecisionDelayMs = detectorConfig.menuDecisionDelayMs;
      const raiseZoneBottomRatio = detectorConfig.raiseZoneBottomRatio;
      const cooldownByEvent = detectorConfig.cooldownByEvent;
      const mirrorHandedness = detectorConfig.mirrorHandedness;

      /* Hand connections for debug skeleton drawing */
      const HAND_CONNECTIONS = [
        [0,1],[1,2],[2,3],[3,4],
        [0,5],[5,6],[6,7],[7,8],
        [0,9],[9,10],[10,11],[11,12],
        [0,13],[13,14],[14,15],[15,16],
        [0,17],[17,18],[18,19],[19,20],
        [5,9],[9,13],[13,17]
      ];

      function analyze(now) {
        if (!camEl.videoWidth || !camEl.videoHeight) {
          requestAnimationFrame(analyze);
          return;
        }

        if (now - lastAnalysisAt < analyzeEveryMs) {
          requestAnimationFrame(analyze);
          return;
        }
        lastAnalysisAt = now;

        /* ── Pixel-based presence detection (always runs) ── */
        hiddenCanvas.width = 96;
        hiddenCanvas.height = 54;
        ctx.drawImage(camEl, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        const frame = ctx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height).data;

        let presenceRatio = 0;
        let presenceBoxRatio = 0;
        let motionRatio = 0;
        let foregroundPixels = 0;

        if (lastFrame && backgroundFrame) {
          let changed = 0;
          let samples = 0;
          let minX = hiddenCanvas.width, minY = hiddenCanvas.height, maxX = -1, maxY = -1;

          for (let i = 0; i < frame.length; i += 16) {
            const pixelIndex = i / 4;
            const x = pixelIndex % hiddenCanvas.width;
            const y = Math.floor(pixelIndex / hiddenCanvas.width);

            const dr = Math.abs(frame[i] - lastFrame[i]);
            const dg = Math.abs(frame[i + 1] - lastFrame[i + 1]);
            const db = Math.abs(frame[i + 2] - lastFrame[i + 2]);
            if ((dr + dg + db) / 3 > movementPixelThreshold) changed += 1;

            const bdr = Math.abs(frame[i] - backgroundFrame[i]);
            const bdg = Math.abs(frame[i + 1] - backgroundFrame[i + 1]);
            const bdb = Math.abs(frame[i + 2] - backgroundFrame[i + 2]);
            const isForeground = (bdr + bdg + bdb) / 3 > foregroundDeltaThreshold;
            if (isForeground) {
              foregroundPixels += 1;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            } else {
              backgroundFrame[i] = Math.round(backgroundFrame[i] * (1 - backgroundAlpha) + frame[i] * backgroundAlpha);
              backgroundFrame[i + 1] = Math.round(backgroundFrame[i + 1] * (1 - backgroundAlpha) + frame[i + 1] * backgroundAlpha);
              backgroundFrame[i + 2] = Math.round(backgroundFrame[i + 2] * (1 - backgroundAlpha) + frame[i + 2] * backgroundAlpha);
            }
            samples += 1;
          }

          presenceRatio = samples > 0 ? foregroundPixels / samples : 0;
          motionRatio = samples > 0 ? changed / samples : 0;
          if (foregroundPixels > 0 && maxX >= minX && maxY >= minY) {
            presenceBoxRatio = ((maxX - minX + 1) * (maxY - minY + 1)) / (hiddenCanvas.width * hiddenCanvas.height);
          }
        } else {
          lastFrame = frame;
          backgroundFrame = frame.slice();
          setDetectorUi(false, mpReady ? 'Hand tracking ready' : 'Watching for movement...');
          requestAnimationFrame(analyze);
          return;
        }

        /* Presence streaks from pixel analysis */
        const hasForegroundPresence = presenceRatio >= minPresenceRatio
          && presenceBoxRatio >= minPresenceBoxRatio
          && presenceBoxRatio <= maxPresenceBoxRatio;
        if (motionRatio >= minMotionRatio) motionStreak += 1;
        else motionStreak = Math.max(0, motionStreak - 1);
        const hasMotionPresence = motionStreak >= motionStreakRequired;
        const hasPresence = hasForegroundPresence || hasMotionPresence;
        if (hasPresence) presenceStreak += 1;
        else presenceStreak = Math.max(0, presenceStreak - 1);

        /* ── MediaPipe hand landmark detection ── */
        let mpLandmarks = null;
        let mpHandedness = null;
        let wristY = -1;
        let palmX = -1;
        let swipeDx = 0;
        let handRaised = false;

        if (mpReady && handLandmarker) {
          try {
            const results = handLandmarker.detectForVideo(camEl, performance.now());
            if (results.landmarks && results.landmarks.length > 0) {
              mpLandmarks = results.landmarks[0];
              mpHandedness = results.handednesses && results.handednesses[0]
                ? results.handednesses[0][0].displayName : 'Unknown';

              const wrist = mpLandmarks[0];
              const indexMcp = mpLandmarks[5];
              const middleMcp = mpLandmarks[9];
              const ringMcp = mpLandmarks[13];
              const pinkyMcp = mpLandmarks[17];

              wristY = wrist.y;
              palmX = (wrist.x + indexMcp.x + middleMcp.x + ringMcp.x + pinkyMcp.x) / 5;

              /* Hand raise: wrist in upper portion of frame */
              handRaised = wristY < raiseZoneBottomRatio;
              if (handRaised) handRaiseStreak += 1;
              else handRaiseStreak = Math.max(0, handRaiseStreak - 1);

              /* Swipe: smoothed palm X velocity between frames */
              if (prevPalmX !== null) {
                const rawDx = palmX - prevPalmX;
                smoothedVelocity = smoothedVelocity * 0.2 + rawDx * 0.8;
                swipeDx = smoothedVelocity;
                const swipeThreshold = 0.008;
                if (swipeDx > swipeThreshold) {
                  swipeRightStreak += 1;
                  swipeLeftStreak = 0;
                } else if (swipeDx < -swipeThreshold) {
                  swipeLeftStreak += 1;
                  swipeRightStreak = 0;
                } else {
                  swipeRightStreak = Math.max(0, swipeRightStreak - 1);
                  swipeLeftStreak = Math.max(0, swipeLeftStreak - 1);
                }
              }
              prevPalmX = palmX;

              handDetectedStreak += 1;
            } else {
              /* No hand visible */
              handRaiseStreak = Math.max(0, handRaiseStreak - 1);
              swipeRightStreak = Math.max(0, swipeRightStreak - 1);
              swipeLeftStreak = Math.max(0, swipeLeftStreak - 1);
              prevPalmX = null;
              smoothedVelocity = 0;
              handDetectedStreak = 0;
            }
          } catch (e) {
            /* MediaPipe frame error — skip silently */
          }
        }

        /* ── State-based event logic ── */
        let eventType = null;
        let detectorLabel = mpReady ? 'Hand tracking active' : 'Watching for movement...';
        let handSide = null;

        let currentState = initialState;
        const liveStateElement = document.querySelector('.state');
        if (liveStateElement) {
          currentState = String(liveStateElement.textContent || '').trim().toUpperCase();
        }

        if (currentState === 'IDLE') {
          menuReadyAt = Number.POSITIVE_INFINITY;

          /* Two-phase presence confirmation (pixel-based) */
          if (presenceStreak >= presenceStreakRequired) {
            if (presenceFirstDetectedAt === 0) {
              presenceFirstDetectedAt = now;
              presenceConfirmStreak = 0;
              detectorLabel = 'Presence sensed, confirming...';
            } else if (now - presenceFirstDetectedAt >= presenceConfirmGapMs) {
              presenceConfirmStreak += 1;
              if (presenceConfirmStreak >= presenceConfirmStreakRequired) {
                eventType = 'movement_detected';
                detectorLabel = 'Presence confirmed';
                presenceFirstDetectedAt = 0;
                presenceConfirmStreak = 0;
              } else {
                detectorLabel = 'Confirming (' + presenceConfirmStreak + '/' + presenceConfirmStreakRequired + ')...';
              }
            } else {
              detectorLabel = 'Presence sensed, hold still...';
            }
          } else {
            presenceFirstDetectedAt = 0;
            presenceConfirmStreak = 0;
            detectorLabel = 'Waiting for presence';
          }
        } else if (currentState === 'MENU') {
          presenceFirstDetectedAt = 0;
          presenceConfirmStreak = 0;
          if (!Number.isFinite(menuReadyAt)) {
            menuReadyAt = now + menuDecisionDelayMs;
          }
          if (now < menuReadyAt) {
            detectorLabel = 'Raise your hand to continue...';
          } else if (handRaiseStreak >= handRaiseStreakRequired) {
            eventType = 'visitor_selected';
            detectorLabel = 'Hand raised — selecting visitor';
          } else {
            detectorLabel = mpLandmarks
              ? 'Hand seen (wristY: ' + wristY.toFixed(2) + ') — raise higher!'
              : 'Raise your hand to continue...';
          }
        } else if (currentState === 'VISITOR_INFO' || currentState === 'STUDENT_INFO') {
          presenceFirstDetectedAt = 0;
          presenceConfirmStreak = 0;
          menuReadyAt = Number.POSITIVE_INFINITY;

          const swipeRight = swipeRightStreak >= handDirectionStreakRequired;
          const swipeLeft = swipeLeftStreak >= handDirectionStreakRequired;
          if (swipeRight) {
            eventType = mirrorHandedness ? 'scroll_prev' : 'scroll_next';
            handSide = mirrorHandedness ? 'left' : 'right';
            detectorLabel = 'Swipe right -> ' + (mirrorHandedness ? 'prev' : 'next');
          } else if (swipeLeft) {
            eventType = mirrorHandedness ? 'scroll_next' : 'scroll_prev';
            handSide = mirrorHandedness ? 'right' : 'left';
            detectorLabel = 'Swipe left -> ' + (mirrorHandedness ? 'next' : 'prev');
          } else if (mpLandmarks) {
            detectorLabel = 'Hand tracked — swipe L/R to scroll';
          } else {
            detectorLabel = 'Show your hand, then swipe L/R';
          }
        }

        /* ── Fire event ── */
        if (eventType) {
          const eventCooldownMs = cooldownByEvent[eventType] || 900;
          const inCooldown = now - lastDetectedAt < eventCooldownMs;
          if (!inCooldown) {
            lastDetectedAt = now;
            setDetectorUi(true, detectorLabel);
            showMovementToast();
            sendDetectorEvent(eventType, {
              confidence: mpLandmarks ? 0.9 : Number(presenceRatio.toFixed(3)),
              direction: handSide,
              handSide,
            }).catch(() => {
              setDetectorUi(false, 'Detector event failed');
            });
            handRaiseStreak = 0;
            swipeRightStreak = 0;
            swipeLeftStreak = 0;
            smoothedVelocity = 0;
          }
        } else {
          setDetectorUi(false, detectorLabel);
        }

        /* ── Hand tracker overlay (always visible on cam widget) ── */
        const htCanvas = document.getElementById('handTrackerCanvas');
        if (htCanvas && camEl.videoWidth) {
          const htCtx = htCanvas.getContext('2d');
          htCanvas.width = camEl.videoWidth || 320;
          htCanvas.height = camEl.videoHeight || 240;
          htCtx.clearRect(0, 0, htCanvas.width, htCanvas.height);
          const HW = htCanvas.width;
          const HH = htCanvas.height;

          if (mpLandmarks) {
            /* Draw connections */
            htCtx.strokeStyle = '#00ff00';
            htCtx.lineWidth = 2;
            for (const [a, b] of HAND_CONNECTIONS) {
              const la = mpLandmarks[a];
              const lb = mpLandmarks[b];
              htCtx.beginPath();
              htCtx.moveTo(la.x * HW, la.y * HH);
              htCtx.lineTo(lb.x * HW, lb.y * HH);
              htCtx.stroke();
            }
            /* Draw landmark dots */
            for (let li = 0; li < mpLandmarks.length; li++) {
              const lm = mpLandmarks[li];
              htCtx.fillStyle = li === 0 ? '#ff4444' : '#44ff44';
              htCtx.beginPath();
              htCtx.arc(lm.x * HW, lm.y * HH, li === 0 ? 5 : 3, 0, Math.PI * 2);
              htCtx.fill();
            }
            /* Palm centroid */
            htCtx.fillStyle = '#ffff00';
            htCtx.beginPath();
            htCtx.arc(palmX * HW, wristY * HH, 6, 0, Math.PI * 2);
            htCtx.fill();
          }

          /* Raise zone line */
          htCtx.strokeStyle = 'rgba(0, 255, 255, 0.5)';
          htCtx.lineWidth = 1;
          htCtx.setLineDash([4, 4]);
          const raiseLineY = Math.round(raiseZoneBottomRatio * HH);
          htCtx.beginPath();
          htCtx.moveTo(0, raiseLineY);
          htCtx.lineTo(HW, raiseLineY);
          htCtx.stroke();
          htCtx.setLineDash([]);

          /* Status text on tracker */
          htCtx.font = '10px monospace';
          htCtx.fillStyle = mpReady ? (mpLandmarks ? '#44ff44' : '#ffaa00') : '#ff4444';
          const statusTxt = !mpReady ? 'MP: OFF' : (mpLandmarks ? 'TRACKING' : 'NO HAND');
          htCtx.fillText(statusTxt, 4, HH - 4);
        }

        /* ── Debug overlay ── */
        if (debugVisible) {
          const dCtx = debugCanvas.getContext('2d');
          debugCanvas.width = camEl.videoWidth || 320;
          debugCanvas.height = camEl.videoHeight || 240;
          dCtx.drawImage(camEl, 0, 0, debugCanvas.width, debugCanvas.height);

          const W = debugCanvas.width;
          const H = debugCanvas.height;

          /* Raise zone — cyan */
          dCtx.globalAlpha = 0.2;
          dCtx.fillStyle = '#00ffff';
          dCtx.fillRect(0, 0, W, Math.round(raiseZoneBottomRatio * H));
          dCtx.globalAlpha = 1.0;
          dCtx.font = '12px monospace';
          dCtx.fillStyle = '#00ffff';
          dCtx.fillText('RAISE ZONE', 4, 14);

          /* Draw hand skeleton if available */
          if (mpLandmarks) {
            /* Connections */
            dCtx.strokeStyle = '#00ff00';
            dCtx.lineWidth = 2;
            for (const [a, b] of HAND_CONNECTIONS) {
              const la = mpLandmarks[a];
              const lb = mpLandmarks[b];
              dCtx.beginPath();
              dCtx.moveTo(la.x * W, la.y * H);
              dCtx.lineTo(lb.x * W, lb.y * H);
              dCtx.stroke();
            }

            /* Landmark dots */
            for (let li = 0; li < mpLandmarks.length; li++) {
              const lm = mpLandmarks[li];
              dCtx.fillStyle = li === 0 ? '#ff0000' : '#00ff00';
              dCtx.beginPath();
              dCtx.arc(lm.x * W, lm.y * H, li === 0 ? 5 : 3, 0, Math.PI * 2);
              dCtx.fill();
            }

            /* Palm centroid marker */
            dCtx.fillStyle = '#ffff00';
            dCtx.beginPath();
            dCtx.arc(palmX * W, wristY * H, 6, 0, Math.PI * 2);
            dCtx.fill();
          }

          debugText.textContent =
            'STATE: ' + currentState
            + '  |  MP: ' + (mpReady ? 'ON' : 'OFF')
            + '  |  hand: ' + (mpLandmarks ? mpHandedness : 'none') + '\\n'
            + '--- Presence (pixel) ---\\n'
            + 'fgRatio:   ' + presenceRatio.toFixed(3) + ' (min ' + minPresenceRatio + ')\\n'
            + 'boxRatio:  ' + presenceBoxRatio.toFixed(3) + '\\n'
            + 'presStrk:  ' + presenceStreak + '/' + presenceStreakRequired + '\\n'
            + 'confStrk:  ' + presenceConfirmStreak + '/' + presenceConfirmStreakRequired + '\\n'
            + '--- Hand (MediaPipe) ---\\n'
            + 'wristY:    ' + (wristY >= 0 ? wristY.toFixed(3) : '-') + ' (raise < ' + raiseZoneBottomRatio + ')\\n'
            + 'palmX:     ' + (palmX >= 0 ? palmX.toFixed(3) : '-') + '\\n'
            + 'velocity:  ' + (smoothedVelocity !== 0 ? smoothedVelocity.toFixed(4) : '-') + ' (thr 0.008)\\n'
            + 'swipeDx:   ' + (swipeDx !== 0 ? swipeDx.toFixed(4) : '-') + '\\n'
            + 'raiseStrk: ' + handRaiseStreak + '/' + handRaiseStreakRequired + '\\n'
            + 'swipeL:    ' + swipeLeftStreak + '/' + handDirectionStreakRequired + '\\n'
            + 'swipeR:    ' + swipeRightStreak + '/' + handDirectionStreakRequired + '\\n'
            + 'mirror:    ' + mirrorHandedness + '\\n'
            + '--- Event ---\\n'
            + 'event:     ' + (eventType || 'none') + '\\n'
            + 'label:     ' + detectorLabel;
        }

        lastFrame = frame;
        requestAnimationFrame(analyze);
      }

      requestAnimationFrame(analyze);
    }

    initMovementDetector();
  `;
}

module.exports = {
  buildDetectorClientScript,
};
