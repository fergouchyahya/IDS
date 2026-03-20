/**
 * Detector client script builder.
 *
 * Responsibilities:
 * - Generate browser-side motion detection script.
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
        + 'border:1px solid rgba(255,255,255,0.15);image-rendering:pixelated;';
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
            video: { width: { ideal: 320 }, height: { ideal: 240 }, frameRate: { ideal: 10 } },
            audio: false
        }).catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
        camEl.srcObject = stream;
      } catch (e) {
        setDetectorUi(false, 'Camera blocked');
        return;
      }

      const hiddenCanvas = document.createElement('canvas');
      const ctx = hiddenCanvas.getContext('2d', { willReadFrequently: true });
      let lastFrame = null;
      let backgroundFrame = null;
      let lastAnalysisAt = 0;
      let lastDetectedAt = 0;
      let presenceStreak = 0;
      let handMoveStreak = 0;
      let handRaiseStreak = 0;
      let rightHandStreak = 0;
      let leftHandStreak = 0;
      let motionStreak = 0;
      let menuReadyAt = Number.POSITIVE_INFINITY;
      let handCentroidWasCenter = false;
      let swipeRightStreak = 0;
      let swipeLeftStreak = 0;

      /* ── Presence confirmation state ── */
      let presenceFirstDetectedAt = 0;
      let presenceConfirmed = false;
      let presenceConfirmStreak = 0;

      const analyzeEveryMs = detectorConfig.analyzeEveryMs;
      const movementPixelThreshold = detectorConfig.movementPixelThreshold;
      const foregroundDeltaThreshold = detectorConfig.foregroundDeltaThreshold;
      const backgroundAlpha = detectorConfig.backgroundAlpha;
      const minPresenceRatio = detectorConfig.minPresenceRatio;
      const minPresenceBoxRatio = detectorConfig.minPresenceBoxRatio;
      const maxPresenceBoxRatio = detectorConfig.maxPresenceBoxRatio;
      const minMotionRatio = detectorConfig.minMotionRatio;
      const motionStreakRequired = detectorConfig.motionStreakRequired;
      const minSideMotionPixels = detectorConfig.minSideMotionPixels;
      const dominanceFactor = detectorConfig.dominanceFactor;
      const presenceStreakRequired = detectorConfig.presenceStreakRequired;
      const presenceConfirmGapMs = detectorConfig.presenceConfirmGapMs;
      const presenceConfirmStreakRequired = detectorConfig.presenceConfirmStreakRequired;
      const handMoveStreakRequired = detectorConfig.handMoveStreakRequired;
      const handDirectionStreakRequired = detectorConfig.handDirectionStreakRequired;
      const handRaiseStreakRequired = detectorConfig.handRaiseStreakRequired;
      const menuDecisionDelayMs = detectorConfig.menuDecisionDelayMs;
      const handZoneTopRatio = detectorConfig.handZoneTopRatio;
      const handZoneBottomRatio = detectorConfig.handZoneBottomRatio;
      const handZoneSideRatio = detectorConfig.handZoneSideRatio;
      const raiseZoneTopRatio = detectorConfig.raiseZoneTopRatio;
      const raiseZoneBottomRatio = detectorConfig.raiseZoneBottomRatio;
      const raiseZoneLeftRatio = detectorConfig.raiseZoneLeftRatio;
      const raiseZoneRightRatio = detectorConfig.raiseZoneRightRatio;
      const minRaiseForegroundPixels = detectorConfig.minRaiseForegroundPixels;
      const cooldownByEvent = detectorConfig.cooldownByEvent;
      const mirrorHandedness = detectorConfig.mirrorHandedness;

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

        hiddenCanvas.width = 96;
        hiddenCanvas.height = 54;
        ctx.drawImage(camEl, 0, 0, hiddenCanvas.width, hiddenCanvas.height);
        const frame = ctx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height).data;

        if (!lastFrame || !backgroundFrame) {
          lastFrame = frame;
          backgroundFrame = frame.slice();
          setDetectorUi(false, 'Watching for movement...');
          requestAnimationFrame(analyze);
          return;
        }

        let changed = 0;
        let samples = 0;
        let leftHandZoneChanged = 0;
        let rightHandZoneChanged = 0;
        let handZoneChanged = 0;
        let raiseZoneForeground = 0;
        let raiseZoneMotion = 0;
        let foregroundPixels = 0;
        let handBandMotionSumX = 0;
        let handBandMotionCount = 0;
        let minX = hiddenCanvas.width;
        let minY = hiddenCanvas.height;
        let maxX = -1;
        let maxY = -1;

        for (let i = 0; i < frame.length; i += 16) {
          const pixelIndex = i / 4;
          const x = pixelIndex % hiddenCanvas.width;
          const y = Math.floor(pixelIndex / hiddenCanvas.width);
          const xRatio = x / hiddenCanvas.width;
          const yRatio = y / hiddenCanvas.height;
          const inHandHeightBand = yRatio >= handZoneTopRatio && yRatio <= handZoneBottomRatio;
          const inLeftHandZone = inHandHeightBand && xRatio <= handZoneSideRatio;
          const inRightHandZone = inHandHeightBand && xRatio >= (1 - handZoneSideRatio);

          const dr = Math.abs(frame[i] - lastFrame[i]);
          const dg = Math.abs(frame[i + 1] - lastFrame[i + 1]);
          const db = Math.abs(frame[i + 2] - lastFrame[i + 2]);
          const delta = (dr + dg + db) / 3;

          const inRaiseZoneCheck = yRatio >= raiseZoneTopRatio
            && yRatio <= raiseZoneBottomRatio
            && xRatio >= raiseZoneLeftRatio
            && xRatio <= raiseZoneRightRatio;

          if (delta > movementPixelThreshold) {
            changed += 1;
            if (inLeftHandZone) {
              leftHandZoneChanged += 1;
              handZoneChanged += 1;
            } else if (inRightHandZone) {
              rightHandZoneChanged += 1;
              handZoneChanged += 1;
            }
            if (inRaiseZoneCheck) raiseZoneMotion += 1;
            if (inHandHeightBand) {
              handBandMotionSumX += xRatio;
              handBandMotionCount += 1;
            }
          }

          const bdr = Math.abs(frame[i] - backgroundFrame[i]);
          const bdg = Math.abs(frame[i + 1] - backgroundFrame[i + 1]);
          const bdb = Math.abs(frame[i + 2] - backgroundFrame[i + 2]);
          const bgDelta = (bdr + bdg + bdb) / 3;
          const isForeground = bgDelta > foregroundDeltaThreshold;
          if (isForeground) {
            foregroundPixels += 1;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
            const inRaiseZone = yRatio >= raiseZoneTopRatio
              && yRatio <= raiseZoneBottomRatio
              && xRatio >= raiseZoneLeftRatio
              && xRatio <= raiseZoneRightRatio;
            if (inRaiseZone) raiseZoneForeground += 1;
          } else {
            backgroundFrame[i] = Math.round(backgroundFrame[i] * (1 - backgroundAlpha) + frame[i] * backgroundAlpha);
            backgroundFrame[i + 1] = Math.round(backgroundFrame[i + 1] * (1 - backgroundAlpha) + frame[i + 1] * backgroundAlpha);
            backgroundFrame[i + 2] = Math.round(backgroundFrame[i + 2] * (1 - backgroundAlpha) + frame[i + 2] * backgroundAlpha);
          }

          samples += 1;
        }

        const presenceRatio = samples > 0 ? foregroundPixels / samples : 0;
        const motionRatio = samples > 0 ? changed / samples : 0;
        let presenceBoxRatio = 0;
        if (foregroundPixels > 0 && maxX >= minX && maxY >= minY) {
          const boxArea = (maxX - minX + 1) * (maxY - minY + 1);
          presenceBoxRatio = boxArea / (hiddenCanvas.width * hiddenCanvas.height);
        }

        const hasForegroundPresence = presenceRatio >= minPresenceRatio
          && presenceBoxRatio >= minPresenceBoxRatio
          && presenceBoxRatio <= maxPresenceBoxRatio;
        if (motionRatio >= minMotionRatio) motionStreak += 1;
        else motionStreak = Math.max(0, motionStreak - 1);
        const hasMotionPresence = motionStreak >= motionStreakRequired;
        const hasPresence = hasForegroundPresence || hasMotionPresence;
        if (hasPresence) presenceStreak += 1;
        else presenceStreak = Math.max(0, presenceStreak - 1);

        const hasAnyHandMotion = handZoneChanged >= minSideMotionPixels;
        if (hasAnyHandMotion) handMoveStreak += 1;
        else handMoveStreak = Math.max(0, handMoveStreak - 1);

        const hasHandRaise = raiseZoneMotion >= minRaiseForegroundPixels;
        if (hasHandRaise) handRaiseStreak += 1;
        else handRaiseStreak = Math.max(0, handRaiseStreak - 1);

        /* ── Swipe centroid tracking ── */
        const handMotionCentroidX = handBandMotionCount >= minSideMotionPixels
          ? handBandMotionSumX / handBandMotionCount : 0.5;
        const hasEnoughHandMotion = handBandMotionCount >= minSideMotionPixels;
        if (hasEnoughHandMotion) {
          const inCenter = handMotionCentroidX >= 0.33 && handMotionCentroidX <= 0.66;
          const inRight = handMotionCentroidX > 0.66;
          const inLeft = handMotionCentroidX < 0.33;
          if (inCenter) {
            handCentroidWasCenter = true;
            swipeRightStreak = 0;
            swipeLeftStreak = 0;
          } else if (handCentroidWasCenter && inRight) {
            swipeRightStreak += 1;
            swipeLeftStreak = 0;
          } else if (handCentroidWasCenter && inLeft) {
            swipeLeftStreak += 1;
            swipeRightStreak = 0;
          }
        } else {
          handCentroidWasCenter = false;
          swipeRightStreak = Math.max(0, swipeRightStreak - 1);
          swipeLeftStreak = Math.max(0, swipeLeftStreak - 1);
        }

        const dominantLeft = leftHandZoneChanged >= minSideMotionPixels && leftHandZoneChanged > rightHandZoneChanged * dominanceFactor;
        const dominantRight = rightHandZoneChanged >= minSideMotionPixels && rightHandZoneChanged > leftHandZoneChanged * dominanceFactor;
        const rightHandDetected = mirrorHandedness ? dominantLeft : dominantRight;
        const leftHandDetected = mirrorHandedness ? dominantRight : dominantLeft;

        if (rightHandDetected) {
          rightHandStreak += 1;
          leftHandStreak = Math.max(0, leftHandStreak - 1);
        } else if (leftHandDetected) {
          leftHandStreak += 1;
          rightHandStreak = Math.max(0, rightHandStreak - 1);
        } else {
          rightHandStreak = Math.max(0, rightHandStreak - 1);
          leftHandStreak = Math.max(0, leftHandStreak - 1);
        }

        let eventType = null;
        let detectorLabel = 'Watching for movement...';
        let handSide = null;

        let currentState = initialState;
        const liveStateElement = document.querySelector('.state');
        if (liveStateElement) {
          currentState = String(liveStateElement.textContent || '').trim().toUpperCase();
        }

        if (currentState === 'IDLE') {
          menuReadyAt = Number.POSITIVE_INFINITY;

          /* ── Two-phase presence confirmation ── */
          if (presenceStreak >= presenceStreakRequired) {
            if (presenceFirstDetectedAt === 0) {
              presenceFirstDetectedAt = now;
              presenceConfirmStreak = 0;
              detectorLabel = 'Presence sensed, confirming...';
            } else if (now - presenceFirstDetectedAt >= presenceConfirmGapMs) {
              presenceConfirmStreak += 1;
              if (presenceConfirmStreak >= presenceConfirmStreakRequired) {
                eventType = 'movement_detected';
                detectorLabel = hasForegroundPresence ? 'Presence confirmed' : 'Motion confirmed';
                presenceFirstDetectedAt = 0;
                presenceConfirmStreak = 0;
              } else {
                detectorLabel = 'Confirming presence (' + presenceConfirmStreak + '/' + presenceConfirmStreakRequired + ')...';
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
            detectorLabel = 'Raise your hand to continue...';
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
          } else if (handCentroidWasCenter && hasEnoughHandMotion) {
            detectorLabel = 'Hand in center, swipe to scroll...';
          } else {
            detectorLabel = 'Move hand to center, then swipe L/R';
          }
        }

        if (eventType) {
          const eventCooldownMs = cooldownByEvent[eventType] || 900;
          const inCooldown = now - lastDetectedAt < eventCooldownMs;
          if (!inCooldown) {
            lastDetectedAt = now;
            setDetectorUi(true, detectorLabel);
            showMovementToast();
            sendDetectorEvent(eventType, {
              confidence: Number(presenceRatio.toFixed(3)),
              direction: handSide,
              handSide,
            }).catch(() => {
              setDetectorUi(false, 'Detector event failed');
            });
            handMoveStreak = 0;
            handRaiseStreak = 0;
            rightHandStreak = 0;
            leftHandStreak = 0;
            swipeRightStreak = 0;
            swipeLeftStreak = 0;
            handCentroidWasCenter = false;
          }
        } else {
          setDetectorUi(false, detectorLabel);
        }

        /* ── Debug overlay rendering ── */
        if (debugVisible) {
          const dCtx = debugCanvas.getContext('2d');
          debugCanvas.width = hiddenCanvas.width;
          debugCanvas.height = hiddenCanvas.height;
          dCtx.drawImage(hiddenCanvas, 0, 0);

          dCtx.globalAlpha = 0.25;

          /* Raise zone — cyan */
          dCtx.fillStyle = '#00ffff';
          const rzX = Math.round(raiseZoneLeftRatio * hiddenCanvas.width);
          const rzY = Math.round(raiseZoneTopRatio * hiddenCanvas.height);
          const rzW = Math.round((raiseZoneRightRatio - raiseZoneLeftRatio) * hiddenCanvas.width);
          const rzH = Math.round((raiseZoneBottomRatio - raiseZoneTopRatio) * hiddenCanvas.height);
          dCtx.fillRect(rzX, rzY, rzW, rzH);

          /* Hand band zones — left (red), center (green), right (blue) */
          const hTop = Math.round(handZoneTopRatio * hiddenCanvas.height);
          const hBot = Math.round(handZoneBottomRatio * hiddenCanvas.height);
          const hLeftEnd = Math.round(0.33 * hiddenCanvas.width);
          const hRightStart = Math.round(0.66 * hiddenCanvas.width);

          dCtx.fillStyle = '#ff4444';
          dCtx.fillRect(0, hTop, hLeftEnd, hBot - hTop);

          dCtx.fillStyle = '#44ff44';
          dCtx.fillRect(hLeftEnd, hTop, hRightStart - hLeftEnd, hBot - hTop);

          dCtx.fillStyle = '#4444ff';
          dCtx.fillRect(hRightStart, hTop, hiddenCanvas.width - hRightStart, hBot - hTop);

          dCtx.globalAlpha = 1.0;

          /* Zone labels */
          dCtx.font = '7px monospace';
          dCtx.fillStyle = '#00ffff';
          dCtx.fillText('RAISE', rzX + 2, rzY + 8);
          dCtx.fillStyle = '#ff6666';
          dCtx.fillText('L', 2, hTop + 10);
          dCtx.fillStyle = '#66ff66';
          dCtx.fillText('C', hLeftEnd + 2, hTop + 10);
          dCtx.fillStyle = '#6666ff';
          dCtx.fillText('R', hRightStart + 2, hTop + 10);

          debugText.textContent =
            'STATE: ' + currentState + '\\n'
            + '--- Presence ---\\n'
            + 'fgRatio:   ' + presenceRatio.toFixed(3) + ' (min ' + minPresenceRatio + ')\\n'
            + 'boxRatio:  ' + presenceBoxRatio.toFixed(3) + ' [' + minPresenceBoxRatio + '-' + maxPresenceBoxRatio + ']\\n'
            + 'motionR:   ' + motionRatio.toFixed(3) + ' (min ' + minMotionRatio + ')\\n'
            + 'presStrk:  ' + presenceStreak + '/' + presenceStreakRequired + '\\n'
            + 'confirmed: ' + (presenceFirstDetectedAt > 0 ? 'waiting ' + Math.round(now - presenceFirstDetectedAt) + 'ms' : 'no') + '\\n'
            + 'confStrk:  ' + presenceConfirmStreak + '/' + presenceConfirmStreakRequired + '\\n'
            + '--- Hand Raise ---\\n'
            + 'raiseMot:  ' + raiseZoneMotion + ' (min ' + minRaiseForegroundPixels + ')\\n'
            + 'raiseFg:   ' + raiseZoneForeground + '\\n'
            + 'raiseStrk: ' + handRaiseStreak + '/' + handRaiseStreakRequired + '\\n'
            + '--- Swipe ---\\n'
            + 'centroidX: ' + handMotionCentroidX.toFixed(2) + ' (motionPx: ' + handBandMotionCount + ')\\n'
            + 'wasCenter: ' + handCentroidWasCenter + '\\n'
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
