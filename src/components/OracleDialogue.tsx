import { useEffect, useState, type FormEvent } from 'react';
import { speakCharacter, stopCharacterVoice } from '../game/voice/characterVoice';

type ChatMessage = { role: 'oracle' | 'player'; text: string };

const ENDPOINT = 'https://tomas-cowila-ai.antonyopintor.workers.dev';

export function OracleDialogue({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'oracle', text: 'Então você chegou, Tomas… Eu sou Cowila, a Oráculo. Há muito mais nesta Matrix do que seus olhos conseguem perceber. Os Sentinelas sentem sua presença. O que deseja saber, Escolhido?' },
  ]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    const latest = messages[messages.length - 1];
    if (voiceEnabled && messages.length > 1 && latest?.role === 'oracle') speakCharacter(latest.text, 'oracle');
    return () => stopCharacterVoice();
  }, [messages, voiceEnabled]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    const history = messages.filter((item) => item.role !== 'oracle' || messages.indexOf(item) > 0).slice(-10).map((item) => ({ role: item.role === 'oracle' ? 'assistant' : 'user', content: item.text }));
    setDraft('');
    setError('');
    setMessages((current) => [...current, { role: 'player', text: message }]);
    setBusy(true);
    try {
      const response = await fetch(`${ENDPOINT}/v1/oracle-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', 'Accept': 'application/json' },
        body: JSON.stringify({ message, history, world: { character: 'Tomas', role: 'O Escolhido', setting: 'Matrix' } }),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) throw new Error(`A Oráculo retornou uma resposta inesperada (HTTP ${response.status}).`);
      const data = await response.json() as { reply?: string; error?: string };
      if (!response.ok || typeof data.reply !== 'string') throw new Error(data.error || `A Oráculo não respondeu (HTTP ${response.status}).`);
      setMessages((current) => [...current, { role: 'oracle', text: data.reply! }]);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(detail === 'Failed to fetch' || detail === 'Load failed'
        ? 'Não foi possível alcançar a Oráculo. Verifique a conexão e tente novamente; se persistir, o servidor pode estar indisponível.'
        : detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section role="dialog" aria-modal="true" aria-label="Oráculo Cowila" className="absolute inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center">
      <div className="flex max-h-[min(78vh,680px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-cyan-300/30 bg-[#071321]/95 shadow-2xl shadow-cyan-950/50">
        <header className="flex items-center justify-between border-b border-cyan-200/15 px-4 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300">A Matrix de Tomas</p>
            <h2 className="text-lg font-semibold text-slate-50">Cowila · A Oráculo</h2>
            <p className="text-xs text-slate-400">Uma inteligência nascida dentro da Matrix</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => {
              setVoiceEnabled((enabled) => {
                if (enabled) stopCharacterVoice();
                else {
                  const latest = [...messages].reverse().find((message) => message.role === 'oracle');
                  if (latest) speakCharacter(latest.text, 'oracle');
                }
                return !enabled;
              });
            }} aria-pressed={voiceEnabled} className="rounded-full border border-cyan-300/30 px-3 py-1.5 text-xs text-cyan-100 hover:bg-cyan-400/10">{voiceEnabled ? 'Voz ligada' : 'Ativar voz'}</button>
            <button type="button" onClick={() => { stopCharacterVoice(); onClose(); }} className="rounded-full border border-white/15 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10">Fechar</button>
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
          {messages.map((message, index) => (
            <div key={index} className={message.role === 'oracle' ? 'mr-8 rounded-xl border border-cyan-300/15 bg-cyan-950/35 px-3 py-2.5' : 'ml-8 rounded-xl border border-violet-300/15 bg-violet-950/30 px-3 py-2.5'}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-cyan-300">{message.role === 'oracle' ? 'Oráculo' : 'Tomas'}</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{message.text}</p>
            </div>
          ))}
          {busy && <p className="text-xs text-cyan-200 animate-pulse">A Oráculo observa os sinais da Matrix…</p>}
        </div>
        {error && <p role="alert" className="px-4 pb-2 text-xs text-amber-300">{error}</p>}
        <form onSubmit={send} className="flex gap-2 border-t border-cyan-200/15 p-3">
          <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} placeholder="Fale com a Oráculo…" disabled={busy} className="min-w-0 flex-1 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-300/60" />
          <button type="submit" disabled={busy || !draft.trim()} className="rounded-xl bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">{busy ? '…' : 'Enviar'}</button>
        </form>
      </div>
    </section>
  );
}
