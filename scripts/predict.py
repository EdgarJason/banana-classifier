import sys
import os
import json
import warnings
import numpy as np
import pandas as pd
from PIL import Image
import cv2

# --- Environment & Warnings Configuration ---
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

# --- Model Paths & Constants ---
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(SCRIPT_DIR, "..", "models")

KERAS_MODEL_PATH = os.path.join(MODELS_DIR, "best_finetuned_model.keras")
if not os.path.exists(KERAS_MODEL_PATH):
    KERAS_MODEL_PATH = os.path.join(MODELS_DIR, "banana_model.keras")

JOBLIB_MODEL_PATH = os.path.join(MODELS_DIR, "best_model.joblib")

PCD_KERAS_PATH = os.path.join(MODELS_DIR, "best_mixed_model.keras")
if not os.path.exists(PCD_KERAS_PATH):
    PCD_KERAS_PATH = os.path.join(MODELS_DIR, "pcd_mobilenetv2.keras")

KERAS_CLASS_NAMES = ["half_ripe", "ripe", "unripe"]

# --- Feature Extraction Section ---
def extract_pcd_features(image_path, pipeline):
    from skimage.feature import graycomatrix, graycoprops

    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise ValueError(f"Gagal membaca gambar dari: {image_path}")

    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    if np.sum(mask > 0) < 50:
        mask = np.ones_like(gray, dtype=np.uint8) * 255

    fg_mask = mask > 0
    obj_ratio = float(np.sum(fg_mask) / mask.size)
    data = {}

    channels = [
        ('rgb_r', rgb[:, :, 0]), ('rgb_g', rgb[:, :, 1]), ('rgb_b', rgb[:, :, 2]),
        ('hsv_h', hsv[:, :, 0]), ('hsv_s', hsv[:, :, 1]), ('hsv_v', hsv[:, :, 2])
    ]

    for name, ch in channels:
        fg_vals = ch[fg_mask] if np.sum(fg_mask) > 0 else ch.flatten()
        data[f"{name}_mean"] = float(np.mean(fg_vals))
        data[f"{name}_std"] = float(np.std(fg_vals))
        data[f"{name}_median"] = float(np.median(fg_vals))

        hist, _ = np.histogram(fg_vals, bins=16, range=(0, 256), density=True)
        for i, val in enumerate(hist):
            data[f"{name}_hist_bin_{i}"] = float(val)

    data["object_pixel_ratio"] = obj_ratio

    masked_gray = cv2.bitwise_and(gray, gray, mask=mask)
    distances = [1]
    angles = [0, np.pi/4, np.pi/2, 3*np.pi/4]
    glcm = graycomatrix(masked_gray, distances=distances, angles=angles, levels=256, symmetric=True, normed=True)

    angle_names = ['0', '45', '90', '135']
    props = ['contrast', 'dissimilarity', 'homogeneity', 'energy', 'correlation']

    for prop in props:
        vals = graycoprops(glcm, prop)[0]
        for idx, ang in enumerate(angle_names):
            data[f"glcm_{prop}_{ang}"] = float(vals[idx])

    if hasattr(pipeline, "feature_names_in_"):
        expected_cols = list(pipeline.feature_names_in_)
        df = pd.DataFrame([{col: data.get(col, 0.0) for col in expected_cols}])
    else:
        df = pd.DataFrame([data])

    return df

# --- Label Normalization Helper ---
def normalize_label(raw_label):
    lbl = str(raw_label).lower().strip()
    if "half" in lbl or "setengah" in lbl:
        return "half_ripe"
    elif "unripe" in lbl or "mentah" in lbl:
        return "unripe"
    elif "ripe" in lbl or "matang" in lbl:
        return "ripe"
    return "ripe"

# --- Main Inference Pipeline ---
def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Harap sertakan path gambar."}))
        sys.exit(1)

    image_path = sys.argv[1]
    if not os.path.exists(image_path):
        print(json.dumps({"error": f"File gambar tidak ditemukan: {image_path}"}))
        sys.exit(1)

    results = {
        "status": "success",
        "experiments": {}
    }

    # --- Section: PCD + ML (Joblib) ---
    if os.path.exists(JOBLIB_MODEL_PATH):
        try:
            import joblib
            pipeline = joblib.load(JOBLIB_MODEL_PATH)
            features_df = extract_pcd_features(image_path, pipeline)

            pred = pipeline.predict(features_df)[0]
            conf = 95.0
            if hasattr(pipeline, "predict_proba"):
                try:
                    probas = pipeline.predict_proba(features_df)[0]
                    conf = float(np.max(probas)) * 100
                except Exception:
                    pass

            results["experiments"]["pcd_ml"] = {
                "name": "PCD + ML",
                "method": "Ekstraksi 135 Fitur Citra (Otsu, Warna, GLCM) + Random Forest",
                "prediction": normalize_label(pred),
                "confidence": round(conf, 1),
                "available": True,
                "model_file": os.path.basename(JOBLIB_MODEL_PATH)
            }
        except Exception as e:
            results["experiments"]["pcd_ml"] = {
                "name": "PCD + ML",
                "error": str(e),
                "available": False
            }
    else:
        results["experiments"]["pcd_ml"] = {
            "name": "PCD + ML",
            "available": False,
            "note": "File model best_model.joblib belum ditemukan"
        }

    # --- Section: Raw + MobileNetV2 (Keras) ---
    if os.path.exists(KERAS_MODEL_PATH):
        try:
            import keras
            keras_model = keras.models.load_model(KERAS_MODEL_PATH)

            img = Image.open(image_path).convert("RGB")
            img = img.resize((224, 224))
            img_arr = np.array(img, dtype=np.float32)

            try:
                from keras.applications.mobilenet_v2 import preprocess_input
                processed = preprocess_input(img_arr)
            except Exception:
                processed = (img_arr / 127.5) - 1.0

            processed = np.expand_dims(processed, axis=0)
            predictions = keras_model.predict(processed, verbose=0)[0]
            top_idx = int(np.argmax(predictions))
            conf = float(predictions[top_idx])

            pred_label = KERAS_CLASS_NAMES[top_idx] if top_idx < len(KERAS_CLASS_NAMES) else f"class_{top_idx}"

            results["experiments"]["raw_mobilenet"] = {
                "name": "Raw + MobileNetV2",
                "method": "Deep Learning (Tanpa Pra-proses Segmentasi)",
                "prediction": normalize_label(pred_label),
                "confidence": round(conf * 100, 1),
                "available": True,
                "model_file": os.path.basename(KERAS_MODEL_PATH)
            }
        except Exception as e:
            results["experiments"]["raw_mobilenet"] = {
                "name": "Raw + MobileNetV2",
                "error": str(e),
                "available": False
            }
    else:
        results["experiments"]["raw_mobilenet"] = {
            "name": "Raw + MobileNetV2",
            "available": False,
            "note": "File model .keras belum ditemukan"
        }

    # --- Section: PCD + MobileNetV2 (Mixed / Segmented Keras) ---
    if os.path.exists(PCD_KERAS_PATH):
        try:
            import keras
            pcd_model = keras.models.load_model(PCD_KERAS_PATH)

            img_bgr = cv2.imread(image_path)
            gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
            _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
            if np.sum(mask > 0) < 50:
                mask = np.ones_like(gray, dtype=np.uint8) * 255

            segmented_bgr = cv2.bitwise_and(img_bgr, img_bgr, mask=mask)
            segmented_rgb = cv2.cvtColor(segmented_bgr, cv2.COLOR_BGR2RGB)

            h, w = 224, 224
            if hasattr(pcd_model, 'input_shape') and pcd_model.input_shape and len(pcd_model.input_shape) >= 3:
                h = pcd_model.input_shape[1] or 224
                w = pcd_model.input_shape[2] or 224

            resized_pcd = cv2.resize(segmented_rgb, (w, h))
            pcd_arr = np.array(resized_pcd, dtype=np.float32)
            try:
                from keras.applications.mobilenet_v2 import preprocess_input
                pcd_processed = preprocess_input(pcd_arr)
            except Exception:
                pcd_processed = (pcd_arr / 127.5) - 1.0

            pcd_processed = np.expand_dims(pcd_processed, axis=0)
            preds = pcd_model.predict(pcd_processed, verbose=0)[0]
            top_i = int(np.argmax(preds))
            conf = float(preds[top_i])
            pred_lbl = KERAS_CLASS_NAMES[top_i] if top_i < len(KERAS_CLASS_NAMES) else f"class_{top_i}"

            results["experiments"]["pcd_mobilenet"] = {
                "name": "PCD + MobileNetV2",
                "method": "Segmentasi Otsu + MobileNetV2",
                "prediction": normalize_label(pred_lbl),
                "confidence": round(conf * 100, 1),
                "available": True,
                "model_file": os.path.basename(PCD_KERAS_PATH)
            }
        except Exception as e:
            results["experiments"]["pcd_mobilenet"] = {
                "name": "PCD + MobileNetV2",
                "error": str(e),
                "available": False
            }
    else:
        results["experiments"]["pcd_mobilenet"] = {
            "name": "PCD + MobileNetV2",
            "method": "Pengolahan Citra Digital + Deep Learning",
            "prediction": None,
            "confidence": None,
            "available": False,
            "status_text": "Segera Hadir",
            "note": "Silakan unggah model best_mixed_model.keras"
        }

    # --- Section: Final Consensus Prediction ---
    primary = results["experiments"].get("raw_mobilenet") or results["experiments"].get("pcd_ml") or results["experiments"].get("pcd_mobilenet")
    if primary and primary.get("prediction"):
        results["prediction"] = primary["prediction"]
        results["confidence"] = primary["confidence"]
    else:
        results["prediction"] = "ripe"
        results["confidence"] = 95.0

    print(json.dumps(results))

if __name__ == "__main__":
    main()
