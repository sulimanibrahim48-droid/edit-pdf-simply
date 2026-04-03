import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import type { Tool } from "./EditorToolbar";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface Annotation {
  id: string;
  type: Tool;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color: string;
  points?: { x: number; y: number }[];
  endX?: number;
  endY?: number;
  page: number;
}

interface PdfCanvasProps {
  file: File;
  activeTool: Tool;
  zoom: number;
  activeColor: string;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  currentPage: number;
  onPageCountChange: (count: number) => void;
}

const PdfCanvas = ({
  file,
  activeTool,
  zoom,
  activeColor,
  annotations,
  onAnnotationsChange,
  currentPage,
  onPageCountChange,
}: PdfCanvasProps) => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const textInputRef = useRef<HTMLInputElement>(null);

  // Load PDF
  useEffect(() => {
    const loadPdf = async () => {
      const arrayBuffer = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setPdfDoc(doc);
      onPageCountChange(doc.numPages);
    };
    loadPdf();
  }, [file, onPageCountChange]);

  // Render page
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    const renderPage = async () => {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom * 1.5 });
      const canvas = pdfCanvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
    };
    renderPage();
  }, [pdfDoc, currentPage, zoom]);

  // Sync overlay canvas size
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    overlayCanvasRef.current.width = canvasSize.width;
    overlayCanvasRef.current.height = canvasSize.height;
  }, [canvasSize]);

  // Draw annotations
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    const ctx = overlayCanvasRef.current.getContext("2d")!;
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

    const pageAnnotations = annotations.filter((a) => a.page === currentPage);
    for (const ann of pageAnnotations) {
      ctx.save();
      switch (ann.type) {
        case "rectangle":
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = 2;
          ctx.strokeRect(ann.x, ann.y, ann.width || 0, ann.height || 0);
          break;
        case "circle":
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          const rx = (ann.width || 0) / 2;
          const ry = (ann.height || 0) / 2;
          ctx.ellipse(ann.x + rx, ann.y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case "line":
          ctx.strokeStyle = ann.color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(ann.x, ann.y);
          ctx.lineTo(ann.endX || ann.x, ann.endY || ann.y);
          ctx.stroke();
          break;
        case "highlight":
          ctx.fillStyle = ann.color + "40";
          ctx.fillRect(ann.x, ann.y, ann.width || 0, ann.height || 0);
          break;
        case "draw":
          if (ann.points && ann.points.length > 1) {
            ctx.strokeStyle = ann.color;
            ctx.lineWidth = 2;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(ann.points[0].x, ann.points[0].y);
            for (let i = 1; i < ann.points.length; i++) {
              ctx.lineTo(ann.points[i].x, ann.points[i].y);
            }
            ctx.stroke();
          }
          break;
        case "text":
          if (editingTextId !== ann.id) {
            ctx.fillStyle = ann.color;
            ctx.font = "16px Inter, sans-serif";
            ctx.fillText(ann.text || "", ann.x, ann.y);
          }
          break;
        case "comment":
          ctx.fillStyle = ann.color;
          ctx.beginPath();
          ctx.arc(ann.x, ann.y, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.font = "bold 10px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("💬", ann.x, ann.y);
          break;
      }
      ctx.restore();
    }
  }, [annotations, currentPage, canvasSize, editingTextId]);

  const getCanvasPoint = (e: React.MouseEvent) => {
    const canvas = overlayCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "select" || activeTool === "eraser") return;
    const pt = getCanvasPoint(e);
    setIsDrawing(true);
    setDrawStart(pt);

    if (activeTool === "text") {
      const id = crypto.randomUUID();
      const newAnn: Annotation = {
        id,
        type: "text",
        x: pt.x,
        y: pt.y,
        color: activeColor,
        text: "",
        page: currentPage,
      };
      onAnnotationsChange([...annotations, newAnn]);
      setEditingTextId(id);
      setIsDrawing(false);
      return;
    }

    if (activeTool === "comment") {
      const text = prompt("Enter comment:");
      if (text) {
        onAnnotationsChange([
          ...annotations,
          {
            id: crypto.randomUUID(),
            type: "comment",
            x: pt.x,
            y: pt.y,
            color: activeColor,
            text,
            page: currentPage,
          },
        ]);
      }
      setIsDrawing(false);
      return;
    }

    if (activeTool === "draw") {
      setCurrentPoints([pt]);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const pt = getCanvasPoint(e);

    if (activeTool === "draw") {
      setCurrentPoints((prev) => [...prev, pt]);
      // Draw preview
      const ctx = overlayCanvasRef.current!.getContext("2d")!;
      const pts = [...currentPoints, pt];
      if (pts.length > 1) {
        ctx.strokeStyle = activeColor;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const pt = getCanvasPoint(e);
    setIsDrawing(false);

    if (activeTool === "draw") {
      const finalPoints = [...currentPoints, pt];
      onAnnotationsChange([
        ...annotations,
        {
          id: crypto.randomUUID(),
          type: "draw",
          x: 0,
          y: 0,
          color: activeColor,
          points: finalPoints,
          page: currentPage,
        },
      ]);
      setCurrentPoints([]);
      return;
    }

    const width = pt.x - drawStart.x;
    const height = pt.y - drawStart.y;

    if (activeTool === "line") {
      onAnnotationsChange([
        ...annotations,
        {
          id: crypto.randomUUID(),
          type: "line",
          x: drawStart.x,
          y: drawStart.y,
          endX: pt.x,
          endY: pt.y,
          color: activeColor,
          page: currentPage,
        },
      ]);
    } else if (["rectangle", "circle", "highlight"].includes(activeTool)) {
      onAnnotationsChange([
        ...annotations,
        {
          id: crypto.randomUUID(),
          type: activeTool as Tool,
          x: drawStart.x,
          y: drawStart.y,
          width,
          height,
          color: activeColor,
          page: currentPage,
        },
      ]);
    }

    setDrawStart(null);
  };

  const handleTextInput = useCallback(
    (id: string, text: string) => {
      onAnnotationsChange(
        annotations.map((a) => (a.id === id ? { ...a, text } : a))
      );
    },
    [annotations, onAnnotationsChange]
  );

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-muted/50 flex items-start justify-center p-8"
    >
      <div className="relative shadow-2xl rounded-lg overflow-hidden">
        <canvas ref={pdfCanvasRef} className="block" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: activeTool === "select" ? "default" : "crosshair",
            pointerEvents: editingTextId ? "none" : "auto",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        {/* Text input overlays */}
        {annotations
          .filter((a) => a.type === "text" && a.page === currentPage && editingTextId === a.id)
          .map((ann) => {
            const canvas = overlayCanvasRef.current;
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / canvas.width;
            const scaleY = rect.height / canvas.height;
            return (
              <input
                key={ann.id}
                autoFocus
                className="absolute bg-transparent border-b-2 outline-none text-sm"
                style={{
                  left: ann.x * scaleX,
                  top: (ann.y - 16) * scaleY,
                  color: ann.color,
                  borderColor: ann.color,
                  fontSize: 16 * scaleY,
                  zIndex: 20,
                  minWidth: '100px',
                }}
                value={ann.text || ""}
                onChange={(e) => handleTextInput(ann.id, e.target.value)}
                onBlur={() => setEditingTextId(null)}
                onKeyDown={(e) => e.key === "Enter" && setEditingTextId(null)}
              />
            );
          })}
      </div>
    </div>
  );
};

export default PdfCanvas;
