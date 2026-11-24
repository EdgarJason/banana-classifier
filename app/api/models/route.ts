import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// --- Configuration & Constants ---
const MODELS_DIR = path.join(process.cwd(), "models");

function ensureModelsDir() {
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true });
  }
}

// --- Handler: GET (Retrieve 3 Model Statuses) ---
export async function GET() {
  try {
    ensureModelsDir();
    const files = fs.readdirSync(MODELS_DIR);

    // Section: PCD + ML
    let pcdMlFile = files.find((f) => f === "best_model.joblib") || files.find((f) => f.endsWith(".joblib") || f.endsWith(".pkl"));
    let pcdMlInfo = null;
    if (pcdMlFile) {
      const stats = fs.statSync(path.join(MODELS_DIR, pcdMlFile));
      pcdMlInfo = {
        installed: true,
        filename: pcdMlFile,
        sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
        updatedAt: stats.mtime.toISOString(),
      };
    } else {
      pcdMlInfo = { installed: false, filename: null, sizeMb: null };
    }

    // Section: Raw + MobileNetV2
    let rawMobilenetFile = files.find((f) => f === "best_finetuned_model.keras") || files.find((f) => f === "banana_model.keras") || files.find((f) => f.endsWith(".keras") && f !== "best_mixed_model.keras" && f !== "pcd_mobilenetv2.keras");
    let rawMobilenetInfo = null;
    if (rawMobilenetFile) {
      const stats = fs.statSync(path.join(MODELS_DIR, rawMobilenetFile));
      rawMobilenetInfo = {
        installed: true,
        filename: rawMobilenetFile,
        sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
        updatedAt: stats.mtime.toISOString(),
      };
    } else {
      rawMobilenetInfo = { installed: false, filename: null, sizeMb: null };
    }

    // Section: PCD + MobileNetV2 (Mixed / Segmented)
    let pcdMobilenetFile = files.find((f) => f === "best_mixed_model.keras") || files.find((f) => f === "pcd_mobilenetv2.keras");
    let pcdMobilenetInfo = null;
    if (pcdMobilenetFile) {
      const stats = fs.statSync(path.join(MODELS_DIR, pcdMobilenetFile));
      pcdMobilenetInfo = {
        installed: true,
        filename: pcdMobilenetFile,
        sizeMb: (stats.size / (1024 * 1024)).toFixed(2),
        updatedAt: stats.mtime.toISOString(),
      };
    } else {
      pcdMobilenetInfo = { installed: false, filename: null, sizeMb: null };
    }

    return NextResponse.json({
      status: "success",
      models: {
        pcd_ml: pcdMlInfo,
        raw_mobilenet: rawMobilenetInfo,
        pcd_mobilenet: pcdMobilenetInfo,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// --- Handler: POST (Upload & Save Model Files) ---
export async function POST(req: NextRequest) {
  try {
    ensureModelsDir();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const modelType = formData.get("modelType") as string | null;

    if (!file || !modelType) {
      return NextResponse.json(
        { error: "Parameter file dan modelType ('pcd_ml', 'raw_mobilenet', 'pcd_mobilenet') diperlukan." },
        { status: 400 }
      );
    }

    let targetFilename = "";
    if (modelType === "pcd_ml") {
      targetFilename = "best_model.joblib";
    } else if (modelType === "raw_mobilenet") {
      targetFilename = "best_finetuned_model.keras";
    } else if (modelType === "pcd_mobilenet") {
      targetFilename = "best_mixed_model.keras";
    } else {
      return NextResponse.json(
        { error: "Tipe model tidak valid. Gunakan 'pcd_ml', 'raw_mobilenet', atau 'pcd_mobilenet'." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const destPath = path.join(MODELS_DIR, targetFilename);

    await fs.promises.writeFile(destPath, buffer);
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);

    return NextResponse.json({
      status: "success",
      message: `Model ${modelType} berhasil diunggah sebagai ${targetFilename}!`,
      filename: targetFilename,
      sizeMb: sizeMb,
      modelType: modelType,
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
