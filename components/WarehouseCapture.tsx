"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  inspectImageQuality,
  type ImageQuality,
} from "@/lib/image-quality";

type ViewName = "Front" | "Back" | "Label";

type Capture = {
  file: File;
  preview: string;
  quality: ImageQuality;
};

type VisualAnalysis = {
  brand: string;
  itemType: string;
  category: string;
  color: string;
  condition: string;
  conditionSignals: string[];
  ocr: {
    rawText: string[];
    brand: string;
    productCode: string;
    size: string;
    material: string;
    countryOfManufacture: string;
  };
  confidence: number;
};

type VisualMatch = {
  brand: string;
  itemType: string;
  condition: string;
  resalePrice: number;
  description: string;
  similarity: number;
};

const views: ViewName[] = ["Front", "Back", "Label"];
const emptyCorrection = {
  brand: "",
  itemType: "",
  category: "",
  color: "",
  condition: "",
  conditionSignals: "",
};

export default function WarehouseCapture() {
  const [captures, setCaptures] = useState<Partial<Record<ViewName, Capture>>>(
    {},
  );
  const [activeView, setActiveView] = useState<ViewName>("Front");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<VisualAnalysis | null>(null);
  const [visualMatches, setVisualMatches] = useState<VisualMatch[]>([]);
  const [answer, setAnswer] = useState("");
  const [correction, setCorrection] = useState(emptyCorrection);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const capturesRef =
    useRef<Partial<Record<ViewName, Capture>>>(captures);
  const uploadRefs = useRef<Partial<Record<ViewName, HTMLInputElement>>>({});

  const captureEntries = useMemo(
    () =>
      views
        .map((view) => ({ view, capture: captures[view] }))
        .filter(
          (entry): entry is { view: ViewName; capture: Capture } =>
            Boolean(entry.capture),
        ),
    [captures],
  );

  useEffect(() => {
    capturesRef.current = captures;
  }, [captures]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(capturesRef.current).forEach((capture) =>
        URL.revokeObjectURL(capture.preview),
      );
    },
    [],
  );

  async function openCamera(view: ViewName) {
    setActiveView(view);
    setCameraError("");
    setCameraReady(false);
    setCameraOpen(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "This browser does not support webcam access on this address.",
        );
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (error) {
      const name =
        error instanceof DOMException || error instanceof Error
          ? error.name
          : "";
      const cameraMessage =
        name === "NotAllowedError"
          ? "Camera permission is blocked. Allow camera access in the browser address bar, then try again."
          : name === "NotFoundError"
            ? "No webcam was found. Connect a camera or upload a photo."
            : name === "NotReadableError"
              ? "The webcam is being used by another application. Close that application and retry."
              : error instanceof Error
                ? error.message
                : "Camera access failed. Allow camera permission or upload a photo.";
      setCameraError(cameraMessage);
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraOpen(false);
  }

  async function storeCapture(view: ViewName, file: File) {
    try {
      const quality = await inspectImageQuality(file);
      const preview = URL.createObjectURL(file);
      setCaptures((current) => {
        const previous = current[view];
        if (previous) URL.revokeObjectURL(previous.preview);
        return { ...current, [view]: { file, preview, quality } };
      });
      setAnalysis(null);
      setVisualMatches([]);
      setAnswer("");
      setSaved(false);
    } catch (error) {
      setAnswer(
        error instanceof Error
          ? `Could not process the ${view.toLowerCase()} image: ${error.message}`
          : `Could not process the ${view.toLowerCase()} image.`,
      );
    }
  }

  async function captureFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("The camera is still starting. Wait a moment and retry.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.9),
    );
    if (!blob) return;
    await storeCapture(
      activeView,
      new File([blob], `${activeView.toLowerCase()}-${Date.now()}.jpg`, {
        type: "image/jpeg",
      }),
    );
    closeCamera();
  }

  async function analyzeItem() {
    if (captureEntries.length === 0 || loading) return;
    setLoading(true);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set(
        "message",
        "Identify this warehouse item and recommend a resale price and listing strategy.",
      );
      for (const { view, capture } of captureEntries) {
        formData.append("images", capture.file);
        formData.append("views", view);
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        answer?: string;
        error?: string;
        visualAnalysis?: VisualAnalysis;
        visualMatches?: VisualMatch[];
      };
      if (!response.ok || !data.visualAnalysis) {
        throw new Error(data.error ?? "Visual analysis failed.");
      }
      setAnalysis(data.visualAnalysis);
      setVisualMatches(data.visualMatches ?? []);
      setAnswer(data.answer ?? "");
      setCorrection({
        brand: data.visualAnalysis.brand,
        itemType: data.visualAnalysis.itemType,
        category: data.visualAnalysis.category,
        color: data.visualAnalysis.color,
        condition: data.visualAnalysis.condition,
        conditionSignals: data.visualAnalysis.conditionSignals.join(", "),
      });
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  async function saveFeedback() {
    if (!analysis) return;
    setLoading(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prediction: analysis,
          correction: {
            ...correction,
            conditionSignals: correction.conditionSignals
              .split(",")
              .map((signal) => signal.trim())
              .filter(Boolean),
          },
          imageViews: captureEntries.map(({ view }) => view),
          quality: captureEntries.map(({ view, capture }) => ({
            view,
            ...capture.quality,
          })),
          notes,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Feedback save failed.");
      setSaved(true);
    } catch (error) {
      setAnswer(error instanceof Error ? error.message : "Feedback save failed.");
    } finally {
      setLoading(false);
    }
  }

  const hasPoorCapture = captureEntries.some(
    ({ capture }) => !capture.quality.acceptable,
  );
  const completedRequiredViews =
    Number(Boolean(captures.Front)) + Number(Boolean(captures.Back));

  return (
    <section className="warehouse-panel">
      <div className="warehouse-heading">
        <div>
          <p className="eyebrow">Guided item intake</p>
          <h2>Build a reliable item record</h2>
          <p>
            Capture the required views, inspect the evidence, then verify every
            field before saving.
          </p>
        </div>
        <div className="capture-progress">
          <strong>{completedRequiredViews}/2</strong>
          <span>required views</span>
        </div>
      </div>

      <div className="capture-grid">
        {views.map((view, viewIndex) => {
          const capture = captures[view];
          return (
            <div
              className={`capture-card ${capture ? "complete" : ""}`}
              key={view}
            >
              <div className="capture-card-header">
                <div className="step-number">{viewIndex + 1}</div>
                <div>
                  <strong>{view} view</strong>
                  <span>{view === "Label" ? "Improves OCR" : "Required"}</span>
                </div>
                <div
                  className={`quality-badge ${
                    capture?.quality.acceptable
                      ? "good"
                      : capture
                        ? "warning"
                        : ""
                  }`}
                >
                  {capture
                    ? capture.quality.acceptable
                      ? "Ready"
                      : "Retake advised"
                    : view === "Label"
                      ? "Optional"
                      : "Pending"}
                </div>
              </div>
              {capture ? (
                <div className="capture-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={`${view} capture`}
                    src={capture.preview}
                  />
                  {capture.quality.issues.length > 0 && (
                    <p className="quality-warning">
                      {capture.quality.issues.join(", ")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="capture-placeholder">
                  <div className="placeholder-frame" />
                  <span>Position the {view.toLowerCase()} of the garment</span>
                </div>
              )}
              <div className="capture-actions">
                <button
                  className="primary"
                  onClick={() => void openCamera(view)}
                  type="button"
                >
                  {capture ? "Retake" : "Use camera"}
                </button>
                <button
                  onClick={() => uploadRefs.current[view]?.click()}
                  type="button"
                >
                  Upload
                </button>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void storeCapture(view, file);
                  }}
                  ref={(element) => {
                    if (element) uploadRefs.current[view] = element;
                  }}
                  type="file"
                />
              </div>
            </div>
          );
        })}
      </div>

      {hasPoorCapture && (
        <div className="warehouse-warning">
          <strong>Image quality needs attention</strong>
          <span>
            Better lighting and focus will improve identification accuracy.
          </span>
        </div>
      )}

      <button
        className="analyze-button"
        disabled={loading || !captures.Front || !captures.Back}
        onClick={() => void analyzeItem()}
        type="button"
      >
        {loading ? "Analyzing item..." : "Analyze captured item"}
      </button>
      {(!captures.Front || !captures.Back) && (
        <p className="analysis-hint">
          Front and back views are required before analysis.
        </p>
      )}

      {answer && (
        <div className="recommendation-card">
          <div className="section-title">
            <span>AI</span>
            <div>
              <p className="eyebrow">Dataset recommendation</p>
              <h3>Resale assessment</h3>
            </div>
          </div>
          <div className="recommendation-copy">{answer}</div>
        </div>
      )}

      {analysis && (
        <div className="review-card">
          <div className="review-heading">
            <div>
              <p className="eyebrow">Human verification</p>
              <h3>Review the item record</h3>
              <p>Correct any field before saving this feedback.</p>
            </div>
            <div className="confidence-ring">
              <strong>{Math.round(analysis.confidence * 100)}%</strong>
              <span>confidence</span>
            </div>
          </div>
          <div className="evidence-grid">
            <div className="evidence-card">
              <p className="evidence-label">
                OCR evidence
              </p>
              <p>Brand: {analysis.ocr.brand}</p>
              <p>Product code: {analysis.ocr.productCode}</p>
              <p>Size: {analysis.ocr.size}</p>
              <p>Material: {analysis.ocr.material}</p>
              <p>Made in: {analysis.ocr.countryOfManufacture}</p>
            </div>
            <div className="evidence-card">
              <p className="evidence-label">
                Readable text
              </p>
              <p className="readable-text">
                {analysis.ocr.rawText.join(" | ") || "No reliable text found"}
              </p>
            </div>
          </div>
          {visualMatches.length > 0 && (
            <div className="matches-card">
              <p className="evidence-label">
                Nearest verified images
              </p>
              <div className="match-list">
                {visualMatches.slice(0, 5).map((match, index) => (
                  <div
                    key={`${match.description}-${index}`}
                  >
                    <span>
                      {match.brand} {match.itemType} / {match.condition}
                    </span>
                    <span className="match-score">
                      {Math.round(match.similarity * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="review-fields">
            {(
              [
                ["brand", "Brand"],
                ["itemType", "Item type"],
                ["category", "Category"],
                ["color", "Color"],
                ["condition", "Condition"],
                ["conditionSignals", "Visible issues"],
              ] as const
            ).map(([field, label]) => (
              <label key={field}>
                <span>{label}</span>
                <input
                  onChange={(event) =>
                    setCorrection((current) => ({
                      ...current,
                      [field]: event.target.value,
                    }))
                  }
                  value={correction[field]}
                />
              </label>
            ))}
          </div>
          <label className="notes-field">
            <span>Warehouse notes</span>
            <textarea
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add handling notes or explain a correction..."
              value={notes}
            />
          </label>
          <button
            className="save-feedback-button"
            disabled={loading || saved}
            onClick={() => void saveFeedback()}
            type="button"
          >
            {saved ? "Feedback Saved" : "Confirm and Save Feedback"}
          </button>
        </div>
      )}

      {cameraOpen && (
        <div className="camera-overlay">
          <div className="camera-dialog">
            <div className="dialog-header">
              <div>
                <p className="eyebrow">{activeView} view</p>
                <h2>Frame the garment clearly</h2>
              </div>
              <button onClick={closeCamera} type="button">
                Close
              </button>
            </div>
            <div className="camera-frame">
              <video
                autoPlay
                muted
                onCanPlay={() => setCameraReady(true)}
                playsInline
                ref={videoRef}
              />
              <div className="frame-guide" />
            </div>
            {cameraError && (
              <p className="error-banner">{cameraError}</p>
            )}
            <button
              className="capture-button"
              disabled={Boolean(cameraError) || !cameraReady}
              onClick={() => void captureFrame()}
              type="button"
            >
              {cameraReady ? "Capture" : "Starting Camera..."}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
