# IDS Deployment on Raspberry Pi (From Scratch)

This guide deploys Admin + Player on a Raspberry Pi using `systemd`, with auto-start on boot.

## 1. Prerequisites

- Raspberry Pi 5 (2GB is fine)
- Raspberry Pi OS (64-bit recommended)
- Internet access
- User with sudo rights (`pi` assumed below)

## 2. Install base packages

```bash
sudo apt update
sudo apt install -y git curl
```

Install Node.js 22 LTS:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

## 3. Clone project

```bash
cd /opt
sudo git clone <YOUR_REPO_URL> ids
sudo chown -R pi:pi /opt/ids
cd /opt/ids
```

## 4. Install dependencies

```bash
npm --prefix admin install
npm --prefix player install
npm --prefix shared/contract install
```

## 5. Prepare environment file

```bash
sudo mkdir -p /etc/ids
sudo cp deploy/pi/env/ids.env /etc/ids/ids.env
```

Optional: edit values

```bash
sudo nano /etc/ids/ids.env
```

Default file includes:

- `ADMIN_PORT=8081`
- `PLAYER_PORT=7070`
- `IDS_ADMIN_URL=http://127.0.0.1:8081`
- `IDS_CONFIG=/opt/ids/shared/contract/examples/config.welcome.json`

## 6. Install systemd services

```bash
sudo cp deploy/pi/systemd/ids-admin.service /etc/systemd/system/
sudo cp deploy/pi/systemd/ids-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ids-admin.service ids-player.service
sudo systemctl start ids-admin.service ids-player.service
```

## 7. Verify

```bash
sudo systemctl status ids-admin.service --no-pager
sudo systemctl status ids-player.service --no-pager
```

Open in browser on same network:

- `http://<PI_IP>:8081` (Admin UI)
- `http://<PI_IP>:7070` (Player UI)

## 8. Logs and restart

```bash
journalctl -u ids-admin.service -f
journalctl -u ids-player.service -f

sudo systemctl restart ids-admin.service
sudo systemctl restart ids-player.service
```

## 9. Update after new git push

```bash
cd /opt/ids
git pull
npm --prefix admin install
npm --prefix player install
sudo systemctl restart ids-admin.service ids-player.service
```

## 10. First demo workflow

1. Open Admin UI and create/edit campaigns.
2. Set active Idle and Visitor campaigns.
3. Add at least one student UID in `Students`.
4. Open Player UI and test:
   - movement -> menu
   - visitor path
   - student path via known NFC UID
   - scroll next/prev
   - inactivity return to idle
