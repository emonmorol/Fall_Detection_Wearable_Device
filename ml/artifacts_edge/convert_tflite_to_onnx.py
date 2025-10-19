import tf2onnx
import tensorflow as tf

# Load TFLite model
tflite_model_path = "fall_model.tflite"
onnx_model_path = "fall_model.onnx"

# Load the TFLite model into a TensorFlow interpreter
interpreter = tf.lite.Interpreter(model_path=tflite_model_path)
interpreter.allocate_tensors()

# Convert to ONNX
spec = (tf.TensorSpec(interpreter.get_input_details()[0]['shape'], tf.float32, name="input"),)
output_path = tf2onnx.convert.from_function(
    lambda x: tf.constant(interpreter.get_tensor(interpreter.get_output_details()[0]['index'])),
    input_signature=spec,
    opset=13,
    output_path=onnx_model_path
)
print(f"Converted successfully: {onnx_model_path}")
