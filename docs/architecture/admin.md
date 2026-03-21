# Admin Architecture

> The control plane for IDS — where staff configure what the screen shows.

---

## What Admin Owns

```
┌─────────────────────────────────────────┐
│              Admin Service              │
├─────────────────────────────────────────┤
│  HTTP API for campaign management       │
│  Browser-based admin UI                 │
│  Campaign & student data persistence    │
│  Media file upload & serving            │
│  Runtime config projection for player   │
└─────────────────────────────────────────┘
```

---

## Layered Architecture

Every request flows through clean, separated layers:

```mermaid
flowchart TD
    REQ[HTTP Request] --> Router

    subgraph Router["Router — URL dispatch only"]
        R[router.js]
    end

    subgraph Handlers["Handlers — HTTP concerns"]
        HC[campaigns.js]
        HCF[config.js]
        HH[health.js]
        HM[media.js]
        HS[state.js]
        HST[students.js]
        HU[ui.js]
    end

    subgraph Services["Services — Domain logic"]
        SC[campaign-service]
        SCF[config-service]
        SH[health-service]
        SM[media-service]
        SS[state-service]
        SST[student-service]
    end

    subgraph Storage["Storage — State management"]
        SF[Storage Facade]
        V[Validators]
        RM[Runtime Mapper]
    end

    subgraph Repository["Repository — Persistence"]
        FR[FileRepository]
        DISK[(admin/data/state.json)]
    end

    Router --> Handlers
    Handlers --> Services
    Services --> Storage
    Storage --> Repository
    FR --> DISK
```

### Layer Contracts

| Layer | Responsibility | Does NOT do |
|-------|---------------|-------------|
| **Router** | URL + method matching, auth check on mutations | Validate data, mutate state |
| **Auth Middleware** | Verify `Authorization: Bearer <key>` header | Business logic |
| **Handlers** | Parse body, call service, map HTTP status | Business logic |
| **Services** | Domain operations, orchestration | Direct disk I/O |
| **Storage** | Validate, manage state, project runtime config | HTTP concerns |
| **Repository** | Read/write JSON file, async batching | Business validation |
| **StudentDb** | Read/write student profiles in SQLite | Business validation |

---

## Composition Root

```mermaid
flowchart TD
    A[index.js<br/><i>Read config, validate port</i>] --> B[server.js<br/><i>Build all dependencies</i>]

    B --> C[FileRepository<br/><i>JSON persistence</i>]
    B --> SDB[StudentDb<br/><i>SQLite persistence</i>]
    B --> D[createStorage<br/><i>Domain facade</i>]
    B --> E[buildServices<br/><i>Wire services</i>]
    B --> F[createAdminRouter<br/><i>Route table</i>]

    D --> C
    D --> SDB
    E --> D
    F --> AUTH[Auth Middleware<br/><i>API key check</i>]
    F --> G[Handlers]
    G --> E

    B --> H[http.createServer<br/><i>Listen on ADMIN_HOST:ADMIN_PORT</i>]
```

---

## Persistent State Model

Admin state is split across two stores:

```mermaid
classDiagram
    class AdminState {
        settings : Object
        active : Object
        menuCampaign : Campaign
        idleCampaigns : Campaign[]
        visitorCampaigns : Campaign[]
        students : Map~uid → Campaign~
        updatedAt : ISO timestamp
    }

    class Campaign {
        campaignId : string
        campaignName : string
        campaignPriority : number
        items : CampaignItem[]
    }

    class CampaignItem {
        contentId : string
        type : TEXT | IMAGE | VIDEO
        data : string
        order : number
        durationSec : number
    }

    class StudentProfile {
        nfcUid : string
        displayName : string
        timetableImageUrl : string
        nextClassText : string?
    }

    AdminState "1" --> "*" Campaign : state.json
    Campaign "1" --> "*" CampaignItem
    StudentProfile "*" -- "SQLite" : students.db

    note for AdminState "Persisted in state.json"
    note for StudentProfile "Persisted in students.db (SQLite)"
```

**Key distinction:**
- `students` (in `state.json`) — manual student-to-campaign mappings (operator creates the campaign)
- `studentProfiles` (in `students.db`) — profile data used to **generate** campaigns on demand, stored in SQLite via `better-sqlite3`

---

## Runtime Projection

The player never sees the full admin state. Instead, a mapper creates a normalized view:

```mermaid
flowchart LR
    subgraph "Full Admin State"
        Settings[settings]
        Active[active]
        Menu[menuCampaign]
        Idle[idleCampaigns ×N]
        Visitor[visitorCampaigns ×N]
        Students[students]
        Profiles[studentProfiles]
    end

    subgraph "toRuntimeConfig()"
        Mapper[Runtime Mapper]
    end

    subgraph "Player Runtime Config"
        RS[settings]
        RA[active]
        RM[menuCampaign]
        RI[idleCampaign ← active one]
        RV[visitorCampaign ← active one]
        RST[students]
        RU[updatedAt]
    end

    Settings --> Mapper
    Active --> Mapper
    Menu --> Mapper
    Idle --> Mapper
    Visitor --> Mapper
    Students --> Mapper
    Mapper --> RS & RA & RM & RI & RV & RST & RU

    Profiles -->|/api/students/:uid/campaign| Generated[Generated Campaign]
```

The player gets:
- **One** active idle campaign (not all of them)
- **One** active visitor campaign (not all of them)
- The menu campaign as-is
- Student mappings as-is
- Generated student campaigns via a separate endpoint

---

## Media Flow

```mermaid
sequenceDiagram
    actor Op as Operator
    participant UI as Admin UI
    participant Handler as media handler
    participant Service as media-service
    participant Disk as admin/data/uploads/

    Op->>UI: Select file to upload
    UI->>Handler: POST /api/media/upload (multipart/form-data)
    Handler->>Handler: Check content-type
    Handler->>Service: Process multipart body
    Service->>Disk: Write file to uploads/
    Service-->>Handler: Upload metadata
    Handler-->>UI: 201 { filename, url, ... }

    Note over Op: Later, in campaign items...

    UI->>Handler: GET /media/photo.jpg
    Handler->>Disk: Read file
    Handler-->>UI: Binary response + cache headers
```

Media URLs depend on `IDS_PUBLIC_ADMIN_URL` — if it points at the wrong hostname, media links break for external clients.

---

## API Key Authentication

All mutation endpoints (POST, PUT, DELETE) require an API key via the `Authorization: Bearer <key>` header. Read-only endpoints (GET) do not require auth.

```mermaid
flowchart LR
    REQ[Mutation Request] --> Check{Authorization header?}
    Check -->|Missing or invalid| Deny["401 Unauthorized"]
    Check -->|Valid Bearer token| Allow[Process request]
```

The key is set via the `IDS_ADMIN_API_KEY` environment variable. If the variable is empty, auth is disabled (development only — not recommended in production). The browser admin UI stores the key in `localStorage` and prompts the user on first visit or after a `401` response.

---

## Student Profile Storage (SQLite)

Student profiles are stored in a **SQLite database** (`students.db`) via `better-sqlite3`, separate from the main JSON state file. On first boot, any legacy profiles in `state.json` are automatically migrated to SQLite.

```mermaid
flowchart LR
    subgraph Persistence
        JSON[(state.json<br/>campaigns, settings, active)]
        SQLite[(students.db<br/>student profiles)]
    end

    Storage[Storage Facade] --> JSON
    Storage --> SQLite
```

| Store | What it holds |
|-------|--------------|
| `state.json` | Campaigns, menu, active selections, settings, manual student mappings |
| `students.db` | Student profiles (nfcUid, displayName, timetableImageUrl, nextClassText) |

---

## Browser UI Structure

```
admin/public/
├── index.html          HTML shell
├── admin-ui.js         Main orchestration
├── app.js              App initialization
├── styles.css          Styling
├── components/         UI components
│   ├── overview.js     Campaign overview card grid
│   ├── builder.js      Block editor rendering
│   ├── inspector.js    Side panel (campaign details, active selections)
│   └── blocks.js       Block type definitions
└── services/           Browser-side services
    ├── orchestrator.js  Composes handlers from all services
    ├── actions.js       Async API-backed operations (save, publish, delete)
    ├── http.js          API calls, HTML escape, status toasts, button loading states
    ├── editor-state.js  Campaign loading, duplication, state transitions
    ├── editor-view.js   DOM sync, form population, builder ↔ UI binding
    ├── editor-controller.js  State + view coordination (select, rename, type change)
    ├── block-ops.js     Block add/remove/move/duplicate/drag-drop
    ├── render-helpers.js  Sidebar, inspector, block rendering delegation
    ├── runtime-deps.js  Dependency builder for all service modules
    ├── runtime-context.js  Runtime state (builder, sidebar query, filters)
    ├── state-store.js   UI state persistence (localStorage)
    ├── campaign-selectors.js  Card normalization for overview grid
    ├── ui-events.js     DOM event binding (search, filters, type change)
    ├── validation.js    Client-side campaign validation
    └── legacy-bridge.js Global function registration for inline onclick handlers
```

The UI is **vanilla JavaScript** — no framework, no build step. The server serves these files directly.

---

## End-to-End: Publishing Content

```mermaid
sequenceDiagram
    participant Browser
    participant Router
    participant Handler
    participant Service
    participant Storage
    participant Repo as FileRepository

    Browser->>Router: POST /api/menu-campaign
    Router->>Handler: handleSetMenuCampaign
    Handler->>Handler: Parse request body
    Handler->>Service: config.setMenuCampaign(payload)
    Service->>Storage: setMenuCampaign(payload)
    Storage->>Storage: Validate campaign items
    Storage->>Repo: readState()
    Repo-->>Storage: Current state
    Storage->>Storage: Merge new menu campaign
    Storage->>Repo: writeState(nextState)
    Repo->>Repo: Async batch write to disk
    Repo-->>Storage: Persisted
    Storage-->>Handler: Updated state
    Handler-->>Browser: 200 { state }
```

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Missing or invalid API key | `401 { error: "unauthorized" }` |
| Invalid JSON body | `400 { error: "validation_failed", issues: [...] }` |
| Missing campaign/student | `404 { error: "validation_failed", issues: ["not_found"] }` |
| Invalid upload content-type | `400 { error: "validation_failed", issues: ["invalid_content_type"] }` |
| Unknown route | `404 { error: "not_found: /path" }` |
| Unhandled server error | `500 { error: "internal_error" }` |

---

## Related Docs

| Document | Description |
|----------|-------------|
| [Admin API Reference](../api/admin.md) | Every endpoint in detail |
| [Shared Architecture](shared.md) | Config, validation, helpers used by admin |
| [Deployment Guide](../operations/deployment-pi.md) | Running admin on the Pi |
| [Architecture Overview](overview.md) | The full system view |
