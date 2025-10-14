# train_fall_detector.py
# Simple step-by-step ML model to detect falls from IMU data (Acc + Gyro)
# Input CSV: xAcc, yAcc, zAcc, xGyro, yGyro, zGyro, label

import os, json, argparse
import numpy as np, pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.utils.class_weight import compute_class_weight
from sklearn.metrics import (
    classification_report, confusion_matrix, roc_auc_score,
    accuracy_score, precision_score, recall_score, f1_score
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

# ==== FEATURE HELPERS ====
def feats(x):
    x = np.array(x, dtype=np.float32)
    if len(x) == 0: return [0]*6
    return [x.mean(), x.std(), x.min(), x.max(), np.abs(x).mean(), np.mean(x**2)]

def window_features(df):
    f = []
    for c in ALL: f += feats(df[c])
    ra = np.sqrt(np.sum(df[ACC].values**2, axis=1))
    f += [ra.max(), ra.std()]
    return np.array(f, np.float32)

def slide(df):
    for i in range(0, len(df)-WINDOW, STEP):
        yield i, i+WINDOW

def build_data(df):
    X, y = [], []
    labels = df["label"].astype(str).str.lower().values
    dfnum = df[ALL].astype(np.float32)
    for i0, i1 in slide(dfnum):
        win = dfnum.iloc[i0:i1]
        if len(win) < WINDOW: continue
        main_label = pd.Series(labels[i0:i1]).mode()[0]
        X.append(window_features(win))
        y.append(1 if main_label == TARGET else 0)
    return np.vstack(X), np.array(y)


# ==== FOR BALANCING THE DATA ====

def balance_data(X, y):
    X_fall = X[y==1]
    y_fall = y[y==1]
    n_not = np.sum(y==0)
    n_fall = len(y_fall)
    ratio = n_not / n_fall
    if ratio > 1.5:
        # upsample fall windows
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
    m = tf.keras.Sequential([
        tf.keras.layers.Input((n,)),
        tf.keras.layers.Dense(64, activation="relu"),
        tf.keras.layers.Dropout(0.3),
        tf.keras.layers.Dense(32, activation="relu"),
        tf.keras.layers.Dropout(0.2),
        tf.keras.layers.Dense(16, activation="relu"),
        tf.keras.layers.Dense(2, activation="softmax", name="probabilities")
    ])
    m.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"]
    )
    return m

# ==== SAVE AS C ARRAY ====
def save_c(tflite_path, out="model.cc"):
    data = open(tflite_path, "rb").read()
    with open(out, "w") as f:
        f.write("const unsigned char g_model[] = {\n")
        for i in range(0, len(data), 12):
            chunk = ", ".join([f"0x{b:02x}" for b in data[i:i+12]])
            f.write(f"  {chunk},\n")
        f.write("};\nconst int g_model_len = %d;\n" % len(data))

# ==== EVAL HELPERS ====
def print_basic_metrics(y_true, probs, threshold=0.5, title="Validation"):
    preds = (probs >= threshold).astype(int)
    acc  = accuracy_score(y_true, preds)
    prec = precision_score(y_true, preds, zero_division=0)
    rec  = recall_score(y_true, preds, zero_division=0)
    f1   = f1_score(y_true, preds, zero_division=0)
    try:
        auc  = roc_auc_score(y_true, probs)
    except ValueError:
        auc = float("nan")

    print(f"\n[{title}] threshold={threshold:.2f}")
    print(f"  Accuracy : {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall   : {rec:.4f}")
    print(f"  F1-score : {f1:.4f}")
    print(f"  ROC-AUC  : {auc:.4f}")

    cm = confusion_matrix(y_true, preds)
    tn, fp, fn, tp = cm.ravel()
    print("  Confusion Matrix [tn fp; fn tp]:")
    print(cm)
    print(f"  TN={tn}  FP={fp}  FN={fn}  TP={tp}")

def sweep_threshold(y_true, probs):
    # Try a few thresholds and pick the one with the best F1
    best = (0.5, -1.0)  # (threshold, f1)
    print("\n[Threshold sweep] trying thresholds:")
    for th in [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80]:
        f1 = f1_score(y_true, (probs >= th).astype(int), zero_division=0)
        print(f"  th={th:.2f} -> F1={f1:.4f}")
        if f1 > best[1]:
            best = (th, f1)
    print(f"Best threshold by F1: {best[0]:.2f} (F1={best[1]:.4f})")
    return best[0]

# ==== MAIN ====
def main(csv, outdir):
    df = pd.read_csv(csv).dropna()
    print(f"Loaded rows: {len(df)}")
    if not set(ALL + ['label']).issubset(df.columns):
        print("ERROR: CSV must contain: xAcc,yAcc,zAcc,xGyro,yGyro,zGyro,label")
        return

    # Build feature windows
    X, y = build_data(df)
    X, y = balance_data(X, y)
    
    print(f"Windows built: {len(X)}  |  feature_dim: {X.shape[1]}")
    # Class balance
    uniq, counts = np.unique(y, return_counts=True)
    dist = {int(k): int(v) for k, v in zip(uniq, counts)}
    print(f"Label distribution (0=not_fall, 1=fall): {dist}")

    # Train/val split
    Xtr, Xv, ytr, yv = train_test_split(X, y, test_size=0.2, random_state=SEED, stratify=y)
    print(f"Train windows: {len(Xtr)}  |  Val windows: {len(Xv)}")

    ytr = ytr.astype(np.int32)
    yv  = yv.astype(np.int32)

    # Scaling
    sc = StandardScaler()
    Xtr_s, Xv_s = sc.fit_transform(Xtr), sc.transform(Xv)
    print("Standardization done (mean/std per feature).")

    # Class weights (handle imbalance)
    cw_vals = compute_class_weight("balanced", classes=np.unique(ytr), y=ytr)
    cw = {int(c): float(w) for c, w in zip(np.unique(ytr), cw_vals)}
    print(f"Class weights: {cw}")

    # Model
    model = make_model(X.shape[1])
    print("\nStarting training...")
    hist = model.fit(
        Xtr_s, ytr,
        validation_data=(Xv_s, yv),
        epochs=EPOCHS,
        batch_size=128,
        class_weight=cw,
        verbose=2
    )

    # Final train/val evaluation using Keras
    print("\nKeras evaluate() on validation set:")
    eval_vals = model.evaluate(Xv_s, yv, verbose=0)
    print({name: float(val) for name, val in zip(model.metrics_names, eval_vals)})

    # Detailed sklearn metrics on validation
    # Get model outputs (probabilities for both classes)
    val_probs_2d = model.predict(Xv_s, verbose=0)

    # Use only the "fall" probability (class 1)
    val_probs = val_probs_2d[:, 1]
    # Default threshold = 0.5
    print_basic_metrics(yv, val_probs, threshold=0.5, title="Validation @0.50")

    # Small threshold sweep to guide MCU threshold
    best_th = sweep_threshold(yv, val_probs)
    print_basic_metrics(yv, val_probs, threshold=best_th, title=f"Validation @{best_th:.2f}")
    print("\nSuggested kFallThreshold for ESP32 (starting point):", round(float(best_th), 2))

    # Show a few example predictions
    print("\nSample predictions (first 10): [prob -> pred] / true")
    for i in range(min(10, len(val_probs))):
        prob = float(val_probs[i])
        pred = int(prob >= best_th)
        print(f"  {i:02d}: {prob:.3f} -> {pred} / true={int(yv[i])}")

    # Save artifacts for MCU
    os.makedirs(outdir, exist_ok=True)
    tflite_path = f"{outdir}/fall_model.tflite"
    conv = tf.lite.TFLiteConverter.from_keras_model(model)
    tfl = conv.convert()
    open(tflite_path, "wb").write(tfl)
    save_c(tflite_path, f"{outdir}/fall_model.cc")
    json.dump({"mean": sc.mean_.tolist(), "scale": sc.scale_.tolist()}, open(f"{outdir}/scaler.json", "w"))

    print(f"\nSaved model & scaler to '{outdir}'")
    print("  - fall_model.tflite")
    print("  - fall_model.cc")
    print("  - scaler.json")
    print("Copy the suggested threshold to your firmware as kFallThreshold.")
    print("Done.")
    
if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--outdir", default="artifacts")
    a = p.parse_args()
    main(a.csv, a.outdir)
