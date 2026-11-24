import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// --- Handler: POST (Process Image Classification) ---
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "Tidak ada file gambar yang diunggah" },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempFilePath = path.join(os.tmpdir(), `banana_${Date.now()}_${file.name}`);
    await fs.promises.writeFile(tempFilePath, buffer);

    const scriptPath = path.join(process.cwd(), "scripts", "predict.py");

    return new Promise<NextResponse>((resolve) => {
      const pyProcess = spawn("python", [scriptPath, tempFilePath]);

      let outputData = "";
      let errorData = "";

      pyProcess.stdout.on("data", (data) => {
        outputData += data.toString();
      });

      pyProcess.stderr.on("data", (data) => {
        errorData += data.toString();
      });

      pyProcess.on("close", async () => {
        try {
          if (fs.existsSync(tempFilePath)) {
            await fs.promises.unlink(tempFilePath);
          }
        } catch {
          // Ignore temp file cleanup error
        }

        try {
          const jsonMatch = outputData.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error(outputData.trim() || errorData.trim() || "Tidak ada respon JSON dari model");
          }

          const jsonResult = JSON.parse(jsonMatch[0]);
          if (jsonResult.error) {
            resolve(
              NextResponse.json(
                {
                  error: jsonResult.error,
                  detail: errorData || undefined,
                },
                { status: 500 }
              )
            );
          } else {
            resolve(NextResponse.json(jsonResult));
          }
        } catch (parseErr: unknown) {
          const err = parseErr as Error;
          resolve(
            NextResponse.json(
              {
                error: err.message || "Gagal memproses hasil prediksi model",
                rawOutput: outputData,
                rawError: errorData,
              },
              { status: 500 }
            )
          );
        }
      });
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
