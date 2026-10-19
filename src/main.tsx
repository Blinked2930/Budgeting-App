// src/main.tsx
import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ClerkProvider, SignInButton, useAuth } from '@clerk/clerk-react'
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

/**
 * Shows a modal prompt when the app is unlocked (PIN entered) but the user
 * is not signed in with Clerk. Dismissible — the user can keep using the app
 * offline and sign in later from Settings.
 */
const ClerkSignInPrompt = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Reset dismissal when auth state changes to signed-in
  useEffect(() => {
    if (isSignedIn) setDismissed(false);
  }, [isSignedIn]);

  if (!isLoaded || isSignedIn || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
            <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-900">Sign in to sync your data</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            You're unlocked with your PIN, but not signed in with Clerk.
            Sign in to back up your expenses and sync across devices.
            Your PIN stays the same.
          </p>
        </div>

        <div className="space-y-2">
          <SignInButton mode="modal">
            <button
              type="button"
              className="w-full py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors cursor-pointer"
            >
              Sign In
            </button>
          </SignInButton>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="w-full py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Continue without signing in
          </button>
        </div>

        <p className="text-[10px] text-slate-400 text-center leading-relaxed">
          You can always sign in later from Settings → Account.
        </p>
      </div>
    </div>
  );
};

const UnlockedApp = () => {
  if (!convex) {
    return <App />;
  }

  if (clerkKey) {
    return (
      <ClerkProvider publishableKey={clerkKey}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <SyncManager />
          <LegacyClaimer />
          <ClerkSignInPrompt />
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }

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