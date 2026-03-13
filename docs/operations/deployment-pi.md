# Raspberry Pi Deployment

This guide describes the current Raspberry Pi deployment assets under `deploy/pi/`.

## Deployment Model

Assumed layout:

- code at `/opt/ids`
- environment file at `/etc/ids/ids.env`
- runtime user `ids`
- admin state at `/var/lib/ids/admin`
- services managed by systemd

## Files That Define Deployment

- Env template: [`../../deploy/pi/env/ids.env`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/env/ids.env)
- Smoke check: [`../../deploy/pi/smoke-check.sh`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/smoke-check.sh)
- Admin unit: [`../../deploy/pi/systemd/ids-admin.service`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/systemd/ids-admin.service)
- Player unit: [`../../deploy/pi/systemd/ids-player.service`](/home/fergyah/School/S8/PROJ/Project/ids/deploy/pi/systemd/ids-player.service)

## Environment Variables

The Pi env file currently defines:

- `ADMIN_HOST`
- `IDS_PUBLIC_ADMIN_URL`
- `IDS_ADMIN_DATA_DIR`
- `PLAYER_HOST`
- `ADMIN_PORT`
- `PLAYER_PORT`
- `IDS_ADMIN_URL`
- `IDS_CONFIG`
- optional `IDS_DETECTOR_CONFIG`

`IDS_PUBLIC_ADMIN_URL` matters for generated media URLs. If it points at the wrong hostname, uploaded media links will be wrong for clients.

## Prepare The Host

```bash
sudo useradd --system --home /opt/ids --shell /usr/sbin/nologin ids || true
sudo mkdir -p /opt/ids /etc/ids /var/lib/ids/admin /var/log/ids
sudo chown -R ids:ids /opt/ids /var/lib/ids /var/log/ids
sudo chmod 750 /etc/ids /var/lib/ids /var/log/ids
```

Install Node.js 20+ and place the repository at `/opt/ids`.

## Install The Env File

```bash
sudo cp /opt/ids/deploy/pi/env/ids.env /etc/ids/ids.env
sudo chown root:root /etc/ids/ids.env
sudo chmod 640 /etc/ids/ids.env
```

Review before starting:

- `ADMIN_HOST`
- `IDS_PUBLIC_ADMIN_URL`
- `IDS_ADMIN_DATA_DIR`
- `PLAYER_HOST`
- `IDS_ADMIN_URL`
- `IDS_CONFIG`

For remote browser access to the Pi-hosted admin and player UIs, set:

- `ADMIN_HOST=0.0.0.0`
- `PLAYER_HOST=0.0.0.0`

## Install The systemd Units

```bash
sudo cp /opt/ids/deploy/pi/systemd/ids-admin.service /etc/systemd/system/
sudo cp /opt/ids/deploy/pi/systemd/ids-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ids-admin.service ids-player.service
sudo systemctl restart ids-admin.service
sudo systemctl restart ids-player.service
```

## What The Units Do

### `ids-admin.service`

- runs `/usr/bin/node /opt/ids/admin/src/index.js`
- loads `/etc/ids/ids.env`
- restarts automatically
- uses systemd sandboxing and state/log directories
- allows write access to `/var/lib/ids` and `/var/log/ids`

### `ids-player.service`

- runs `/usr/bin/node /opt/ids/player/src/index.js --config ${IDS_CONFIG} --port ${PLAYER_PORT} --admin-url ${IDS_ADMIN_URL}`
- depends on `ids-admin.service`
- writes logs through the journal log directory configuration
- uses the same hardening settings pattern as admin

## Smoke Check

Run:

```bash
cd /opt/ids
./deploy/pi/smoke-check.sh
```

Override the per-request timeout:

```bash
SMOKE_TIMEOUT=10 ./deploy/pi/smoke-check.sh
```

The script checks:

- admin `/health`
- admin `/api/state`
- admin `/runtime-config`
- admin `/services/runtime-deps.js`
- player `/health`
- player `/current`

## Upgrade Procedure

```bash
cd /opt/ids
git fetch --all
git checkout <ref>
npm --prefix admin install
npm --prefix player install
npm --prefix shared/contract install
sudo systemctl restart ids-admin.service
sudo systemctl restart ids-player.service
./deploy/pi/smoke-check.sh
```

If env or unit files changed:

```bash
sudo cp deploy/pi/env/ids.env /etc/ids/ids.env
sudo cp deploy/pi/systemd/ids-admin.service /etc/systemd/system/
sudo cp deploy/pi/systemd/ids-player.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl restart ids-admin.service ids-player.service
```

## Rollback

```bash
cd /opt/ids
git checkout <previous-known-good-ref>
sudo systemctl restart ids-admin.service
sudo systemctl restart ids-player.service
./deploy/pi/smoke-check.sh
```

If you suspect bad admin runtime state, back it up first:

```bash
sudo cp -a /var/lib/ids/admin /var/lib/ids/admin.backup.$(date +%Y%m%d%H%M%S)
```

## Observability And Recovery

Inspect service state:

```bash
sudo systemctl status ids-admin.service
sudo systemctl status ids-player.service
journalctl -u ids-admin.service -n 100 --no-pager
journalctl -u ids-player.service -n 100 --no-pager
```

Check restart counters:

```bash
systemctl show ids-admin.service -p NRestarts
systemctl show ids-player.service -p NRestarts
```

If a service hits the restart limit:

```bash
sudo systemctl reset-failed ids-admin.service
sudo systemctl reset-failed ids-player.service
```
