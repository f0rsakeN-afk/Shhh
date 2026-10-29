import { ImageResponse } from "next/og";

export const alt = "Shhh: private rooms that vanish in one hour";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#161311",
          padding: "64px 72px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -220,
            left: 180,
            width: 900,
            height: 520,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(224,122,74,0.34) 0%, rgba(224,122,74,0.04) 70%, rgba(224,122,74,0) 100%)",
            borderRadius: "50%",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -140,
            bottom: -200,
            width: 560,
            height: 560,
            display: "flex",
            background:
              "linear-gradient(140deg, rgba(109,143,168,0.20) 0%, rgba(109,143,168,0) 70%)",
            borderRadius: "50%",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.04)",
              color: "#f0a180",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div
            style={{
              display: "flex",
              color: "#f4f1ec",
              fontSize: 28,
              fontWeight: 600,
              letterSpacing: -0.5,
            }}
          >
            Shhh
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              color: "#f0a180",
              fontSize: 20,
              letterSpacing: 3,
              textTransform: "uppercase",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 99,
                background: "#e07a4a",
                display: "flex",
              }}
            />
            Private rooms · 60 minutes
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              color: "#f7f4ef",
              fontSize: 86,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: -3,
            }}
          >
            <div style={{ display: "flex" }}>Say it. Then</div>
            <div style={{ display: "flex", color: "#f0a180" }}>let it vanish.</div>
          </div>

          <div
            style={{
              display: "flex",
              maxWidth: 760,
              color: "#a8a29a",
              fontSize: 28,
              lineHeight: 1.45,
            }}
          >
            A private chat room that deletes itself in an hour. No accounts. No
            history. No trail.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            paddingTop: 26,
            color: "#8c877f",
            fontSize: 20,
          }}
        >
          <div style={{ display: "flex" }}>One link. One hour. Nothing left.</div>
          <div style={{ display: "flex", gap: 28 }}>
            <span>No sign-up</span>
            <span>No history</span>
            <span>No trace</span>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
