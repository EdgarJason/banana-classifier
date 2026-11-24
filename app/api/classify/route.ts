import { NextRequest, NextResponse } from "next/server";

// --- Configuration ---
const FLASK_URL =
  process.env.FLASK_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:5000/predict";

// --- Handler: POST (Proxy Image Classification to Flask Backend) ---
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Tidak ada file gambar yang diunggah." },
        { status: 400 }
      );
    }

    const forwardFormData = new FormData();
    forwardFormData.append("file", file);

    const targetUrl = FLASK_URL.endsWith("/predict")
      ? FLASK_URL
      : `${FLASK_URL.replace(/\/$/, "")}/predict`;

    const response = await fetch(targetUrl, {
      method: "POST",
      body: forwardFormData,
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Backend Flask error (${response.status}): ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      {
        error: `Gagal menghubungi backend Flask di ${FLASK_URL}: ${error.message}. Pastikan server Flask sudah berjalan.`,
      },
      { status: 502 }
    );
  }
}
