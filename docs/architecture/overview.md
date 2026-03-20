# Architecture Overview

> IDS has two jobs: let staff decide what appears on the sign, and show the right content at the right time.

---

## System Context

```mermaid
flowchart LR
    subgraph Operator Side
        Staff[🖥️ Staff Browser]
    end

    subgraph Admin Service
        AdminAPI[HTTP API]
        AdminUI[Browser Admin UI]
        Storage[(JSON State + Uploads)]
    end

    subgraph Player Service
        SM[State Machine]
        Renderer[HTML Renderer]
        Sync[Admin Sync]
    end

    subgraph Hardware
        Screen[📺 Display]
        PIR[👁️ PIR Sensor]
        NFC[📱 NFC Reader]
    end

    subgraph Shared
        Config[Config]
        Valid[Validation]
        Log[Logger]
    end

    Staff --> AdminUI
    AdminUI --> AdminAPI
    AdminAPI --> Storage
    Sync -->|GET /runtime-config| AdminAPI
    SM --> Renderer --> Screen
    PIR -->|movement| SM
    NFC -->|nfc_tap| SM
    Config -.-> AdminAPI
    Config -.-> SM
    Valid -.-> AdminAPI
    Valid -.-> SM
    Log -.-> AdminAPI
    Log -.-> SM
```

---

## Service Responsibilities

```mermaid
flowchart TD
    subgraph Admin["Admin — The Control Plane"]
        direction TB
        A1[Campaign & student configuration]
        A2[Persistent state in JSON file]
        A3[Browser admin UI serving]
        A4[Media upload & serving]
        A5[Runtime config projection for player]
    end

    subgraph Player["Player — The Display Runtime"]
        direction TB
        P1[Startup config loading]
        P2[In-memory state machine]
        P3[Full-screen HTML rendering]
        P4[Event ingestion — motion, NFC, scroll]
        P5[Optional live sync from admin]
    end

    subgraph Shared["Shared — The Common Ground"]
        direction TB
        S1[Environment config parsing]
        S2[Validation & error types]
        S3[HTTP helpers & structured logging]
        S4[JSON Schema contract]
    end
```

---

## Runtime Wiring

How each service boots and assembles its dependencies:

```mermaid
flowchart TD
    subgraph Admin Boot
        AI[index.js] --> AS[server.js]
        AS --> FR[FileRepository]
        AS --> ST[createStorage]
        AS --> SV[buildServices]
        AS --> AR[createAdminRouter]
        AR --> AH[Handlers]
        AH --> SV
        SV --> ST --> FR
    end

    subgraph Player Boot
        PI[index.js] --> PS[server.js]
        PS --> PSM[PlayerStateMachine]
        PS --> SYNC[AdminSyncService]
        PS --> PR[createPlayerRouter]
        PR --> PH[Handlers]
        PH --> PSM
        PH --> SYNC
    end
```

---

## How Data Moves

### Content Publishing Flow

```mermaid
sequenceDiagram
    actor Op as Operator
    participant UI as Admin UI
    participant Admin as Admin Service
    participant Disk as File Storage
    participant Player as Player Service
    participant Screen as 📺 Display

    Op->>UI: Create/edit campaign
    UI->>Admin: POST /api/campaigns
    Admin->>Admin: Validate payload
    Admin->>Disk: Persist state (async batch)
    Admin-->>UI: 200 { state }

    Note over Player,Admin: Player syncs periodically or on event

    Player->>Admin: GET /runtime-config
    Admin-->>Player: Normalized runtime view
    Player->>Player: Apply to state machine
    Player->>Screen: Re-render display
```

### Display Interaction Flow

```mermaid
sequenceDiagram
    actor Person
    participant PIR as 👁️ Motion Sensor
    participant Player as Player Service
    participant Screen as 📺 Display
    participant NFC as 📱 NFC Reader
    participant Admin as Admin Service

    Note over Player: State: IDLE (looping idle campaign)

    Person->>PIR: Walks by
    PIR->>Player: POST /detector/movement
    Player->>Screen: Show MENU

    Person->>NFC: Taps student card
    NFC->>Player: POST /events {nfc_tap, uid}
    Player->>Admin: GET /api/students/:uid/campaign
    Admin-->>Player: Generated student campaign
    Player->>Screen: Show STUDENT_INFO

    Note over Player: Inactivity timeout...
    Player->>Screen: Return to IDLE
```

---

## Core Architectural Rules

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Admin:   Router → Handler → Service → Storage → Repository │
│  Player:  Router → Handler → Service / State Machine         │
│  Shared:  Reusable code only — no runtime state ownership    │
│                                                              │
│  Admin persistence:  Async, repository-backed                │
│  Player state:       In-memory only, not persisted           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Campaign Lifecycle

```mermaid
flowchart LR
    subgraph Admin
        Create[Create Campaign] --> Store[Persist to Disk]
        Store --> Project[Generate Runtime Projection]
    end

    subgraph Player
        Fetch[Fetch /runtime-config] --> Apply[Apply to State Machine]
        Apply --> Render[Render on Screen]
    end

    Project -->|HTTP| Fetch
```

### Campaign Types

| Type | When It Shows | Trigger |
|------|--------------|---------|
| **Idle** | No one is interacting | Default / inactivity timeout |
| **Menu** | Someone is detected | `movement_detected` event |
| **Visitor** | Visitor raises hand to proceed | `visitor_selected` event (hand raise detected) |
| **Student** | Student identified by NFC | `nfc_tap` with known UID |

---

## Documentation Map

| Next Read | What You'll Learn |
|-----------|-------------------|
| [Glossary](../glossary.md) | All IDS terminology explained |
| [Admin Architecture](admin.md) | Admin internals — layers, persistence, UI, media |
| [Player Architecture](player.md) | Player internals — state machine, events, rendering |
| [Shared Architecture](shared.md) | Common code — config, validation, logging, contract |
| [Admin API](../api/admin.md) | Full admin endpoint reference |
| [Player API](../api/player.md) | Full player endpoint reference |
