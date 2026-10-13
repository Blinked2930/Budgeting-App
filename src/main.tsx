import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import './index.css'
import App from './App.tsx'
import { SyncManager } from './components/SyncManager'
import { LockScreen } from './components/LockScreen'
import { useLock } from './hooks/useLock'

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null;

if (!convex) {
  console.warn('VITE_CONVEX_URL is not set. Running in local-only mode (no cloud sync).');
}

const UnlockedApp = () => {
  if (convex) {
    return (
      <ConvexProvider client={convex}>
        <SyncManager />
        <App />
      </ConvexProvider>
    );
  }
  return <App />;
};

const Root = () => {
  const { isUnlocked, unlock } = useLock();
  return isUnlocked ? <UnlockedApp /> : <LockScreen onUnlock={unlock} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);