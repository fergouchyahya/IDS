# Glossary

> Every term you'll encounter in the IDS project, explained plainly.

---

## System Components

| Term | Definition |
|------|-----------|
| **Admin Service** | The control plane. Stores data, serves the browser UI, exposes management APIs, and publishes runtime config for the player. |
| **Player Service** | The display runtime. Renders signage content, accepts events, and changes what is shown on screen. |
| **Shared Package** | Common code used by both services — config, validation, errors, logging, and the runtime config contract. |

---

## Content Model

| Term | Definition |
|------|-----------|
| **Campaign** | A named collection of content items shown by the player. Each campaign has an ID, name, priority, and ordered items. |
| **Campaign Item** | One piece of content inside a campaign — includes `contentId`, `type` (TEXT/IMAGE/VIDEO), `data`, `order`, and `durationSec`. |
| **Idle Campaign** | Content shown when nobody is interacting with the display. Loops automatically. |
| **Menu Campaign** | The interactive choice screen shown after movement is detected — lets users pick visitor or student paths. |
| **Visitor Campaign** | Content shown when the generic visitor path is selected from the menu. |
| **Student Campaign** | Personalized content shown when a student is identified by NFC. Can be manually created or auto-generated from a profile. |
| **Generated Student Campaign** | A campaign created automatically from `studentProfiles` data — not entered item by item. Returned by `/api/students/:uid/campaign`. |
| **Active Campaign** | The currently selected idle or visitor campaign. Admin can store multiple of each kind, but only one per type is active at a time. |

---

## Player Concepts

```mermaid
stateDiagram-v2
    [*] --> IDLE : Boot
    IDLE --> MENU : movement
    MENU --> VISITOR_INFO : visitor selected
    MENU --> STUDENT_INFO : NFC tap
    VISITOR_INFO --> IDLE : timeout
    STUDENT_INFO --> IDLE : timeout
    MENU --> IDLE : timeout
```

| Term | Definition |
|------|-----------|
| **State Machine** | The player component tracking which screen state is active and how events cause transitions between states. |
| **Runtime Config** | The normalized data structure the player uses at runtime — includes active campaigns, settings, and student entries. Produced by admin's runtime mapper. |
| **Detector Event** | An event from the detector-authenticated endpoints. Requires the boot-time detector token in the `x-detector-token` header. |
| **NFC-Like Event** | An event such as `nfc_tap` that identifies a student by UID, potentially triggering the student info flow. |

---

## Architecture Terms

| Term | Definition |
|------|-----------|
| **Router** | URL + method dispatch layer. Does not validate data or mutate state. |
| **Handler** | HTTP concern layer — parses bodies, calls services, maps results to status codes. |
| **Service** | Domain logic layer — thin APIs that keep handlers from talking directly to storage. |
| **Storage Facade** | The admin domain layer that validates data, coordinates state changes, and delegates persistence to the repository. |
| **Repository** | The persistence boundary. Currently implemented as `FileRepository` — reads/writes a JSON state file with async batch writes. |
| **Runtime Mapper** | Transforms the full admin state into the normalized runtime config consumed by the player. |

---

## Data Flow

```mermaid
flowchart LR
    Operator -->|Creates content| Admin
    Admin -->|Persists state| Disk[(JSON File)]
    Admin -->|Projects config| Player
    Sensor -->|Sends events| Player
    Player -->|Renders| Screen[📺 Display]
```

---

## Related Docs

| Document | What You'll Learn |
|----------|-------------------|
| [Architecture Overview](architecture/overview.md) | How all these pieces fit together |
| [Admin Architecture](architecture/admin.md) | Deep dive into admin layers |
| [Player Architecture](architecture/player.md) | Deep dive into the state machine |
