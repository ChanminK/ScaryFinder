import { useEffect, useState } from "react"

const API = import.meta.env.VITE_API_URL || 'http://localhost:8787'

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
      } catch(e: any) { setError(e?.message || 'failed to reccomend') }
      finally { setLoading(false) }
    }

    return (
    <div style={{ maxWidth: 860, margin: '24px auto', fontFamily: 'system-ui' }}>
      <h1>SCARYFINDER</h1>
      <p style={{ color: '#666' }}>API: <code>{API}</code></p>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}

      {!sessionId && (
        <button onClick={start} disabled={loading} style={{ padding: '8px 14px', borderRadius: 8 }}>
          {loading ? 'Starting…' : 'Start'}
        </button>
      )}

      {sessionId && question && (
        <div style={{ border: '1px solid #ddd', padding: 16, borderRadius: 10, marginTop: 12 }}>
          <div style={{ fontSize: 18, marginBottom: 12 }}>{question.text}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => answer('Yes')} disabled={loading}>Yes</button>
            <button onClick={() => answer('No')} disabled={loading}>No</button>
          </div>
        </div>
      )}

      {sessionId && !question && !rec && (
        <div style={{ marginTop: 16 }}>
          <button onClick={recommend} disabled={loading}>Get final scare</button>
        </div>
      )}

      {rec && (
        <div style={{ marginTop: 16, border: '1px solid #ddd', padding: 16, borderRadius: 10 }}>
          <h2>Orpheus picks: {rec.scare.title}</h2>
          {rec.scare.media?.poster && (
            <img
              src={`${API}/static/${rec.scare.media.poster}`}
              alt={rec.scare.title}
              style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8 }}
            />
          )}
          {rec.scare.media?.jump && (
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
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(top, null, 2)}</pre>
        </details>
      )}
    </div>
  )
}