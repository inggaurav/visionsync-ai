import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, ExternalLink, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react';
import { getApiKey, setApiKey, clearApiKey, hasApiKey, isValidKeyFormat } from '../lib/apiKey';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onCleared?: () => void;
}

type Status = 'idle' | 'format_error' | 'testing' | 'ok' | 'fail';

export function ApiKeyModal({ open, onClose, onSaved, onCleared }: Props) {
  const [value, setValue]   = useState('');
  const [show, setShow]     = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [errMsg, setErrMsg] = useState('');
  const alreadyHasKey = hasApiKey();

  useEffect(() => {
    if (open) {
      setValue('');          // never pre-fill — user must re-enter for security
      setStatus('idle');
      setErrMsg('');
      setShow(false);
    }
  }, [open]);

  const handleChange = (v: string) => {
    setValue(v);
    setStatus('idle');
    setErrMsg('');
  };

  // Live format check
  const formatOk = value.trim().length === 0 || isValidKeyFormat(value);

  const testAndSave = async () => {
    const key = value.trim();
    if (!key) { setErrMsg('Please paste your Gemini API key.'); setStatus('format_error'); return; }
    if (!isValidKeyFormat(key)) {
      setErrMsg('Gemini keys start with "AIzaSy" and are 39 characters. Check and try again.');
      setStatus('format_error'); return;
    }
    setStatus('testing');
    setErrMsg('');
    try {
      // Lightweight call — just lists models, costs nothing
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=1`
      );
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        throw new Error(`Google rejected the key (HTTP ${res.status})`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setApiKey(key);
      setStatus('ok');
      setTimeout(() => { onSaved(); onClose(); }, 700);
    } catch (e: any) {
      setStatus('fail');
      setErrMsg(e.message ?? 'Could not verify key. Check your internet connection and try again.');
    }
  };

  const handleClear = () => {
    clearApiKey();
    setValue('');
    setStatus('idle');
    onCleared?.();
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#1E293B] border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700 bg-slate-800/50">
          {/* Gemini logo mark */}
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 shrink-0">
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" fill="white" opacity="0"/>
              <path d="M12 3C7.03 3 3 7.03 3 12s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9zm0 16c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7zm-1-11h2v2h-2zm0 4h2v4h-2z" fill="white" opacity="0"/>
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71L12 2z" fill="white"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">Google Gemini API Key</h2>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {alreadyHasKey ? 'Replace your existing key' : 'Required to use VisionSync AI'}
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 py-5 space-y-4">

          {/* Info box */}
          <div className="flex gap-3 p-3 bg-blue-900/20 border border-blue-500/20 rounded-xl">
            <div className="text-blue-400 mt-0.5 shrink-0">
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd"/>
              </svg>
            </div>
            <p className="text-[11px] text-blue-200/80 leading-relaxed">
              VisionSync uses <strong className="text-blue-300">Gemini 2.0 Flash</strong> for script analysis and 
              <strong className="text-blue-300"> Gemini 2.0 Flash Image</strong> for generating visuals.
              Your key is stored <strong className="text-blue-300">only on this device</strong> — never sent to any server.
            </p>
          </div>

          {/* Input */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Paste your API Key
            </label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                className={cn(
                  'w-full bg-slate-900 border rounded-xl px-4 py-3 pr-12 text-sm font-mono focus:outline-none transition-colors placeholder:text-slate-600',
                  status === 'ok'           && 'border-green-500/60 text-green-300',
                  status === 'fail'         && 'border-red-500/60 text-red-300',
                  status === 'format_error' && 'border-orange-500/60 text-orange-300',
                  status === 'testing'      && 'border-blue-500/60 text-blue-300',
                  status === 'idle'         && !formatOk && 'border-orange-500/40 text-slate-200',
                  status === 'idle'         && formatOk  && 'border-slate-700 text-slate-200 focus:border-blue-500/60',
                )}
                placeholder="AIzaSy..."
                value={value}
                onChange={e => handleChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && testAndSave()}
                autoFocus
                spellCheck={false}
                autoComplete="off"
              />
              <button
                onClick={() => setShow(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                tabIndex={-1}
              >
                {show ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {/* Live format hint */}
            {value.length > 0 && status === 'idle' && (
              <div className={cn('flex items-center gap-1.5 mt-2 text-[10px] font-bold',
                formatOk ? 'text-green-400' : 'text-orange-400')}>
                {formatOk
                  ? <><CheckCircle2 size={11} /> Format looks correct</>
                  : <><XCircle size={11} /> Should start with "AIzaSy" and be 39 characters ({value.trim().length}/39)</>}
              </div>
            )}

            {/* Status messages */}
            {status === 'testing' && (
              <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-blue-400">
                <Loader2 size={11} className="animate-spin" /> Verifying with Google…
              </div>
            )}
            {status === 'ok' && (
              <div className="flex items-center gap-2 mt-2 text-[10px] font-bold text-green-400">
                <CheckCircle2 size={11} /> Verified! Key saved to this device.
              </div>
            )}
            {(status === 'fail' || status === 'format_error') && errMsg && (
              <div className="flex items-start gap-2 mt-2 text-[10px] text-red-400">
                <XCircle size={11} className="mt-0.5 shrink-0" /> {errMsg}
              </div>
            )}
          </div>

          {/* Get key link */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-blue-400 hover:text-blue-300 transition-colors font-medium"
          >
            <ExternalLink size={11} />
            Get a free Gemini API key at Google AI Studio
          </a>

          {/* Free tier note */}
          <div className="p-2.5 bg-slate-800/60 border border-slate-700 rounded-lg">
            <p className="text-[10px] text-slate-400 leading-relaxed">
              <span className="text-slate-300 font-bold">Free tier is enough</span> — a 1-hour lecture costs roughly $0.10–$0.50.
              The free quota on AI Studio covers your first several courses entirely.
            </p>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-700 bg-slate-800/30">
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700">
              Cancel
            </button>
            {alreadyHasKey && (
              <button onClick={handleClear} className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-900/20 transition-colors rounded-lg border border-red-500/20">
                <Trash2 size={11} /> Clear Key
              </button>
            )}
          </div>
          <button
            onClick={testAndSave}
            disabled={status === 'testing' || status === 'ok'}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl transition-all',
              status === 'testing' || status === 'ok'
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white shadow-lg shadow-blue-900/30'
            )}
          >
            {status === 'testing'
              ? <><Loader2 size={12} className="animate-spin" />Verifying…</>
              : status === 'ok'
              ? <><CheckCircle2 size={12} />Saved!</>
              : <>Verify & Save</>}
          </button>
        </div>
      </div>
    </div>
  );
}
