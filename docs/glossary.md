# IDS Glossary

## Admin Service

The control-plane service. It stores data, serves the admin browser UI, exposes management APIs, and publishes runtime config for the player.

## Player Service

The display-side runtime. It renders signage content, accepts events, and changes what is shown on screen.

## Campaign

A named collection of content items shown by the player. Each campaign contains ordered items such as text, images, or video references.

## Campaign Item

One piece of content inside a campaign. It includes `contentId`, `type`, `data`, `order`, and `durationSec`.

## Idle Campaign

The content shown when the player is not currently interacting with a user.

## Menu Campaign

The campaign shown after movement is detected. It acts as the choice screen between visitor and student-style flows.

## Visitor Campaign

The campaign shown when a visitor path is selected from the menu.

## Student Campaign

The campaign shown when a student is identified by NFC-like input. It may come from a manual student mapping or be generated from a student profile.

## Runtime Config

The normalized data structure the player uses at runtime. It includes active campaigns, settings, and student entries in a form that the player can apply directly.

## Generated Student Campaign

A campaign created by admin from `studentProfiles` rather than entered manually item by item. It is returned by `/api/students/:uid/campaign`.

## Active Campaign

The currently selected idle or visitor campaign id in the admin state. Admin can store multiple campaigns of each kind, but only one idle and one visitor campaign are active at a time.

## State Machine

The player component that tracks which screen state is active and how events change that state.

## Detector Event

An event sent to the player from the detector-authenticated endpoints. These events require the boot-time detector token.

## NFC-Like Event

An event such as `nfc_tap` that identifies a student by UID and may trigger the student information flow.

## Repository

The persistence boundary behind the admin storage layer. In the current implementation, this is a file-backed repository that reads and writes a JSON state file.

## Storage Facade

The admin domain layer that validates data, coordinates state changes, and delegates persistence through the repository.
