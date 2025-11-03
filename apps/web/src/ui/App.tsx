import { useEffect, useState } from "react"

const API = import.meta.env.VITE_API_URL || 'http://localhost:8787'

const isImageExt = (p?: string) =>
  !!p && /\.(png|jpe?g|gif|webp)$/i.test(p);
const isVideoExt = (p?: string) =>
  !!p && /\.(mp4|webm|mov|m4v|ogg)$/i.test(p);

const pickFromTop = (top: { scareId: string; prob: number }[], scares: Scare[]) => {
  if (!top?.length) return null;
  const n = Math.min(3, top.length);
  const idx = Math.floor(Math.random() * n);
  const id = top[idx].scareId;
  return scares.find(s => s.id === id) ?? null;
};


type Question = { id: string; text: string }
type Scare = {
    id: string
    title: string
    media?: { poster?: string; image?: string; jump?: string; audio?: string }
}

export default function App() {
    const [scares, setScares] = useState<Scare[]>([])
    const [error, setError] = useState<string | null>(null)
    const [top, setTop] = useState<{ scareId: string; prob: number }[]>([])
    const [rec, setRec] = useState<{ scare: Scare; prob: number } | null>(null)
    const [loading, setLoading] = useState(false)
    const [question, setQuestion] = useState<Question | null>(null)
    const [sessionId, setSessionId] = useState<string>("")
    const bgUrl = `${API}/static/assets/background/halloweenbackground.jpg`;
    const [probeScare, setProbeScare] = useState<Scare|null>(null);

    useEffect(() => {
      fetch(`${API}/manifest`)
        .then(r => r.json())
        .then(d => setScares(d?.manifest?.scares ?? []))
        .catch(() => {/* ignore */});
    }, []);

    async function start() {
      setLoading(true); setError(null); setRec(null)
      try {
        const r = await fetch(`${API}/session/start`, { method: 'POST' })
        const data = await r.json()
        setSessionId(data.sessionId)
        setQuestion(data.question)
        setTop(data.top)

      } catch (e: any) { setError(e?.message || 'failed to start') }
      finally { setLoading(false) }
    }

    useEffect(() => {
      if (!sessionId || !question) return;

      const ready = scares.length > 0 && top.length > 0;
      const delayMs =
        Number((import.meta as any).env?.VITE_PROBE_DELAY_MS) ||
        Math.floor(5000 + Math.random() * 5000); 

      const t = window.setTimeout(() => {
        if (!ready) return; 
        const choice = pickFromTop(top, scares) || scares[Math.floor(Math.random() * scares.length)];
        if (choice) setProbeScare(choice);
      }, delayMs);

      return () => window.clearTimeout(t);
    }, [
      sessionId,
      question?.id,
      scares.length,        
      top.length              
    ]);


    async function submitProbe(rating: number | null) {
      const s = probeScare;
      setProbeScare(null);
      if (!s || rating == null || !sessionId) return;
      try {
        await fetch(`${API}/probe`, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ sessionId, scareId: s.id, rating })
        });
      } catch { /* IGNORE */ }
    }


    async function answer(a: 'Yes'|'No') {
      if (!sessionId || !question) return
      setLoading(true); setError(null)
      try {
        const r = await fetch(`${API}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, questionId: question.id, answer: a})
        })
        const data = await r.json()
        setQuestion(data.next)
        setTop(data.top)
        if (!data.next) {
          await recommend()
        }
      } catch (e: any) { setError(e?.message || 'failed to answer') }
      finally { setLoading(false) }
    }

    async function recommend() {
      if (!sessionId) return
      setLoading(true); setError(null)
      try {
        const r = await fetch(`${API}/recommendation`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        })
        const data = await r.json()
        setRec(data)
      } catch(e: any) { setError(e?.message || 'failed to recommend') }
      finally { setLoading(false) }
    }

    function ProbeOverlay({ scare, onClose }:{
  scare: Scare|null;
  onClose: (rating: number|null) => void;
}) {
  if (!scare) return null;

  const imgSrc =
    scare.media?.image && /\.(png|jpe?g|gif|webp)$/i.test(scare.media.image)
      ? `${API}/static/${scare.media.image}`
      : (scare.media?.jump && isImageExt(scare.media.jump)
          ? `${API}/static/${scare.media.jump}`
          : undefined);

  const vidSrc =
    scare.media?.jump && isVideoExt(scare.media.jump)
      ? `${API}/static/${scare.media.jump}`
      : undefined;

  return (
    <div
      onClick={() => onClose(null)}
      style={{
        position:'fixed', inset:0, zIndex:9999,
        backgroundImage:`url(${API}/static/assets/background/blackscreen.jpg)`,
        backgroundSize:'cover', backgroundPosition:'center',
        display:'grid', gridTemplateRows:'1fr auto'
      }}
    >
      <div style={{ display:'grid', placeItems:'center', padding:16 }} onClick={e=>e.stopPropagation()}>
        <div style={{ width:'min(900px,94vw)' }}>
          {imgSrc && <img src={imgSrc} alt={scare.title} style={{ width:'100%', borderRadius:12 }} />}
          {vidSrc && (
            <video
              src={vidSrc}
              style={{ width:'100%', borderRadius:12 }}
              playsInline
              autoPlay
              preload="auto"
              muted
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                v.play().catch(() => { });
              }}
            />
          )}
        </div>
      </div>
      <div
        onClick={e=>e.stopPropagation()}
        style={{ background:'rgba(0,0,0,0.7)', color:'#fff', padding:'12px 16px',
                 display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}
      >
        <div style={{ fontWeight:600 }}>How scary was “{scare.title}”? (1–10)</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {Array.from({length:10},(_,i)=>i+1).map(n=>(
            <button key={n} onClick={()=>onClose(n)}
              style={{ background:'#fff', border:0, borderRadius:8, padding:'6px 10px', minWidth:36, cursor:'pointer' }}>
              {n}
            </button>
          ))}
          <button onClick={()=>onClose(null)}
            style={{ background:'transparent', color:'#fff', border:'1px solid #aaa', borderRadius:8, padding:'6px 10px', cursor:'pointer' }}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}


  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${bgUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        color: 'white',
        fontFamily: 'system-ui'
      }}
    >
      <div style={{ maxWidth: 860, margin: '24px auto', padding: '0 16px' }}>
        <h1 style={{ letterSpacing: 1 }}>SCARYFINDER</h1>
        <p style={{ color: '#ddd' }}>API: <code>{API}</code></p>
        {error && <p style={{ color: 'salmon' }}>Error: {error}</p>}

        {sessionId && (
          <div style={{ marginTop: 8 }}>
            <button
              onClick={() => {
                const choice = pickFromTop(top, scares) || scares[Math.floor(Math.random() * Math.max(1, scares.length))];
                if (choice) setProbeScare(choice);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.08)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              DEBUG: Force jumpscare
            </button>
          </div>
      )}

        {sessionId && question && (
          <div
            style={{
              border: '1px solid rgba(255,255,255,0.2)',
              background: 'rgba(0,0,0,0.35)',
              padding: 16,
              borderRadius: 10,
              marginTop: 12
            }}
          >
            <div style={{ fontSize: 18, marginBottom: 12 }}>{question.text}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => answer('Yes')}
                disabled={loading}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                Yes
              </button>
              <button
                onClick={() => answer('No')}
                disabled={loading}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.1)',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                No
              </button>
            </div>
          </div>
        )}

        {sessionId && !question && !rec && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={recommend}
              disabled={loading}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              Get final scare
            </button>
          </div>
        )}

        {rec && (
          <div style={{ marginTop: 16, border: '1px solid #ddd', padding: 16, borderRadius: 10 }}>
            <h2>Orpheus picks: {rec.scare.title}</h2>

            {rec.scare.media?.image && (
              <img
                src={`${API}/static/${rec.scare.media.image}`}
                alt={rec.scare.title}
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8 }}
              />
            )}

            {!rec.scare.media?.image && isImageExt(rec.scare.media?.jump) && (
              <img
                src={`${API}/static/${rec.scare.media!.jump!}`}
                alt={rec.scare.title}
                style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8 }}
              />
            )}

            {rec.scare.media?.jump && isVideoExt(rec.scare.media.jump) && (
              <details style={{ marginTop: 8 }}>
                <summary>Play jump</summary>
                <video
                  src={`${API}/static/${rec.scare.media.jump}`}
                  style={{ width: '100%', marginTop: 8, borderRadius: 6 }}
                  controls
                  playsInline
                />
              </details>
            )}

            <p style={{ color: '#666' }}>confidence: {(rec.prob * 100).toFixed(1)}%</p>
          </div>
        )}

        {top.length > 0 && (
          <details style={{ marginTop: 16 }}>
            <summary>Debug: top candidates</summary>
            <pre style={{ whiteSpace: 'pre-wrap', color: '#ddd' }}>
              {JSON.stringify(top, null, 2)}
            </pre>
          </details>
        )}
      </div>
      <ProbeOverlay scare={probeScare} onClose={submitProbe} />
    </div>
  );
}