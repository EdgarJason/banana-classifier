"use client";

import React, { useState, useRef, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  UploadCloud,
  Image as ImageIcon,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Zap,
  Cpu,
  Binary,
  Clock,
  CheckCircle2,
  FolderUp,
  X,
} from "lucide-react";

// --- Types & Interfaces ---
export type RipenessState = "ripe" | "half_ripe" | "unripe";

export interface ExperimentResult {
  name: string;
  method?: string;
  prediction?: RipenessState | null;
  confidence?: number | null;
  available?: boolean;
  status_text?: string;
  note?: string;
  model_file?: string;
}

interface MultiModelResponse {
  prediction: RipenessState;
  confidence: number;
  experiments: {
    pcd_ml: ExperimentResult;
    raw_mobilenet: ExperimentResult;
    pcd_mobilenet: ExperimentResult;
  };
}

interface ModelInfo {
  installed: boolean;
  filename: string | null;
  sizeMb: string | null;
  updatedAt?: string;
}

interface ModelsStatus {
  pcd_ml: ModelInfo;
  raw_mobilenet: ModelInfo;
  pcd_mobilenet: ModelInfo;
}

const RIPENESS_LABELS: Record<RipenessState, { label: string; sub: string; color: string }> = {
  ripe: { label: "RIPE", sub: "Pisang Matang", color: "text-amber-400" },
  half_ripe: { label: "HALF RIPE", sub: "Setengah Matang", color: "text-lime-400" },
  unripe: { label: "UNRIPE", sub: "Pisang Mentah", color: "text-emerald-400" },
};

// --- Minion Mascot & Logo Components ---
function MinionLogoIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <path d="M46 15 Q 43 7 38 4" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M50 14 Q 50 5 50 2" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M54 15 Q 57 7 62 4" stroke="#1E293B" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="20" y="14" width="60" height="72" rx="30" fill="#FACC15" stroke="#CA8A04" strokeWidth="2.5" />
      <rect x="18" y="38" width="64" height="11" rx="2" fill="#0F172A" />
      <circle cx="40" cy="43.5" r="14" fill="#94A3B8" stroke="#334155" strokeWidth="2" />
      <circle cx="40" cy="43.5" r="10" fill="#FFFFFF" />
      <circle cx="40" cy="43.5" r="5" fill="#92400E" />
      <circle cx="40" cy="43.5" r="3" fill="#0F172A" />
      <circle cx="38" cy="41.5" r="1.5" fill="#FFFFFF" />
      <circle cx="60" cy="43.5" r="14" fill="#94A3B8" stroke="#334155" strokeWidth="2" />
      <circle cx="60" cy="43.5" r="10" fill="#FFFFFF" />
      <circle cx="60" cy="43.5" r="5" fill="#92400E" />
      <circle cx="60" cy="43.5" r="3" fill="#0F172A" />
      <circle cx="58" cy="41.5" r="1.5" fill="#FFFFFF" />
      <path d="M42 65 Q 50 73 58 65" fill="none" stroke="#451A03" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function MinionDropzoneMascot({ state }: { state: "idle" | "scanning" | RipenessState }) {
  const isRipe = state === "ripe";
  const isHalf = state === "half_ripe";
  const isUnripe = state === "unripe";
  const isScanning = state === "scanning";

  return (
    <div className="relative flex flex-col items-center mb-2 pointer-events-none">
      <svg
        viewBox="0 0 240 280"
        className={`w-20 h-24 sm:w-24 sm:h-28 drop-shadow-xl transition-all duration-500 ${
          isRipe
            ? "animate-bounce-joy"
            : isScanning
            ? "animate-pulse"
            : isHalf
            ? "rotate-2"
            : isUnripe
            ? "-rotate-2"
            : "animate-float-slow"
        }`}
      >
        <defs>
          <linearGradient id="minionSkin" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FDE047" />
            <stop offset="60%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#EAB308" />
          </linearGradient>

          <linearGradient id="denimBlue" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>

          <linearGradient id="goggleMetal" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#CBD5E1" />
            <stop offset="50%" stopColor="#94A3B8" />
            <stop offset="100%" stopColor="#64748B" />
          </linearGradient>

          <radialGradient id="irisBrown" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#B45309" />
            <stop offset="70%" stopColor="#78350F" />
            <stop offset="100%" stopColor="#451A03" />
          </radialGradient>
        </defs>

        <path d="M105 32 Q 95 10 75 8" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
        <path d="M115 30 Q 112 8 100 2" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
        <path d="M120 29 Q 120 6 120 0" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M125 30 Q 128 8 140 2" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />
        <path d="M135 32 Q 145 10 165 8" stroke="#1E293B" strokeWidth="3" strokeLinecap="round" />

        <rect
          x="60"
          y="30"
          width="120"
          height="175"
          rx="60"
          fill="url(#minionSkin)"
          stroke="#CA8A04"
          strokeWidth="3.5"
        />

        <rect x="58" y="75" width="124" height="20" rx="3" fill="#0F172A" />

        <circle cx="95" cy="85" r="26" fill="url(#goggleMetal)" stroke="#334155" strokeWidth="2.5" />
        <circle cx="95" cy="85" r="21" fill="#475569" />

        <g className="animate-minion-blink" style={{ transformOrigin: "95px 85px" }}>
          <circle cx="95" cy="85" r="19" fill="#FFFFFF" />
          <g className="animate-pupil-glance">
            <circle
              cx={isScanning ? 97 : isHalf ? 93 : 95}
              cy={isScanning ? 83 : 86}
              r="9.5"
              fill="url(#irisBrown)"
              stroke="#291206"
              strokeWidth="0.8"
            />
            <circle cx={isScanning ? 97 : isHalf ? 93 : 95} cy={isScanning ? 83 : 86} r="5.5" fill="#0A0F1D" />
            <circle cx={isScanning ? 94 : isHalf ? 90 : 92.5} cy={isScanning ? 80.5 : 83.5} r="2.5" fill="#FFFFFF" />
            <circle cx={isScanning ? 98 : isHalf ? 94 : 96} cy={isScanning ? 85.5 : 88} r="1.2" fill="#FFFFFF" opacity="0.85" />
          </g>
        </g>

        <circle cx="145" cy="85" r="26" fill="url(#goggleMetal)" stroke="#334155" strokeWidth="2.5" />
        <circle cx="145" cy="85" r="21" fill="#475569" />

        <g className="animate-minion-blink" style={{ transformOrigin: "145px 85px" }}>
          <circle cx="145" cy="85" r="19" fill="#FFFFFF" />
          <g className="animate-pupil-glance">
            <circle
              cx={isScanning ? 147 : isHalf ? 148 : 145}
              cy={isScanning ? 83 : 86}
              r="9.5"
              fill="url(#irisBrown)"
              stroke="#291206"
              strokeWidth="0.8"
            />
            <circle cx={isScanning ? 147 : isHalf ? 148 : 145} cy={isScanning ? 83 : 86} r="5.5" fill="#0A0F1D" />
            <circle cx={isScanning ? 144 : isHalf ? 145 : 142.5} cy={isScanning ? 80.5 : 83.5} r="2.5" fill="#FFFFFF" />
            <circle cx={isScanning ? 148 : isHalf ? 149 : 146} cy={isScanning ? 85.5 : 88} r="1.2" fill="#FFFFFF" opacity="0.85" />
          </g>
        </g>

        <rect x="117" y="80" width="6" height="10" fill="#94A3B8" rx="1.5" stroke="#475569" strokeWidth="0.8" />

        {isScanning && (
          <ellipse cx="120" cy="85" rx="45" ry="10" fill="#38BDF8" opacity="0.6" className="animate-pulse" />
        )}

        {isRipe ? (
          <g>
            <path d="M92 120 Q 120 152 148 120 Z" fill="#7F1D1D" stroke="#0F172A" strokeWidth="2.5" />
            <path d="M96 122 Q 120 132 144 122" fill="#FFFFFF" />
            <path d="M106 142 Q 120 148 134 142" fill="#F43F5E" />
          </g>
        ) : isHalf ? (
          <path d="M98 126 Q 118 135 142 122" fill="none" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
        ) : isUnripe ? (
          <ellipse cx="120" cy="126" rx="8" ry="7" fill="#7F1D1D" stroke="#0F172A" strokeWidth="2.5" />
        ) : isScanning ? (
          <line x1="102" y1="126" x2="138" y2="126" stroke="#451A03" strokeWidth="3" strokeLinecap="round" />
        ) : (
          <path d="M98 122 Q 120 140 142 122" fill="none" stroke="#451A03" strokeWidth="3.5" strokeLinecap="round" />
        )}

        <path
          d="M60 165 C 60 155, 66 150, 76 150 L 164 150 C 174 150, 180 155, 180 165 L 180 210 L 60 210 Z"
          fill="url(#denimBlue)"
          stroke="#1E3A8A"
          strokeWidth="2"
        />
        <polygon points="56,152 74,152 82,185 64,185" fill="#1D4ED8" stroke="#1E3A8A" strokeWidth="1.5" />
        <circle cx="73" cy="180" r="3.5" fill="#E2E8F0" stroke="#475569" strokeWidth="1" />
        <polygon points="184,152 166,152 158,185 176,185" fill="#1D4ED8" stroke="#1E3A8A" strokeWidth="1.5" />
        <circle cx="167" cy="180" r="3.5" fill="#E2E8F0" stroke="#475569" strokeWidth="1" />

        <rect x="100" y="165" width="40" height="32" rx="6" fill="#1E40AF" stroke="#1D4ED8" strokeWidth="1.5" />
        <circle cx="120" cy="181" r="9" fill="#0F172A" />
        <text x="120" y="185" textAnchor="middle" fontSize="11" fontWeight="bold" fill="#FACC15" fontFamily="sans-serif">
          G
        </text>

        {isRipe ? (
          <g>
            <path d="M58 140 Q 30 110 38 80" fill="none" stroke="#FACC15" strokeWidth="14" strokeLinecap="round" />
            <circle cx="36" cy="74" r="9" fill="#0F172A" />
            <text x="24" y="66" fontSize="24">🍌</text>
            <path d="M182 140 Q 210 110 202 80" fill="none" stroke="#FACC15" strokeWidth="14" strokeLinecap="round" />
            <circle cx="204" cy="74" r="9" fill="#0F172A" />
            <text x="194" y="66" fontSize="24">🍌</text>
          </g>
        ) : (
          <g>
            <path d="M56 145 Q 36 170 42 195" fill="none" stroke="#FACC15" strokeWidth="13" strokeLinecap="round" />
            <circle cx="42" cy="198" r="8" fill="#0F172A" />
            <path d="M184 145 Q 204 170 198 195" fill="none" stroke="#FACC15" strokeWidth="13" strokeLinecap="round" />
            <circle cx="198" cy="198" r="8" fill="#0F172A" />
          </g>
        )}

        <rect x="90" y="210" width="22" height="16" fill="#1D4ED8" />
        <ellipse cx="98" cy="228" rx="14" ry="7" fill="#0F172A" />
        <rect x="128" y="210" width="22" height="16" fill="#1D4ED8" />
        <ellipse cx="142" cy="228" rx="14" ry="7" fill="#0F172A" />
      </svg>
    </div>
  );
}

// --- Main Page Component ---
export default function BananaClassifierPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanMessage, setScanMessage] = useState("");

  const [resultsData, setResultsData] = useState<MultiModelResponse | null>(null);
  const [showModelManager, setShowModelManager] = useState(false);
  const [uploadingModel, setUploadingModel] = useState<string | null>(null);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);

  const [modelsStatus, setModelsStatus] = useState<ModelsStatus>({
    pcd_ml: { installed: false, filename: null, sizeMb: null },
    raw_mobilenet: { installed: false, filename: null, sizeMb: null },
    pcd_mobilenet: { installed: false, filename: null, sizeMb: null },
  });

  const backendUrl = "/api/classify";
  const [backendError, setBackendError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelUploadInputRef = useRef<HTMLInputElement>(null);
  const currentUploadTargetRef = useRef<"pcd_ml" | "raw_mobilenet" | "pcd_mobilenet">("pcd_ml");

  // --- Model Status Loader ---
  const fetchModelsStatus = async () => {
    try {
      const res = await fetch("/api/models");
      if (res.ok) {
        const data = await res.json();
        if (data.models) {
          setModelsStatus(data.models);
        }
      }
    } catch {
      // Ignored
    }
  };

  useEffect(() => {
    fetchModelsStatus();
  }, []);

  // --- Model Upload Handlers ---
  const handleModelFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const targetType = currentUploadTargetRef.current;
    setUploadingModel(targetType);
    setUploadSuccessMsg(null);
    setBackendError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("modelType", targetType);

      const res = await fetch("/api/models", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Gagal mengunggah file model");
      }

      setUploadSuccessMsg(`✓ File ${data.filename} (${data.sizeMb} MB) berhasil dipasang!`);
      await fetchModelsStatus();

      setTimeout(() => {
        setUploadSuccessMsg(null);
      }, 5000);
    } catch (err: unknown) {
      const error = err as Error;
      setBackendError(`Gagal upload model: ${error.message}`);
    } finally {
      setUploadingModel(null);
      if (modelUploadInputRef.current) modelUploadInputRef.current.value = "";
    }
  };

  const triggerModelUpload = (type: "pcd_ml" | "raw_mobilenet" | "pcd_mobilenet") => {
    currentUploadTargetRef.current = type;
    if (modelUploadInputRef.current) {
      if (type === "pcd_ml") {
        modelUploadInputRef.current.accept = ".joblib,.pkl";
      } else {
        modelUploadInputRef.current.accept = ".keras,.h5";
      }
      modelUploadInputRef.current.click();
    }
  };

  // --- Confetti Animation ---
  useEffect(() => {
    if (resultsData && resultsData.prediction === "ripe") {
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.55 },
          colors: ["#FACC15", "#F59E0B", "#FDE047", "#38BDF8"],
        });
      } catch {
        // Fallback
      }
    }
  }, [resultsData]);

  // --- Image Upload Handlers ---
  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Harap unggah file berformat gambar (JPG, PNG, WebP).");
      return;
    }
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImage(e.target?.result as string);
      setResultsData(null);
      setBackendError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // --- Classification Execution ---
  const runDetection = async () => {
    if (!selectedImage || !imageFile) return;

    setIsScanning(true);
    setScanProgress(25);
    setScanMessage("Minion sedang memeriksa gambar...");
    setBackendError(null);

    try {
      setScanProgress(55);
      setScanMessage("Mengekstraksi fitur PCD dan menjalankan 3 model...");

      const formData = new FormData();
      formData.append("file", imageFile);

      const response = await fetch(backendUrl, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Server error: ${response.status}`);
      }

      const data = await response.json();
      setScanProgress(90);
      setScanMessage("Menyelesaikan komparasi 3 eksperimen...");

      if (data.experiments) {
        setResultsData(data);
      }
    } catch (err: unknown) {
      const error = err as Error;
      setBackendError(`Gagal menghubungi inferensi: ${error.message}`);
    } finally {
      setScanProgress(100);
      setIsScanning(false);
    }
  };

  const resetAll = () => {
    setSelectedImage(null);
    setImageFile(null);
    setResultsData(null);
    setBackendError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Visual Theme Section ---
  const getTheme = () => {
    const mainPred = resultsData?.prediction;
    if (!mainPred) {
      return {
        accent: "from-yellow-400 via-amber-400 to-yellow-500",
        border: "border-yellow-500/30",
        glow: "rgba(234, 179, 8, 0.15)",
        textColor: "text-yellow-400",
      };
    }
    switch (mainPred) {
      case "ripe":
        return {
          accent: "from-amber-400 via-yellow-300 to-amber-500",
          border: "border-amber-400/60",
          glow: "rgba(245, 158, 11, 0.3)",
          textColor: "text-amber-400",
        };
      case "half_ripe":
        return {
          accent: "from-lime-400 via-yellow-300 to-lime-500",
          border: "border-lime-400/60",
          glow: "rgba(132, 204, 22, 0.3)",
          textColor: "text-lime-400",
        };
      case "unripe":
        return {
          accent: "from-emerald-400 via-teal-300 to-emerald-500",
          border: "border-emerald-400/60",
          glow: "rgba(16, 185, 129, 0.3)",
          textColor: "text-emerald-400",
        };
    }
  };

  const getConfidenceStyle = (confidence?: number | null) => {
    const val = confidence ?? 0;
    if (val > 70) {
      return {
        bar: "from-emerald-400 to-emerald-500",
        text: "text-emerald-400",
      };
    }
    if (val >= 40) {
      return {
        bar: "from-amber-400 to-orange-500",
        text: "text-amber-400",
      };
    }
    return {
      bar: "from-rose-500 to-red-600",
      text: "text-rose-400",
    };
  };

  const theme = getTheme();
  const currentState = isScanning ? "scanning" : resultsData ? resultsData.prediction : "idle";
  const activeModelsCount = [
    modelsStatus.pcd_ml.installed,
    modelsStatus.raw_mobilenet.installed,
    modelsStatus.pcd_mobilenet.installed,
  ].filter(Boolean).length;

  // --- JSX Layout ---
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#090d16] text-slate-100 flex flex-col justify-between">
      <div
        className="pointer-events-none fixed top-[-10%] left-[-10%] w-[55vw] h-[55vw] rounded-full blur-[140px] transition-all duration-1000"
        style={{ background: theme.glow }}
      />
      <div
        className="pointer-events-none fixed bottom-[-10%] right-[-10%] w-[45vw] h-[45vw] rounded-full blur-[130px] transition-all duration-1000 opacity-60"
        style={{ background: theme.glow }}
      />

      <input
        ref={modelUploadInputRef}
        type="file"
        className="hidden"
        onChange={handleModelFileSelected}
      />

      {/* --- Section: Header --- */}
      <header className="relative z-20 border-b border-white/5 backdrop-blur-xl bg-slate-950/70 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="transform hover:rotate-12 transition-transform">
              <MinionLogoIcon className="w-10 h-10 drop-shadow-md" />
            </div>
            <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-1.5">
              Banana<span className="bg-gradient-to-r from-yellow-400 to-amber-300 bg-clip-text text-transparent">Lens</span>
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowModelManager(!showModelManager)}
              className="flex items-center gap-2 text-xs px-3.5 py-2 rounded-xl bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 transition-all font-semibold active:scale-95"
            >
              <FolderUp className="w-4 h-4 text-yellow-400" />
              <span>Kelola & Upload 3 Model</span>
              <span className="px-1.5 py-0.2 rounded-md bg-yellow-400/20 text-[10px] font-mono">
                {activeModelsCount}/3 Siap
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* --- Section: Model Manager Drawer --- */}
      {showModelManager && (
        <div className="relative z-20 max-w-6xl mx-auto w-full px-6 pt-4">
          <div className="p-5 rounded-3xl bg-slate-900/95 border border-white/15 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Ubah Model Disini
                </h3>
              </div>

              <button
                onClick={() => setShowModelManager(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {uploadSuccessMsg && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                <span>{uploadSuccessMsg}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Slot 1: PCD + ML */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      1. PCD + ML
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                      .joblib / .pkl
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                  <div className="text-[11px] flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    {modelsStatus.pcd_ml.installed ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Terpasang ({modelsStatus.pcd_ml.sizeMb} MB)
                      </span>
                    ) : (
                      <span className="text-slate-500">Belum diunggah</span>
                    )}
                  </div>

                  <button
                    onClick={() => triggerModelUpload("pcd_ml")}
                    disabled={uploadingModel === "pcd_ml"}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-yellow-400 hover:text-slate-950 font-bold text-xs text-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{uploadingModel === "pcd_ml" ? "Mengunggah..." : "Unggah File .joblib"}</span>
                  </button>
                </div>
              </div>

              {/* Slot 2: Raw + MobileNetV2 */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      2. Raw + MobileNetV2
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                      .keras / .h5
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                  <div className="text-[11px] flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    {modelsStatus.raw_mobilenet.installed ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Terpasang ({modelsStatus.raw_mobilenet.sizeMb} MB)
                      </span>
                    ) : (
                      <span className="text-slate-500">Belum diunggah</span>
                    )}
                  </div>

                  <button
                    onClick={() => triggerModelUpload("raw_mobilenet")}
                    disabled={uploadingModel === "raw_mobilenet"}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-yellow-400 hover:text-slate-950 font-bold text-xs text-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{uploadingModel === "raw_mobilenet" ? "Mengunggah..." : "Unggah File .keras"}</span>
                  </button>
                </div>
              </div>

              {/* Slot 3: PCD + MobileNetV2 */}
              <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      3. PCD + MobileNetV2
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-slate-400">
                      .keras / .h5
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                  <div className="text-[11px] flex items-center justify-between">
                    <span className="text-slate-400">Status:</span>
                    {modelsStatus.pcd_mobilenet.installed ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Terpasang ({modelsStatus.pcd_mobilenet.sizeMb} MB)
                      </span>
                    ) : (
                      <span className="text-yellow-400/80 font-medium">Belum Diunggah</span>
                    )}
                  </div>

                  <button
                    onClick={() => triggerModelUpload("pcd_mobilenet")}
                    disabled={uploadingModel === "pcd_mobilenet"}
                    className="w-full py-2 px-3 rounded-xl bg-white/10 hover:bg-yellow-400 hover:text-slate-950 font-bold text-xs text-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{uploadingModel === "pcd_mobilenet" ? "Mengunggah..." : "Unggah File .keras"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Section: Main Content --- */}
      <main className="relative z-10 max-w-6xl mx-auto w-full px-6 py-8 flex-1 flex flex-col justify-center">
        {backendError && (
          <div className="mb-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <p>{backendError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Section: Upload Dropzone & Minion Mascot */}
          <div className="lg:col-span-6 flex flex-col">
            <div className="rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl p-6 shadow-2xl flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-white">
                      Halaman Upload Gambar Pisang
                    </h2>
                    <p className="text-xs text-slate-400">
                      Foto akan diuji ke 3 eksperimen model (PCD + ML, Raw + MobileNetV2, PCD + MobileNetV2)
                    </p>
                  </div>
                  {selectedImage && (
                    <button
                      onClick={resetAll}
                      className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-rose-500/10"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                  )}
                </div>

                {!selectedImage ? (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={`group relative min-h-[320px] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 ${
                      isDragging
                        ? "border-yellow-400 bg-yellow-400/10 scale-[0.99]"
                        : "border-white/15 bg-slate-950/40 hover:border-yellow-400/60 hover:bg-slate-950/60"
                    }`}
                  >
                    <MinionDropzoneMascot state={currentState} />

                    <h3 className="text-base font-bold text-white group-hover:text-yellow-300 transition-colors mt-1">
                      Pilih atau Drop Gambar Pisang
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Format PNG, JPG, JPEG, WebP
                    </p>

                    <div className="flex items-center justify-center gap-3 mt-4">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 text-slate-950 font-bold text-xs shadow-lg shadow-yellow-500/25 hover:brightness-110 active:scale-95 transition-all"
                      >
                        <UploadCloud className="w-4 h-4" />
                        Pilih File
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="relative rounded-2xl overflow-hidden bg-black/60 border border-white/15 min-h-[320px] flex items-center justify-center group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedImage}
                      alt="Pisang yang diunggah"
                      className="max-h-[320px] w-full object-contain p-2 rounded-2xl"
                    />

                    {isScanning && (
                      <div className="absolute inset-0 pointer-events-none bg-yellow-400/5 backdrop-blur-[1px] flex flex-col justify-between p-4">
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-t-2 border-l-2 border-yellow-400" />
                          <div className="w-6 h-6 border-t-2 border-r-2 border-yellow-400" />
                        </div>
                        <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent shadow-[0_0_15px_#facc15] animate-scan" />
                        <div className="self-center px-3 py-1.5 rounded-full bg-black/80 border border-yellow-400/50 text-[11px] font-mono text-yellow-300 flex items-center gap-2">
                          <Zap className="w-3.5 h-3.5 animate-pulse" />
                          <span>PROCESSING 3 EXPERIMENTS ({scanProgress}%)</span>
                        </div>
                        <div className="flex justify-between">
                          <div className="w-6 h-6 border-b-2 border-l-2 border-yellow-400" />
                          <div className="w-6 h-6 border-b-2 border-r-2 border-yellow-400" />
                        </div>
                      </div>
                    )}

                    {!isScanning && (
                      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between p-2 rounded-xl bg-black/75 backdrop-blur-md border border-white/10">
                        <span className="text-[11px] text-slate-300 px-2 flex items-center gap-1.5 truncate">
                          <ImageIcon className="w-3.5 h-3.5 text-yellow-400" />
                          {imageFile ? imageFile.name : "Foto Pisang Terpilih"}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="px-2.5 py-1 text-[11px] rounded-lg bg-white/10 hover:bg-white/20 text-white"
                          >
                            Ganti
                          </button>
                          <button
                            onClick={() => runDetection()}
                            className="px-3 py-1 text-[11px] rounded-lg bg-gradient-to-r from-yellow-400 to-amber-500 font-bold text-slate-950 flex items-center gap-1 hover:brightness-110 active:scale-95"
                          >
                            <Zap className="w-3 h-3 fill-slate-950" />
                            Deteksi Ulang
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {selectedImage && !resultsData && !isScanning && (
                <button
                  onClick={() => runDetection()}
                  className="w-full mt-4 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-slate-950 font-extrabold text-sm shadow-xl shadow-yellow-500/20 hover:brightness-110 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
                >
                  Mulai Klasifikasi Sekarang
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {isScanning && (
                <div className="mt-4 p-3 rounded-2xl bg-yellow-400/10 border border-yellow-400/30">
                  <div className="flex items-center justify-between text-xs text-yellow-300 font-bold mb-1">
                    <span>{scanMessage}</span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-400 to-amber-400 rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: 3 Output Cards */}
          <div className="lg:col-span-6 flex flex-col">
            <div
              className={`rounded-3xl bg-slate-900/80 border ${theme.border} backdrop-blur-2xl p-6 shadow-2xl flex-1 flex flex-col justify-between transition-all duration-500`}
              style={{ boxShadow: `0 20px 40px -15px ${theme.glow}` }}
            >
              <div className="flex flex-col gap-3.5 flex-1 justify-center">
                {/* Result Card 1: PCD + ML */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 transition-all hover:border-yellow-400/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-white">1. PCD + ML</h4>
                        <p className="text-[11px] text-slate-400">Random Forest · 135 Fitur PCD</p>
                      </div>
                    </div>
                  </div>

                  {resultsData?.experiments?.pcd_ml?.prediction ? (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Hasil Deteksi
                        </span>
                        <div
                          className={`text-xl font-black tracking-tight ${
                            RIPENESS_LABELS[resultsData.experiments.pcd_ml.prediction]?.color || "text-yellow-400"
                          }`}
                        >
                          {RIPENESS_LABELS[resultsData.experiments.pcd_ml.prediction]?.label}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {RIPENESS_LABELS[resultsData.experiments.pcd_ml.prediction]?.sub}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Tingkat Akurasi
                        </span>
                        <span className={`text-xl font-black font-mono ${getConfidenceStyle(resultsData.experiments.pcd_ml.confidence).text}`}>
                          {resultsData.experiments.pcd_ml.confidence}%
                        </span>
                        <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                          <div
                            className={`h-full bg-gradient-to-r ${getConfidenceStyle(resultsData.experiments.pcd_ml.confidence).bar} rounded-full transition-all duration-500`}
                            style={{ width: `${resultsData.experiments.pcd_ml.confidence}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 py-2 text-center text-xs text-slate-500 font-medium">
                      Menunggu foto diunggah...
                    </div>
                  )}
                </div>

                {/* Result Card 2: Raw + MobileNetV2 */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 transition-all hover:border-yellow-400/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-white">2. Raw + MobileNetV2</h4>
                        <p className="text-[11px] text-slate-400">Deep Learning · Raw Image (224x224)</p>
                      </div>
                    </div>
                  </div>

                  {resultsData?.experiments?.raw_mobilenet?.prediction ? (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Hasil Deteksi
                        </span>
                        <div
                          className={`text-xl font-black tracking-tight ${
                            RIPENESS_LABELS[resultsData.experiments.raw_mobilenet.prediction]?.color || "text-yellow-400"
                          }`}
                        >
                          {RIPENESS_LABELS[resultsData.experiments.raw_mobilenet.prediction]?.label}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {RIPENESS_LABELS[resultsData.experiments.raw_mobilenet.prediction]?.sub}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Tingkat Akurasi
                        </span>
                        <span className={`text-xl font-black font-mono ${getConfidenceStyle(resultsData.experiments.raw_mobilenet.confidence).text}`}>
                          {resultsData.experiments.raw_mobilenet.confidence}%
                        </span>
                        <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                          <div
                            className={`h-full bg-gradient-to-r ${getConfidenceStyle(resultsData.experiments.raw_mobilenet.confidence).bar} rounded-full transition-all duration-500`}
                            style={{ width: `${resultsData.experiments.raw_mobilenet.confidence}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 py-2 text-center text-xs text-slate-500 font-medium">
                      Menunggu foto diunggah...
                    </div>
                  )}
                </div>

                {/* Result Card 3: PCD + MobileNetV2 */}
                <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 transition-all hover:border-yellow-400/40">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div>
                        <h4 className="text-sm font-extrabold text-white">3. PCD + MobileNetV2</h4>
                        <p className="text-[11px] text-slate-400">Segmentasi Citra + MobileNetV2</p>
                      </div>
                    </div>
                  </div>

                  {resultsData?.experiments?.pcd_mobilenet?.prediction ? (
                    <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Hasil Deteksi
                        </span>
                        <div
                          className={`text-xl font-black tracking-tight ${
                            RIPENESS_LABELS[resultsData.experiments.pcd_mobilenet.prediction]?.color || "text-yellow-400"
                          }`}
                        >
                          {RIPENESS_LABELS[resultsData.experiments.pcd_mobilenet.prediction]?.label}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {RIPENESS_LABELS[resultsData.experiments.pcd_mobilenet.prediction]?.sub}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                          Tingkat Akurasi
                        </span>
                        <span className={`text-xl font-black font-mono ${getConfidenceStyle(resultsData.experiments.pcd_mobilenet.confidence).text}`}>
                          {resultsData.experiments.pcd_mobilenet.confidence}%
                        </span>
                        <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                          <div
                            className={`h-full bg-gradient-to-r ${getConfidenceStyle(resultsData.experiments.pcd_mobilenet.confidence).bar} rounded-full transition-all duration-500`}
                            style={{ width: `${resultsData.experiments.pcd_mobilenet.confidence}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 py-2 text-center text-[11px] text-slate-500 italic">
                      {modelsStatus.pcd_mobilenet.installed
                        ? "Menunggu foto diunggah..."
                        : "Model dapat diunggah lewat tombol 'Kelola & Upload 3 Model' di atas"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
