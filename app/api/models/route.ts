import { NextRequest, NextResponse } from "next/server";

// --- Configuration ---
const FLASK_BASE = (
  process.env.FLASK_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:5000"
)
  .replace(/\/predict\/?$/, "")
  .replace(/\/$/, "");

// --- Handler: GET (Proxy Models Status to Flask Backend) ---
export async function GET() {
  try {
    const res = await fetch(`${FLASK_BASE}/api/models`, {
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Backend status ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        status: "offline",
        error: error.message,
        models: {
          pcd_ml: { installed: false, filename: null, sizeMb: null },
          raw_mobilenet: { installed: false, filename: null, sizeMb: null },
          pcd_mobilenet: { installed: false, filename: null, sizeMb: null },
        },
      },
      { status: 200 }
    );
  }
}

// --- Handler: POST (Proxy Model Upload to Flask Backend) ---
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const res = await fetch(`${FLASK_BASE}/api/models`, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: `Gagal meneruskan upload ke Flask: ${error.message}` },
      { status: 502 }
    );
  }
}
