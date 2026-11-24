import os
import io
import warnings
import numpy as np
import pandas as pd
from PIL import Image
import cv2
from flask import Flask, request, jsonify

# --- Environment & Warnings Configuration ---
warnings.filterwarnings("ignore")
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

app = Flask(__name__)
try:
    from flask_cors import CORS
    CORS(app)
except ImportError:
    @app.after_request
    def add_cors_headers(response):
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS")
        return response

# --- Path Configurations ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
if not os.path.exists(MODELS_DIR):
    ALT_DIR = os.path.join(BASE_DIR, "..", "banana-classifier", "models")
    if os.path.exists(ALT_DIR):
        MODELS_DIR = ALT_DIR

KERAS_MODEL_PATH = os.path.join(MODELS_DIR, "best_finetuned_model.keras")
if not os.path.exists(KERAS_MODEL_PATH):
    KERAS_MODEL_PATH = os.path.join(MODELS_DIR, "banana_model.keras")

JOBLIB_MODEL_PATH = os.path.join(MODELS_DIR, "best_model.joblib")

PCD_KERAS_PATH = os.path.join(MODELS_DIR, "best_mixed_model.keras")
if not os.path.exists(PCD_KERAS_PATH):
    PCD_KERAS_PATH = os.path.join(MODELS_DIR, "pcd_mobilenetv2.keras")

KERAS_CLASS_NAMES = ["half_ripe", "ripe", "unripe"]

# --- Global Model In-Memory Cache ---
model_pcd_ml = None
model_raw_mobilenet = None
model_pcd_mobilenet = None

def load_all_models():
    global model_pcd_ml, model_raw_mobilenet, model_pcd_mobilenet

    if os.path.exists(JOBLIB_MODEL_PATH):
        try:
            import joblib
            model_pcd_ml = joblib.load(JOBLIB_MODEL_PATH)
            print(f"[OK] PCD+ML Model loaded from: {JOBLIB_MODEL_PATH}")
        except Exception as e:
            print(f"[ERROR] PCD+ML load error: {e}")

    if os.path.exists(KERAS_MODEL_PATH):
        try:
            import keras
            model_raw_mobilenet = keras.models.load_model(KERAS_MODEL_PATH)
            print(f"[OK] Raw MobileNetV2 loaded from: {KERAS_MODEL_PATH}")
        except Exception as e:
            print(f"[ERROR] Raw MobileNetV2 load error: {e}")

    if os.path.exists(PCD_KERAS_PATH):
        try:
            import keras
            model_pcd_mobilenet = keras.models.load_model(PCD_KERAS_PATH)
            print(f"[OK] PCD MobileNetV2 loaded from: {PCD_KERAS_PATH}")
        except Exception as e:
            print(f"[ERROR] PCD MobileNetV2 load error: {e}")

load_all_models()

# --- Section: PCD Feature Extraction ---
def extract_pcd_features_from_bgr(img_bgr, pipeline):
    from skimage.feature import graycomatrix, graycoprops

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

def normalize_label(raw_label):
    lbl = str(raw_label).lower().strip()
    if "half" in lbl or "setengah" in lbl:
        return "half_ripe"
    elif "unripe" in lbl or "mentah" in lbl:
        return "unripe"
    elif "ripe" in lbl or "matang" in lbl:
        return "ripe"
    return "ripe"

# --- Section: Health Check Endpoints ---
@app.route("/", methods=["GET"])
@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "online",
        "service": "Banana Classifier API",
        "models": {
            "pcd_ml": model_pcd_ml is not None,
            "raw_mobilenet": model_raw_mobilenet is not None,
            "pcd_mobilenet": model_pcd_mobilenet is not None
        }
    })

# --- Section: Models Status & Upload Endpoints ---
@app.route("/api/models", methods=["GET"])
def get_models_status():
    files = os.listdir(MODELS_DIR) if os.path.exists(MODELS_DIR) else []

    def get_info(filename):
        if filename and os.path.exists(os.path.join(MODELS_DIR, filename)):
            stats = os.stat(os.path.join(MODELS_DIR, filename))
            return {
                "installed": True,
                "filename": filename,
                "sizeMb": f"{stats.st_size / (1024*1024):.2f}"
            }
        return {"installed": False, "filename": None, "sizeMb": None}

    return jsonify({
        "status": "success",
        "models": {
            "pcd_ml": get_info(os.path.basename(JOBLIB_MODEL_PATH) if os.path.exists(JOBLIB_MODEL_PATH) else None),
            "raw_mobilenet": get_info(os.path.basename(KERAS_MODEL_PATH) if os.path.exists(KERAS_MODEL_PATH) else None),
            "pcd_mobilenet": get_info(os.path.basename(PCD_KERAS_PATH) if os.path.exists(PCD_KERAS_PATH) else None)
        }
    })

@app.route("/api/models", methods=["POST"])
def upload_model():
    file = request.files.get("file")
    model_type = request.form.get("modelType")

    if not file or not model_type:
        return jsonify({"error": "file and modelType are required."}), 400

    target = "best_model.joblib" if model_type == "pcd_ml" else "best_finetuned_model.keras" if model_type == "raw_mobilenet" else "best_mixed_model.keras"
    dest = os.path.join(MODELS_DIR, target)
    file.save(dest)
    load_all_models()

    return jsonify({
        "status": "success",
        "message": f"Model {model_type} updated successfully",
        "filename": target
    })

# --- Section: Prediction Endpoint ---
@app.route("/predict", methods=["POST"])
@app.route("/api/classify", methods=["POST"])
def predict():
    file = request.files.get("file") or request.files.get("image")
    if not file or file.filename == "":
        return jsonify({"error": "No image file provided"}), 400

    try:
        image_bytes = file.read()
        nparr = np.frombuffer(image_bytes, np.uint8)
        img_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img_bgr is None:
            return jsonify({"error": "Failed to decode image"}), 400

        results = {
            "status": "success",
            "experiments": {}
        }

        # 1. PCD + ML
        if model_pcd_ml is not None:
            try:
                features_df = extract_pcd_features_from_bgr(img_bgr, model_pcd_ml)
                pred = model_pcd_ml.predict(features_df)[0]
                conf = 95.0
                if hasattr(model_pcd_ml, "predict_proba"):
                    try:
                        probas = model_pcd_ml.predict_proba(features_df)[0]
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
                results["experiments"]["pcd_ml"] = {"name": "PCD + ML", "error": str(e), "available": False}
        else:
            results["experiments"]["pcd_ml"] = {"name": "PCD + ML", "available": False, "note": "Model file not found"}

        # 2. Raw + MobileNetV2
        if model_raw_mobilenet is not None:
            try:
                pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB").resize((224, 224))
                img_arr = np.array(pil_img, dtype=np.float32)

                try:
                    from keras.applications.mobilenet_v2 import preprocess_input
                    proc = preprocess_input(img_arr)
                except Exception:
                    proc = (img_arr / 127.5) - 1.0

                proc = np.expand_dims(proc, axis=0)
                preds = model_raw_mobilenet.predict(proc, verbose=0)[0]
                top_idx = int(np.argmax(preds))
                conf = float(preds[top_idx])
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
                results["experiments"]["raw_mobilenet"] = {"name": "Raw + MobileNetV2", "error": str(e), "available": False}
        else:
            results["experiments"]["raw_mobilenet"] = {"name": "Raw + MobileNetV2", "available": False, "note": "Model file not found"}

        # 3. PCD + MobileNetV2
        if model_pcd_mobilenet is not None:
            try:
                gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
                _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
                if np.sum(mask > 0) < 50:
                    mask = np.ones_like(gray, dtype=np.uint8) * 255

                segmented_bgr = cv2.bitwise_and(img_bgr, img_bgr, mask=mask)
                segmented_rgb = cv2.cvtColor(segmented_bgr, cv2.COLOR_BGR2RGB)

                h, w = 224, 224
                if hasattr(model_pcd_mobilenet, 'input_shape') and model_pcd_mobilenet.input_shape and len(model_pcd_mobilenet.input_shape) >= 3:
                    h = model_pcd_mobilenet.input_shape[1] or 224
                    w = model_pcd_mobilenet.input_shape[2] or 224

                resized_pcd = cv2.resize(segmented_rgb, (w, h))
                pcd_arr = np.array(resized_pcd, dtype=np.float32)

                try:
                    from keras.applications.mobilenet_v2 import preprocess_input
                    pcd_proc = preprocess_input(pcd_arr)
                except Exception:
                    pcd_proc = (pcd_arr / 127.5) - 1.0

                pcd_proc = np.expand_dims(pcd_proc, axis=0)
                preds = model_pcd_mobilenet.predict(pcd_proc, verbose=0)[0]
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
                results["experiments"]["pcd_mobilenet"] = {"name": "PCD + MobileNetV2", "error": str(e), "available": False}
        else:
            results["experiments"]["pcd_mobilenet"] = {"name": "PCD + MobileNetV2", "available": False, "note": "Model file not found"}

        # Final consensus
        primary = results["experiments"].get("raw_mobilenet") or results["experiments"].get("pcd_ml") or results["experiments"].get("pcd_mobilenet")
        if primary and primary.get("prediction"):
            results["prediction"] = primary["prediction"]
            results["confidence"] = primary["confidence"]
        else:
            results["prediction"] = "ripe"
            results["confidence"] = 95.0

        return jsonify(results)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Section: Server Entry Point ---
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
