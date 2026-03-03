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

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setDetectorUi(false, 'Camera API unavailable');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 320 }, height: { ideal: 180 }, frameRate: { ideal: 10, max: 12 } },
          audio: false
        });
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
      let rightHandStreak = 0;
      let leftHandStreak = 0;
      let motionStreak = 0;
      let menuReadyAt = Number.POSITIVE_INFINITY;
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
      const handMoveStreakRequired = detectorConfig.handMoveStreakRequired;
      const handDirectionStreakRequired = detectorConfig.handDirectionStreakRequired;
      const menuDecisionDelayMs = detectorConfig.menuDecisionDelayMs;
      const handZoneTopRatio = detectorConfig.handZoneTopRatio;
      const handZoneBottomRatio = detectorConfig.handZoneBottomRatio;
      const handZoneSideRatio = detectorConfig.handZoneSideRatio;
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
        let foregroundPixels = 0;
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

          if (delta > movementPixelThreshold) {
            changed += 1;
            if (inLeftHandZone) {
              leftHandZoneChanged += 1;
              handZoneChanged += 1;
            } else if (inRightHandZone) {
              rightHandZoneChanged += 1;
              handZoneChanged += 1;
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
          if (presenceStreak >= presenceStreakRequired) {
            eventType = 'movement_detected';
            detectorLabel = hasForegroundPresence ? 'Presence detected' : 'Motion detected';
          } else {
            detectorLabel = 'Waiting for presence';
          }
        } else if (currentState === 'MENU') {
          if (!Number.isFinite(menuReadyAt)) {
            menuReadyAt = now + menuDecisionDelayMs;
          }
          if (now < menuReadyAt) {
            detectorLabel = 'Choose visitor or NFC...';
          } else if (handMoveStreak >= handMoveStreakRequired) {
            eventType = 'visitor_selected';
            detectorLabel = 'Hand movement detected';
          }
        } else if (currentState === 'VISITOR_INFO' || currentState === 'STUDENT_INFO') {
          menuReadyAt = Number.POSITIVE_INFINITY;
          if (rightHandDetected && rightHandStreak >= handDirectionStreakRequired) {
            eventType = 'scroll_next';
            handSide = 'right';
            detectorLabel = 'Right hand -> next';
          } else if (leftHandDetected && leftHandStreak >= handDirectionStreakRequired) {
            eventType = 'scroll_prev';
            handSide = 'left';
            detectorLabel = 'Left hand -> previous';
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
            rightHandStreak = 0;
            leftHandStreak = 0;
          }
        } else {
          setDetectorUi(false, detectorLabel);
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
