import React, { useEffect, useRef } from "react";

type Media = { image?: string; jump?: string; audio?: string };
type Scare = { id: string; title: string; media?: Media };

const isImageExt = (p?: string) => !!p && /\.(png|jpe?g|gif|webp)$/i.test(p);
const isVideoExt = (p?: string) => !!p && /\.(mp4|webm|mov|m4v|ogg)$/i.test(p);

export default function JumpscareOverlay({
  apiBase,
  scare,
  onClose,
}: {
  apiBase: string;
  scare: Scare | null;
  onClose: (rating: number | null) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!scare) return;
    const v = videoRef.current;
    if (v) {
      v.currentTime = 0;
      v.play().catch(() => {});
    }
  }, [scare]);

  if (!scare) return null;

  const imgSrc =
    scare.media?.image
      ? `${apiBase}/static/${scare.media.image}`
      : (isImageExt(scare.media?.jump) ? `${apiBase}/static/${scare.media!.jump!}` : undefined);
  const vidSrc =
    scare.media?.jump && isVideoExt(scare.media.jump)
      ? `${apiBase}/static/${scare.media.jump}`
      : undefined;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundImage: `url(${apiBase}/static/assets/background/blackscreen.jpg)`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        display: "grid",
        gridTemplateRows: "1fr auto",
      }}
      onClick={() => onClose(null)} 
    >
      <div style={{ display: "grid", placeItems: "center", padding: 16 }}>
        <div style={{ width: "min(900px, 94vw)" }}>
          {imgSrc && (
            <img
              src={imgSrc}
              alt={scare.title}
              style={{ width: "100%", borderRadius: 12 }}
            />
          )}
          {vidSrc && (
            <video
              ref={videoRef}
              src={vidSrc}
              style={{ width: "100%", borderRadius: 12 }}
              playsInline
              autoPlay
            />
          )}
        </div>
      </div>

      <div
        style={{
          background: "rgba(0,0,0,0.7)",
          color: "white",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 600 }}>
          How scary was “{scare.title}”? (1–10)
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => onClose(n)}
              style={{
                background: "#fff",
                border: 0,
                borderRadius: 8,
                padding: "6px 10px",
                cursor: "pointer",
                minWidth: 36,
              }}
            >
              {n}
            </button>
          ))}
          <button
            onClick={() => onClose(null)}
            style={{
              background: "transparent",
              color: "#fff",
              border: "1px solid #aaa",
              borderRadius: 8,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}