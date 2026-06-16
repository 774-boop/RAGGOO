"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import WarehouseCapture from "@/components/WarehouseCapture";

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

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
  visualAnalysis?: VisualAnalysis | null;
};

const suggestions = [
  {
    label: "Price an item",
    text: "What is a typical resale price for gently used Carhartt denim?",
  },
  {
    label: "Compare markets",
    text: "Compare resale and retail evidence for Rick Owens bottoms.",
  },
  {
    label: "Assess condition",
    text: "How does visible condition affect resale decisions?",
  },
];

function CameraIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.5 6.5 10 4h4l1.5 2.5H18a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2h2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="13" r="3.25" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 15.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <path
        d="m4 4 16 8-16 8 3-8-3-8Zm3 8h13"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"chat" | "warehouse">("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!image) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function openCamera() {
    setCameraError("");
    setCameraReady(false);
    setCameraOpen(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Webcam access is unavailable in this browser.");
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
      const name = error instanceof Error ? error.name : "";
      setCameraError(
        name === "NotAllowedError"
          ? "Camera permission is blocked. Allow it in the browser address bar."
          : name === "NotFoundError"
            ? "No webcam was found."
            : error instanceof Error
              ? error.message
              : "Camera access failed.",
      );
    }
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) {
      setCameraError("The camera is still starting.");
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
    setImage(
      new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }),
    );
    closeCamera();
  }

  async function sendMessage(message: string, selectedImage = image) {
    const trimmed = message.trim();
    if ((!trimmed && !selectedImage) || loading) return;

    const question =
      trimmed || "Identify this item and recommend a resale strategy.";
    const submittedPreview = selectedImage
      ? URL.createObjectURL(selectedImage)
      : undefined;
    setMessages((current) => [
      ...current,
      { role: "user", content: question, imageUrl: submittedPreview },
    ]);
    setInput("");
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("message", question);
      if (selectedImage) formData.set("image", selectedImage);

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });
      const responseText = await response.text();
      const data = JSON.parse(responseText || "{}") as {
        answer?: string;
        error?: string;
        visualAnalysis?: VisualAnalysis | null;
      };
      if (!response.ok) {
        throw new Error(
          data.error || responseText || `Chat request failed (${response.status})`,
        );
      }
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: data.answer ?? data.error ?? "No answer was returned.",
          visualAnalysis: data.visualAnalysis,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content:
            error instanceof Error
              ? `Chat error: ${error.message}`
              : "The chat service is unavailable.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <div className="brand-mark">RI</div>
          <div>
            <p className="eyebrow">Resale Intelligence</p>
            <h1>Evidence-led clothing decisions</h1>
          </div>
        </div>
        <div className="status-pill">
          <span />
          Local RAG online
        </div>
      </header>

      <nav aria-label="Application mode" className="mode-nav">
        <button
          className={mode === "chat" ? "active" : ""}
          onClick={() => setMode("chat")}
          type="button"
        >
          Chat assistant
        </button>
        <button
          className={mode === "warehouse" ? "active" : ""}
          onClick={() => setMode("warehouse")}
          type="button"
        >
          Warehouse intake
        </button>
      </nav>

      {mode === "warehouse" ? (
        <WarehouseCapture />
      ) : (
        <section className="chat-layout">
          <div className="chat-panel">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <span />
                  <span />
                  <span />
                </div>
                <p className="eyebrow">Dataset-grounded assistant</p>
                <h2>What do you need to know?</h2>
                <p>
                  Ask about pricing, condition, brand performance, or attach a
                  clothing photo for OCR and visual matching.
                </p>
                <div className="suggestion-grid">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.text}
                      onClick={() => void sendMessage(suggestion.text, null)}
                      type="button"
                    >
                      <span>{suggestion.label}</span>
                      {suggestion.text}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="conversation">
                {messages.map((message, index) => (
                  <article
                    className={`message-row ${message.role}`}
                    key={`${message.role}-${index}`}
                  >
                    <div className="message-avatar">
                      {message.role === "assistant" ? "RI" : "You"}
                    </div>
                    <div className="message-body">
                      <p className="message-author">
                        {message.role === "assistant"
                          ? "Resale Intelligence"
                          : "You"}
                      </p>
                      {message.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt="Uploaded clothing"
                          className="message-image"
                          src={message.imageUrl}
                        />
                      )}
                      {message.visualAnalysis && (
                        <div className="analysis-strip">
                          <span>
                            {message.visualAnalysis.brand} /{" "}
                            {message.visualAnalysis.itemType}
                          </span>
                          <span>{message.visualAnalysis.condition}</span>
                          <span>
                            {Math.round(
                              message.visualAnalysis.confidence * 100,
                            )}
                            % confidence
                          </span>
                        </div>
                      )}
                      {message.visualAnalysis?.ocr.rawText.length ? (
                        <div className="ocr-chip">
                          OCR:{" "}
                          {message.visualAnalysis.ocr.rawText.join(" / ")}
                        </div>
                      ) : null}
                      <div className="message-copy">{message.content}</div>
                    </div>
                  </article>
                ))}
                {loading && (
                  <article className="message-row assistant">
                    <div className="message-avatar">RI</div>
                    <div className="message-body">
                      <p className="message-author">Resale Intelligence</p>
                      <div className="typing-indicator">
                        <span />
                        <span />
                        <span />
                        <p>Reviewing the evidence</p>
                      </div>
                    </div>
                  </article>
                )}
                <div ref={conversationEndRef} />
              </div>
            )}
          </div>

          <form className="composer" onSubmit={handleSubmit}>
            {previewUrl && (
              <div className="attachment-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="Selected clothing" src={previewUrl} />
                <div>
                  <strong>{image?.name}</strong>
                  <span>Ready for OCR and visual matching</span>
                </div>
                <button onClick={() => setImage(null)} type="button">
                  Remove
                </button>
              </div>
            )}

            <div className="composer-main">
              <div className="composer-actions">
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) =>
                    setImage(event.target.files?.[0] ?? null)
                  }
                  ref={fileInputRef}
                  type="file"
                />
                <input
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(event) =>
                    setImage(event.target.files?.[0] ?? null)
                  }
                  ref={cameraInputRef}
                  type="file"
                />
                <button
                  aria-label="Use camera"
                  onClick={() => {
                    if (
                      window.isSecureContext &&
                      "mediaDevices" in navigator
                    ) {
                      void openCamera();
                    } else {
                      cameraInputRef.current?.click();
                    }
                  }}
                  title="Use camera"
                  type="button"
                >
                  <CameraIcon />
                </button>
                <button
                  aria-label="Upload image"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload image"
                  type="button"
                >
                  <UploadIcon />
                </button>
              </div>
              <textarea
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage(input);
                  }
                }}
                placeholder="Ask about pricing, condition, or upload an item..."
                rows={1}
                value={input}
              />
              <button
                aria-label="Send message"
                className="send-button"
                disabled={loading || (!input.trim() && !image)}
                type="submit"
              >
                <SendIcon />
              </button>
            </div>
            <p className="composer-note">
              Prices are estimates based on retrieved dataset evidence.
            </p>
          </form>
        </section>
      )}

      {cameraOpen && (
        <div className="camera-overlay">
          <div className="camera-dialog">
            <div className="dialog-header">
              <div>
                <p className="eyebrow">Single item capture</p>
                <h2>Take a clear clothing photo</h2>
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
            {cameraError && <p className="error-banner">{cameraError}</p>}
            <button
              className="capture-button"
              disabled={Boolean(cameraError) || !cameraReady}
              onClick={() => void capturePhoto()}
              type="button"
            >
              {cameraReady ? "Capture photo" : "Starting camera..."}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
