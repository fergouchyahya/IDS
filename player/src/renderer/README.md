# Player Renderer Abstractions

This folder contains renderer-side interfaces/adapters used by player runtime.

How it fits the project:
- It keeps rendering concerns separated from scheduling/state logic.
- It allows swapping render targets (console/browser) without changing core logic.
