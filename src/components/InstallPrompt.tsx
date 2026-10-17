// src/components/InstallPrompt.tsx
import { useState, useEffect } from 'react';
import { Share, PlusSquare, MoreVertical, MoreHorizontal, Smartphone, Apple, X, Check, Globe } from 'lucide-react';

export default function InstallPrompt({ onBypass }: { onBypass: () => void }) {
  const [device, setDevice] = useState<'none' | 'ios' | 'android'>('none');
  const [isStandalone, setIsStandalone] = useState(true);
  const [localLang, setLocalLang] = useState<'en' | 'sq'>('en');

  useEffect(() => {
    const isPWA =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    const hasBypassed = sessionStorage.getItem('lekflow:bypassed_install') === 'true';

    setIsStandalone(isPWA || hasBypassed);
  }, []);

  const handleBypass = () => {
    sessionStorage.setItem('lekflow:bypassed_install', 'true');
    setIsStandalone(true);
    onBypass();
  };

  if (isStandalone) return null;

  return (
    <div className="fixed inset-0 min-h-[100dvh] bg-white z-[9999] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      {/* Floating Language Toggle */}
      <button
        onClick={() => setLocalLang((l) => (l === 'en' ? 'sq' : 'en'))}
        className="fixed top-6 right-6 z-[100] px-4 py-2.5 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 text-slate-600 rounded-full font-black text-[10px] uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2"
      >
        <Globe size={14} className="text-emerald-600" />
        {localLang === 'en' ? 'SHQIP' : 'ENGLISH'}
      </button>

      <div className="w-16 h-16 bg-emerald-50 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-emerald-100">
        <Smartphone size={32} className="text-emerald-600" />
      </div>

      <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight text-center leading-none">
        {localLang === 'sq' ? 'Instalo LekFlow' : 'Install LekFlow'}
      </h1>
      <p className="text-slate-500 text-center text-sm font-medium leading-relaxed max-w-xs mb-10">
        {localLang === 'sq'
          ? 'Për përdorim offline dhe performancë më të mirë, instalo LekFlow direkt në pajisjen tuaj.'
          : 'For offline use and a better experience, install LekFlow directly to your device.'}
      </p>

      {device === 'none' ? (
        <div className="w-full max-w-xs space-y-4">
          <button
            onClick={() => setDevice('ios')}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 rounded-2xl p-4 flex items-center justify-center gap-3 font-bold active:scale-95 transition-all shadow-sm"
          >
            <Apple size={20} /> {localLang === 'sq' ? 'Kam iPhone' : 'I have an iPhone'}
          </button>
          <button
            onClick={() => setDevice('android')}
            className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 rounded-2xl p-4 flex items-center justify-center gap-3 font-bold active:scale-95 transition-all shadow-sm"
          >
            <Smartphone size={20} /> {localLang === 'sq' ? 'Kam Android' : 'I have an Android'}
          </button>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-white border border-slate-200 shadow-xl rounded-[2rem] p-6 sm:p-8 relative animate-in slide-in-from-bottom-4 duration-300">
          <button
            onClick={() => setDevice('none')}
            className="absolute top-5 right-5 w-8 h-8 bg-slate-100 hover:bg-slate-200 rounded-full flex items-center justify-center text-slate-500 active:scale-95 transition-colors border border-slate-200"
          >
            <X size={16} />
          </button>

          <h2 className="text-2xl font-black text-slate-900 mb-2">
            {device === 'ios'
              ? localLang === 'sq'
                ? 'Instalimi në iOS'
                : 'iOS Installation'
              : localLang === 'sq'
                ? 'Instalimi në Android'
                : 'Android Installation'}
          </h2>

          {device === 'ios' ? (
            <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-6">
              {localLang === 'sq' ? 'Duhet të jeni në Safari' : 'Must be in Safari Browser'}
            </p>
          ) : (
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-6">
              {localLang === 'sq' ? 'Duhet të jeni në Chrome' : 'Must be in Chrome Browser'}
            </p>
          )}

          <div className="space-y-6 text-slate-500 text-sm font-medium mb-8">
            {device === 'ios' ? (
              <>
                <div className="flex items-start gap-4">
                  <MoreHorizontal size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {localLang === 'sq' ? 'Shtypni ' : 'Tap the '}
                    <strong className="text-slate-900">
                      {localLang === 'sq' ? 'menunë (3 pika)' : '3-dot menu'}
                    </strong>
                    .
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <Share size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {localLang === 'sq' ? 'Shtypni ' : 'Tap the '}
                    <strong className="text-slate-900">
                      {localLang === 'sq' ? 'ikonën Share' : 'Share icon'}
                    </strong>
                    .
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <PlusSquare size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {localLang === 'sq' ? 'Rrëshqisni poshtë dhe shtypni ' : 'Scroll down and tap '}
                    <strong className="text-slate-900">Add to Home Screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {localLang === 'sq' ? 'Shtypni ' : 'Tap '}
                    <strong className="text-slate-900">Add</strong>
                    {localLang === 'sq' ? ' lart djathtas.' : ' in the top right corner.'}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-4">
                  <MoreVertical size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {localLang === 'sq' ? 'Shtypni ' : 'Tap the '}
                    <strong className="text-slate-900">
                      {localLang === 'sq' ? 'menunë (3 pika)' : '3-dot menu'}
                    </strong>
                    {localLang === 'sq' ? ' lart djathtas.' : ' in the top right corner.'}
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <PlusSquare size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {localLang === 'sq' ? 'Rrëshqisni poshtë dhe shtypni ' : 'Scroll down and tap '}
                    <strong className="text-slate-900">Add to Home screen</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-4">
                  <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                  <p>
                    {localLang === 'sq' ? 'Shtypni ' : 'Tap '}
                    <strong className="text-slate-900">Install</strong>
                    {localLang === 'sq' ? ' në dritaren e re.' : ' on the popup.'}
                  </p>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => setDevice('none')}
            className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-[11px] active:scale-[0.98] transition-all border border-slate-200"
          >
            {localLang === 'sq' ? 'Kthehu Prapa' : 'Back'}
          </button>
        </div>
      )}

      <button
        onClick={handleBypass}
        className="mt-8 text-[11px] font-black text-slate-400 underline underline-offset-4 hover:text-slate-700 transition-colors uppercase tracking-widest"
      >
        {localLang === 'sq'
          ? 'Vazhdo në shfletues'
          : 'Continue in browser'}
      </button>
    </div>
  );
}