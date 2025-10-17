# inference_server.py
from flask import Flask, request, jsonify
import numpy as np
import tensorflow as tf

app = Flask(__name__)

# Load once at start
interpreter = tf.lite.Interpreter(model_path="fall_model.tflite")
interpreter.allocate_tensors()
input_det = interpreter.get_input_details()
output_det = interpreter.get_output_details()

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True}), 200

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json(force=True)
    print("ML request data:", data)
    x = np.array(data["input"], dtype=np.float32)
    print("ML input array shape:", x.shape)
    x = np.expand_dims(x, axis=0)  # [1, N]
    print("ML input expanded shape:", x.shape)
    interpreter.set_tensor(input_det[0]["index"], x)

    interpreter.invoke()
    y = interpreter.get_tensor(output_det[0]["index"]).tolist()
    print("ML response:", y)
    print("==============================================================")
    return jsonify({"fallProb": y})
    
if __name__ == "__main__":
    # Bind specifically to 127.0.0.1 for Windows; pick a free port
    app.run(host="127.0.0.1", port=5001, debug=True)
