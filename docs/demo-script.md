# IDS Demo Script

> Step-by-step guide for running a live demo of the Interactive Digital Signage system.

---

## Before the Demo

### Option A — Run on Raspberry Pi (recommended for stage)

1. Power on the Pi with HDMI display connected
2. Services start automatically (ids-admin, ids-player, ids-nfc)
3. Open Chromium in kiosk mode on the Pi:
   ```bash
   chromium-browser --kiosk --noerrdialogs --disable-infobars http://127.0.0.1:7070
   ```
4. Verify with smoke check:
   ```bash
   cd /opt/ids && sudo -u ids bash ./deploy/pi/smoke-check.sh
   ```

### Option B — Run on laptop (for development/rehearsal)

1. Start the admin:
   ```bash
   npm --prefix admin start
   ```

2. Start the player in another terminal:
   ```bash
   node player/src/index.js \
     --config shared/contract/examples/config.nfc-demo.json \
     --port 7070 \
     --admin-url http://127.0.0.1:8081
   ```

3. Open `http://127.0.0.1:7070` in a browser (add `?debug=1` for manual controls)

---

## Demo Flow

### 1. IDLE State — Welcome Screen

**What the audience sees:** Polytech Grenoble welcome screen with campus images rotating automatically.

**Talking points:**
- "This is the Interactive Digital Signage system — a smart display for university buildings"
- "Right now it's in idle mode, cycling through welcome content"
- "Notice the gesture detection widget in the corner — it uses the camera to detect hand movements"

**Transition:** Wave your hand in front of the camera (or press `D` in debug mode to trigger a movement event).

---

### 2. MENU State — Choice Screen

**What the audience sees:** Two cards — "I'm visiting" and "Tap your student card".

**Talking points:**
- "When someone approaches, the display wakes up and offers two options"
- "A visitor can tap the left card, or a student can tap their NFC card"

**Transition A (Visitor flow):** Click "I'm visiting" (or use debug panel).
**Transition B (Student flow):** Tap an NFC card on the reader (or enter UID in debug panel).

---

### 3a. VISITOR_INFO — Visitor Content

**What the audience sees:** Information about Polytech Grenoble — admissions, campus, programs.

**Talking points:**
- "Visitors see general information about the school"
- "They can swipe through multiple slides using hand gestures — left or right"
- "The progress dots at the bottom show which slide they're on"

**Transition:** Show navigation (Previous/Next buttons or hand gestures). After a period of no interaction (no gesture or tap), the inactivity countdown appears and the display returns to IDLE.

---

### 3b. STUDENT_INFO — Personalized Student Content

**What the audience sees:** Student name banner + personalized content (schedule, deadlines, events).

**Talking points:**
- "When a student taps their NFC card, the display recognizes them"
- "It shows their name and personalized information — class schedule, upcoming deadlines, campus events"
- "Each student has their own campaign managed through the admin panel"

**Transition:** After a period of no interaction, the inactivity countdown appears and the display returns to IDLE. Tap a different NFC card to switch students, or interact with a gesture to reset the timer.

---

### 4. Admin Panel (Optional)

**What the audience sees:** The admin web interface.

**Talking points:**
- "Content is managed through a web admin panel"
- "Staff can create campaigns, upload media, manage student profiles"
- "Changes sync to the player in real time"

**How to show:** Open `http://127.0.0.1:8081` in a browser (via SSH tunnel if on Pi).

---

## Debug Controls

Open the player with `?debug=1` to access manual controls:

| Control | Action |
|---------|--------|
| Press `D` | Trigger movement event (IDLE -> MENU) |
| Debug panel buttons | Send visitor/NFC/scroll events |
| NFC UID input | Simulate a card tap with a specific UID |
| Press `V` | Toggle debug overlay |

Demo NFC UID: `04295202c66780` (Fergyah)

---

## Troubleshooting During Demo

| Problem | Quick Fix |
|---------|-----------|
| Display is blank | Reload the browser page |
| Stuck on IDLE, camera not working | Use `?debug=1` and press `D` to trigger manually |
| NFC tap not recognized | Check `sudo systemctl status ids-nfc` on Pi |
| Content not loading | Check admin is running: `curl http://127.0.0.1:8081/health` |
| Need to reset to IDLE | Step away from camera (keepalive will stop), wait for timeout, or reload the page |

### Full Reset

```bash
# On the Pi
sudo systemctl restart ids-admin.service ids-player.service ids-nfc.service
```

Then reload the browser.
