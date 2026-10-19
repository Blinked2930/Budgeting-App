// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ClerkProvider, useAuth } from '@clerk/clerk-react'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.tsx'
import { SyncManager } from './components/SyncManager'
import { LegacyClaimer } from './components/LegacyClaimer'
import { LockScreen } from './components/LockScreen'
import InstallPrompt from './components/InstallPrompt'
import { useLock } from './hooks/useLock'

registerSW({ immediate: true });

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

if (!convex) {
  console.warn('VITE_CONVEX_URL is not set. Running in local-only mode (no cloud sync).');
}
if (convex && !clerkKey) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is not set. Cloud sync disabled until sign-in is configured.');
}

const UnlockedApp = () => {
  if (!convex) {
    // Local-only mode — no cloud, no auth, no sync.
    return <App />;
  }

  if (clerkKey) {
    // Full Clerk + Convex auth pipeline.
    return (
      <ClerkProvider publishableKey={clerkKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <SyncManager />
          <LegacyClaimer />
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }

  // Legacy fallback: Convex reachable but no Clerk configured.
  // Queries return [], mutations return null — effectively no-op sync.
  return (
    <ConvexProvider client={convex}>
      <SyncManager />
      <App />
    </ConvexProvider>
  );
};

const Root = () => {
  const { isUnlocked, unlock } = useLock();
  return (
    <>
      <InstallPrompt onBypass={() => { }} />
      {isUnlocked ? <UnlockedApp /> : <LockScreen onUnlock={unlock} />}
    </>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);