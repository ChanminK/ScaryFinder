import React from 'react';

type Props = {
  scare: { id: string; title: string; media?: { image?: string; jump?: string } } | null;
  apiBase: string;
  onClose: (rating: number | null) => void;
};

export default function JumpscareOverlay({ scare, apiBase, onClose }: Props) {
  if (!scare) return null;

  const isVideo = !!scare.media?.jump && /\.(mp4|webm|mov|m4v)$/i.test(scare.media.jump!);
  const src = scare.media?.jump || scare.media?.image;

  return (
    <div style={{
      position:'fixed', inset:0, background:'black',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex: 9999, color:'#fff', flexDirection:'column', gap:12, padding:16
    }}>
      <div style={{ width:'min(800px, 90vw)'}}>
        {isVideo ? (
          <video src={`${apiBase}/static/${src}`} autoPlay playsInline controls style={{ width:'100%', borderRadius:8 }} />
        ) : (
          src && <img src={`${apiBase}/static/${src}`} alt={scare.title} style={{ width:'100%', borderRadius:8 }} />
        )}
      </div>
      <div>How scary? (1–10)</div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        {Array.from({length:10},(_,i)=>i+1).map(n=>(
          <button key={n} onClick={()=>onClose(n)}>{n}</button>
        ))}
      </div>
      <button onClick={()=>onClose(null)} style={{ marginTop:8, opacity:.8 }}>Close without rating</button>
    </div>
  );
}
