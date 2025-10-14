# train_fall_detector_edgeimpulse.py
# Enhanced version for Edge Impulse BYOM upload compatibility

import os, json, argparse
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score, confusion_matrix
)
import tensorflow as tf

# ==== CONFIG ====
HERTZ = 50
WINDOW_SEC = 2.0
WINDOW = int(HERTZ * WINDOW_SEC)
STEP = WINDOW // 2
ACC = ["xAcc", "yAcc", "zAcc"]
GYRO = ["xGyro", "yGyro", "zGyro"]
ALL = ACC + GYRO
TARGET = "fall"
EPOCHS = 20
SEED = 42

LABELS = ["normal", "fall"]   # <== Define order for Edge Impulse (0=normal, 1=fall)

# ==== FEATURE HELPERS ====
def feats(x):
    x = np.array(x, dtype=np.float32)
    if len(x) == 0: return [0]*6
    return [x.mean(), x.std(), x.min(), x.max(), np.abs(x).mean(), np.mean(x**2)]

def window_features(df):
    f = []
    for c in ALL:
        f += feats(df[c])
    ra = np.sqrt(np.sum(df[ACC].values**2, axis=1))
    f += [ra.max(), ra.std()]
    return np.array(f, np.float32)

def slide(df):
    for i in range(0, len(df) - WINDOW, STEP):
        yield i, i + WINDOW

def build_data(df):
    X, y = [], []
    labels = df["label"].astype(str).str.lower().values
    dfnum = df[ALL].astype(np.float32)
    for i0, i1 in slide(dfnum):
        win = dfnum.iloc[i0:i1]
        if len(win) < WINDOW:
            continue
        main_label = pd.Series(labels[i0:i1]).mode()[0]
        yval = 1 if main_label == TARGET else 0
        X.append(window_features(win))
        y.append(yval)
    return np.vstack(X), np.array(y)


# ==== BALANCING ====
def balance_data(X, y):
    X_fall = X[y == 1]
    y_fall = y[y == 1]
    n_not = np.sum(y == 0)
    n_fall = len(y_fall)
    ratio = n_not / n_fall
    if ratio > 1.5:
        k = int(ratio) - 1
        X_aug = []
        for i in range(k):
            noise = np.random.normal(0, 0.01, X_fall.shape)
            X_aug.append(X_fall + noise)
        X_new = np.vstack([X, *X_aug])
        y_new = np.concatenate([y, np.tile(y_fall, k)])
        print(f"Balanced dataset: {len(y_new)} samples (augmented falls)")
        return X_new, y_new
    return X, y


# ==== MODEL ====
def make_model(n):
    inputs = tf.keras.Input(shape=(n,), name="features")
    x = tf.keras.layers.Dense(64, activation="relu")(inputs)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(32, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.2)(x)
    x = tf.keras.layers.Dense(16, activation="relu")(x)
    outputs = tf.keras.layers.Dense(2, activation="softmax", name="probabilities")(x)  # <-- 2 outputs
    model = tf.keras.Model(inputs=inputs, outputs=outputs)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy", tf.keras.metrics.AUC(name="auc"),
                 tf.keras.metrics.Precision(), tf.keras.metrics.Recall()]
    )
    return model


# ==== SAVE AS C ARRAY ====
def save_c(tflite_path, out="model.cc"):
    data = open(tflite_path, "rb").read()
    with open(out, "w") as f:
        f.write("const unsigned char g_model[] = {\n")
        for i in range(0, len(data), 12):
            chunk = ", ".join([f"0x{b:02x}" for b in data[i:i+12]])
            f.write(f"  {chunk},\n")
        f.write("};\nconst int g_model_len = %d;\n" % len(data))


# ==== MAIN ====
def main(csv, outdir):
    df = pd.read_csv(csv).dropna()
    print(f"Loaded rows: {len(df)}")

    if not set(ALL + ['label']).issubset(df.columns):
        print("ERROR: CSV must contain: xAcc,yAcc,zAcc,xGyro,yGyro,zGyro,label")
        return

    # Build and balance
    X, y = build_data(df)
    X, y = balance_data(X, y)
    print(f"Windows built: {len(X)} | feature_dim: {X.shape[1]}")

    # Train/test split
    Xtr, Xv, ytr, yv = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)
    sc = StandardScaler()
    Xtr_s, Xv_s = sc.fit_transform(Xtr), sc.transform(Xv)
    cw_vals = compute_class_weight("balanced", classes=np.unique(ytr), y=ytr)
    cw = {int(c): float(w) for c, w in zip(np.unique(ytr), cw_vals)}
    print(f"Class weights: {cw}")

    # Build and train model
    model = make_model(X.shape[1])
    model.summary()
    print("\nTraining...")
    print("Xtr_s shape:", Xtr_s.shape, "dtype:", Xtr_s.dtype)
    print("ytr shape:", ytr.shape, "unique labels:", np.unique(ytr))

    model.fit(Xtr_s, ytr, validation_data=(Xv_s, yv), epochs=EPOCHS, batch_size=128,
              class_weight=cw, verbose=2)

    # Export TFLite with metadata
    print("\nExporting TFLite model for Edge Impulse...")
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()
    os.makedirs(outdir, exist_ok=True)
    tflite_path = os.path.join(outdir, "fall_model.tflite")
    with open(tflite_path, "wb") as f:
        f.write(tflite_model)

    # Create labels.txt for Edge Impulse
    with open(os.path.join(outdir, "labels.txt"), "w") as f:
        f.write("\n".join(LABELS))

    # Save scaler parameters
    json.dump({"mean": sc.mean_.tolist(), "scale": sc.scale_.tolist()},
              open(os.path.join(outdir, "scaler.json"), "w"))

    save_c(tflite_path, os.path.join(outdir, "fall_model.cc"))
    print(f"\nArtifacts saved to '{outdir}':")
    print("  - fall_model.tflite  (Edge Impulse compatible)")
    print("  - fall_model.cc      (for Arduino fallback)")
    print("  - scaler.json        (for normalization)")
    print("  - labels.txt         (for EI classification labels)")
    print("Done.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--outdir", default="artifacts_edge")
    a = p.parse_args()
    main(a.csv, a.outdir)
