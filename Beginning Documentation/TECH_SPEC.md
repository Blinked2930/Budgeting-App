# Technical Architecture & Stack Specification

## 1. Tech Stack
- **Frontend Framework:** React 18 / Vite / TypeScript
- **Styling:** Tailwind CSS + Lucide React Icons
- **Local Database (Offline):** Dexie.js (IndexedDB wrapper)
- **Remote Database & Sync:** Convex (Cloud backend)
- **PWA Capabilities:** Vite PWA Plugin / Service Worker for offline static asset caching

## 2. Data Synchronization & Offline Strategy
1. **Optimistic Local Execution:** Every transaction write is immediately committed to Dexie.js local storage. The UI updates instantly (latency < 16ms).
2. **Background Sync Worker:** A synchronization listener detects network connectivity (`navigator.onLine`). When connected, un-synced Dexie records batch-push to Convex backend mutations.
3. **Conflict Resolution:** Client-side timestamps (`updatedAt` ISO string) take precedence during sync conflict resolution.

## 3. Currency Engine
- **Base Storage Currency:** ALL (Albanian Lek).
- **Exchange Rates:** Hardcoded resilient fallback rates stored locally (`1 EUR = 100 ALL`, `1 USD = 90 ALL`), editable in app Settings, overridden by live exchange rates when online.