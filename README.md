# IDS — Interactive Digital Signage

A minimal system where an **Admin** uploads campaigns and a **Player** fetches & executes them.

## Quick Start

**Validate configs:**
```bash
make validate
```

**Run Admin (campaign control plane):**
```bash
make run-admin
```

**Run Player (signage renderer):**
```bash
make run-player
```

Admin listens on `http://127.0.0.1:8081`, Player on `http://127.0.0.1:7070`.
