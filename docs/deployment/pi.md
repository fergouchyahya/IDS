# Raspberry Pi Deployment

This guide is the operational baseline for deploying IDS on a Raspberry Pi.

## Assumptions

- Code is deployed to `/opt/ids`
- Runtime env file is stored at `/etc/ids/ids.env`
- Services run under a dedicated `ids` system user
- Admin data is stored under `/var/lib/ids/admin`
- systemd manages both `ids-admin` and `ids-player`

## 1. Prepare the Pi

Create the service account and runtime directories:

```bash
sudo useradd --system --home /opt/ids --shell /usr/sbin/nologin ids || true
sudo mkdir -p /opt/ids /etc/ids /var/lib/ids/admin /var/log/ids
sudo chown -R ids:ids /opt/ids /var/lib/ids /var/log/ids
sudo chmod 750 /etc/ids /var/lib/ids /var/log/ids
```

Install Node.js 20+ and copy the project into `/opt/ids`.

## 2. Configure the Environment

Start from [`deploy/pi/env/ids.env`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/env/ids.env):

```bash
sudo cp /opt/ids/deploy/pi/env/ids.env /etc/ids/ids.env
sudo chown root:root /etc/ids/ids.env
sudo chmod 640 /etc/ids/ids.env
```

Review these values before first start:

- `IDS_PUBLIC_ADMIN_URL`
  Use the hostname clients will actually use to reach the admin service.
  This controls generated media URLs.
- `IDS_ADMIN_DATA_DIR`
  Keep this on persistent storage.
- `IDS_ADMIN_URL`
  This is what the player uses to reach admin locally.
- `IDS_CONFIG`
  Player startup config path.

## 3. Install systemd Units

Copy the unit files:

```bash
sudo cp /opt/ids/deploy/pi/systemd/ids-admin.service /etc/systemd/system/
sudo cp /opt/ids/deploy/pi/systemd/ids-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ids-admin.service ids-player.service
```

Start or restart the services:

```bash
sudo systemctl restart ids-admin.service
sudo systemctl restart ids-player.service
```

Inspect service status:

```bash
sudo systemctl status ids-admin.service
sudo systemctl status ids-player.service
journalctl -u ids-admin.service -n 100 --no-pager
journalctl -u ids-player.service -n 100 --no-pager
```

## 4. Smoke Check

Run:

```bash
cd /opt/ids
./deploy/pi/smoke-check.sh
```

This checks:

- admin `/health`
- admin `/api/state`
- admin `/runtime-config`
- one static admin asset
- player `/health`

## 5. Upgrade Procedure

```bash
cd /opt/ids
git fetch --all
git checkout <target-branch-or-tag>
npm --prefix admin install
npm --prefix player install
npm --prefix shared/contract install
sudo systemctl restart ids-admin.service
sudo systemctl restart ids-player.service
./deploy/pi/smoke-check.sh
```

If the env file or systemd units changed:

```bash
sudo cp deploy/pi/env/ids.env /etc/ids/ids.env
sudo cp deploy/pi/systemd/ids-admin.service /etc/systemd/system/
sudo cp deploy/pi/systemd/ids-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart ids-admin.service ids-player.service
```

## 6. Rollback

Return to the previous known-good commit or tag:

```bash
cd /opt/ids
git checkout <previous-known-good-ref>
sudo systemctl restart ids-admin.service
sudo systemctl restart ids-player.service
./deploy/pi/smoke-check.sh
```

If rollback is related to bad runtime state, preserve the current state directory first:

```bash
sudo cp -a /var/lib/ids/admin /var/lib/ids/admin.backup.$(date +%Y%m%d%H%M%S)
```

## 7. Operational Notes

- Generated media URLs depend on `IDS_PUBLIC_ADMIN_URL`. If that is wrong, uploaded media links will be wrong.
- The admin and player currently bind to `127.0.0.1`, so expose them externally through a proxy only if you intend to.
- Do not start SQL or NFC deployment work on the Pi until Phase 2 and Phase 4 from [`ROADMAP.md`](/home/fergyah/School/S8/PROJ/Project/ids/ROADMAP.md) are complete.
