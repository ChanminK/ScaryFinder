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

    useEffect(() => {
        ;(async () => {
            try {
                const r = await fetch(`${API}/manifest`)
                const data = await r.json()
                setScares(data.manifest?.scares ?? [])
            } catch (e: any) {
                setError(e?.message || 'failed to fetch')
            }
        })()
    }, [])

    return (
    <div style={{ maxWidth: 960, margin: '24px auto', fontFamily: 'system-ui' }}>
      <h1>SCARYFINDER</h1>
      <p style={{ color: '#666' }}>API: <code>{API}</code></p>
      {error && <p style={{ color: 'crimson' }}>Error: {error}</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {scares.slice(0, 12).map((s) => (
          <div key={s.id} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, lineHeight: 1.2 }}>{s.title}</div>

            {s.media?.poster && (
              <img
                src={`${API}/static/${s.media.poster}`}
                alt={s.title}
                style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 6 }}
              />
            )}

            {!s.media?.poster && s.media?.image && (
              <img
                src={`${API}/static/${s.media.image}`}
                alt={s.title}
                style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 6 }}
              />
            )}

            {s.media?.jump && (
              <details style={{ marginTop: 8 }}>
                <summary>Play jump (preview)</summary>
                <video
                  src={`${API}/static/${s.media.jump}`}
                  style={{ width: '100%', marginTop: 8, borderRadius: 6 }}
                  controls
                  playsInline
                />
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}