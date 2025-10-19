# inference_server.py (Corrected and with original return format)

from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf
import json

app = Flask(__name__)

# ==== LOAD MODELS AND SCALER AT START ====

# Load the TFLite model
interpreter = tf.lite.Interpreter(model_path="fall_model.tflite")
interpreter.allocate_tensors()
input_det = interpreter.get_input_details()
output_det = interpreter.get_output_details()

# Load the scaler parameters
try:
    with open('scaler.json', 'r') as f:
        scaler_params = json.load(f)
    SCALER_MEAN = np.array(scaler_params['mean'], dtype=np.float32)
    SCALER_SCALE = np.array(scaler_params['scale'], dtype=np.float32)
    print("✅ Model and scaler loaded successfully.")
except FileNotFoundError:
    print("❌ ERROR: scaler.json not found. Make sure it's in the same directory.")
    exit()


# Validate against model input shape
in_shape = input_det[0]["shape"]  # e.g., [1, 38]
expected_n = int(in_shape[-1])
if expected_n != len(SCALER_MEAN) or expected_n != len(SCALER_SCALE):
    print(f"❌ ERROR: scaler size ({len(SCALER_MEAN)}) != model input dim ({expected_n})")
    exit(1)

# ==== HELPER FUNCTION FOR SCALING ====
def scale_features(features):
    features_np = np.array(features, dtype=np.float32)
    if features_np.shape != (expected_n,):
        raise ValueError(f"Expected feature len {expected_n}, got {features_np.shape}")
    return (features_np - SCALER_MEAN) / SCALER_SCALE

# ==== FLASK ROUTES ====

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True}), 200

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)
    
    # 1. Get the raw features from the request
    raw_features = data.get("input")
    if not raw_features:
        return jsonify({"error": "Missing 'input' key"}), 400
        
    print(f"Received raw features (shape: {np.array(raw_features).shape})")

    # 2. *CRITICAL STEP:* Scale the features before prediction
    try:
        scaled_features = scale_features(raw_features)
    except Exception as e:
        return jsonify({"error": f"bad_features: {e}"}), 400
    

    # 3. Reshape for the model (add batch dimension)
    model_input = np.expand_dims(scaled_features, axis=0).astype(np.float32)
    print(model_input)
    # 4. Perform inference
    interpreter.set_tensor(input_det[0]["index"], model_input)
    interpreter.invoke()
    
    # 5. Get the result and convert to list
    y_pred = interpreter.get_tensor(output_det[0]["index"]).tolist()
    p_normal, p_fall = float(y_pred[0][0]), float(y_pred[0][1])
    
    print(f"ML response: {y_pred}")
    print("==============================================================")
    
    return jsonify({"fallProb": [[p_normal, p_fall]]}), 200

if __name__ == "__main__":
    # Ensure scaler.json and fall_model.tflite are in the same directory
    app.run(host="127.0.0.1", port=5001, debug=True)