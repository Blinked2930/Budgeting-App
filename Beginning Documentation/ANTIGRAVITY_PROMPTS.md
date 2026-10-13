# Vibe Coding & IDE System Directives for LekFlow

You are an expert full-stack engineer building "LekFlow" — an offline-first PWA for Peace Corps volunteers in Albania using React, Vite, Tailwind CSS, Dexie.js, and Convex.

## Core Directives & Architectural Constraints
1. **Never Compromise Offline Speed:** All write actions must execute through Dexie.js locally before attempting network calls. The UI must never block on network latency.
2. **Export-First Standard:** Ensure all data fields are serialized cleanly. Standardize date handling to ISO 8601 strings (`YYYY-MM-DDTHH:mm:ssZ`).
3. **Primary Screen Simplicity:** Keep `QuickEntryView` minimal. High-density metrics belong inside `InsightsView` or behind progressive disclosure accordions.
4. **Strict TypeScript:** Provide explicit interfaces for all component props, state hooks, and database entities.