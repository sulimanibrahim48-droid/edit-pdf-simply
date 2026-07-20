import { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Rnd } from "react-rnd";
import type { Tool } from "./EditorToolbar";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs`;

interface Annotation {
  id: string;
  type: Tool | "text-replace" | "image";
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
  originalText?: string;
  fontSize?: number;
  imageUrl?: string;
}

interface PdfTextItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
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
  onToolChange: (tool: Tool) => void;
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
  onToolChange,
}: PdfCanvasProps) => {
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [pdfTextItems, setPdfTextItems] = useState<PdfTextItem[]>([]);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});
  const [pendingImagePt, setPendingImagePt] = useState<{x: number, y: number} | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingImagePt) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        imageCache.current[url] = img;
        const width = Math.min(img.width, 300);
        const height = img.height * (width / img.width);
        
        onAnnotationsChange([
          ...annotations,
          {
            id: crypto.randomUUID(),
            type: "image",
            x: pendingImagePt.x,
            y: pendingImagePt.y,
            width,
            height,
            color: "",
            imageUrl: url,
            page: currentPage,
          }
        ]);
        setPendingImagePt(null);
        onToolChange("select");
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

  // Keyboard events for deleting selected annotations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") {
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedAnnotationId) {
        onAnnotationsChange(annotations.filter((a) => a.id !== selectedAnnotationId));
        setSelectedAnnotationId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedAnnotationId, annotations, onAnnotationsChange]);

  // Render page and extract text positions
  useEffect(() => {
    if (!pdfDoc || !pdfCanvasRef.current) return;
    const renderPage = async () => {
      const page = await pdfDoc.getPage(currentPage);
      const scale = zoom * 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = pdfCanvasRef.current!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;

      // Extract text content with positions
      const textContent = await page.getTextContent();
      const items: PdfTextItem[] = [];
      for (const item of textContent.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
        const x = tx[4];
        const y = tx[5] - fontSize;
        // Measure width using canvas
        ctx.save();
        ctx.font = `${fontSize}px sans-serif`;
        const measured = ctx.measureText(item.str);
        ctx.restore();
        items.push({
          text: item.str,
          x,
          y,
          width: measured.width,
          height: fontSize,
          fontSize,
        });
      }
      setPdfTextItems(items);
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
            ctx.font = `${ann.fontSize || 16}px Inter, sans-serif`;
            ctx.fillText(ann.text || "", ann.x, ann.y);
          }
          break;
        case "text-replace":
          // White-out the original text area, then draw replacement
          if (ann.width && ann.height) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(ann.x, ann.y, ann.width, ann.height);
          }
          if (editingTextId !== ann.id) {
            ctx.fillStyle = ann.color;
            ctx.font = `${ann.fontSize || 16}px Inter, sans-serif`;
            ctx.fillText(ann.text || "", ann.x, ann.y + (ann.height || 16));
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

  // Find PDF text item at a given canvas point
  const findTextAtPoint = (pt: { x: number; y: number }): PdfTextItem | null => {
    // Check if any existing text-replace annotation already covers this spot
    const existingReplace = annotations.find(
      (a) =>
        a.type === "text-replace" &&
        a.page === currentPage &&
        pt.x >= a.x &&
        pt.x <= a.x + (a.width || 0) &&
        pt.y >= a.y &&
        pt.y <= a.y + (a.height || 0)
    );
    if (existingReplace) return null; // Let them edit the existing annotation instead

    for (const item of pdfTextItems) {
      if (
        pt.x >= item.x &&
        pt.x <= item.x + item.width &&
        pt.y >= item.y &&
        pt.y <= item.y + item.height
      ) {
        return item;
      }
    }
    return null;
  };

  // Find existing text/text-replace annotation at point
  const findAnnotationAtPoint = (pt: { x: number; y: number }): Annotation | null => {
    const pageAnns = annotations.filter(
      (a) => (a.type === "text" || a.type === "text-replace") && a.page === currentPage
    );
    for (const ann of pageAnns) {
      const w = ann.width || 100;
      const h = ann.height || (ann.fontSize || 16);
      const ay = ann.type === "text-replace" ? ann.y : ann.y - (ann.fontSize || 16);
      if (pt.x >= ann.x && pt.x <= ann.x + w && pt.y >= ay && pt.y <= ay + h) {
        return ann;
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "select") {
      setSelectedAnnotationId(null);
      return;
    }
    const pt = getCanvasPoint(e);

    if (activeTool === "image") {
       setPendingImagePt(pt);
       fileInputRef.current?.click();
       return;
    }

    if (activeTool === "eraser") {
      const pageAnns = annotations.filter(a => a.page === currentPage);
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        const ann = pageAnns[i];
        let hit = false;
        if (ann.type === "rectangle" || ann.type === "highlight" || ann.type === "text-replace" || ann.type === "image") {
          const w = ann.width || 0;
          const h = ann.height || 0;
          const left = Math.min(ann.x, ann.x + w);
          const top = Math.min(ann.y, ann.y + h);
          hit = pt.x >= left && pt.x <= left + Math.abs(w) && pt.y >= top && pt.y <= top + Math.abs(h);
        } else if (ann.type === "circle") {
           const w = ann.width || 0;
           const h = ann.height || 0;
           const left = Math.min(ann.x, ann.x + w);
           const top = Math.min(ann.y, ann.y + h);
           hit = pt.x >= left && pt.x <= left + Math.abs(w) && pt.y >= top && pt.y <= top + Math.abs(h);
        } else if (ann.type === "text") {
           const h = ann.fontSize || 16;
           const w = 100;
           hit = pt.x >= ann.x && pt.x <= ann.x + w && pt.y >= ann.y - h && pt.y <= ann.y;
        } else if (ann.type === "draw" || ann.type === "line") {
           if (ann.points && ann.points.length > 0) {
               const xs = ann.points.map(p=>p.x);
               const ys = ann.points.map(p=>p.y);
               const minX = Math.min(...xs), maxX = Math.max(...xs);
               const minY = Math.min(...ys), maxY = Math.max(...ys);
               hit = pt.x >= minX - 10 && pt.x <= maxX + 10 && pt.y >= minY - 10 && pt.y <= maxY + 10;
           } else if (ann.endX !== undefined && ann.endY !== undefined) {
               const minX = Math.min(ann.x, ann.endX), maxX = Math.max(ann.x, ann.endX);
               const minY = Math.min(ann.y, ann.endY), maxY = Math.max(ann.y, ann.endY);
               hit = pt.x >= minX - 10 && pt.x <= maxX + 10 && pt.y >= minY - 10 && pt.y <= maxY + 10;
           }
        } else if (ann.type === "comment") {
           hit = Math.hypot(pt.x - ann.x, pt.y - ann.y) <= 12;
        }

        if (hit) {
          onAnnotationsChange(annotations.filter(a => a.id !== ann.id));
          return;
        }
      }

      // If we didn't hit an annotation, can we hit PDF text to "erase" it?
      const textItem = findTextAtPoint(pt);
      if (textItem) {
        const id = crypto.randomUUID();
        const padding = 2;
        const newAnn: Annotation = {
          id,
          type: "text-replace",
          x: textItem.x - padding,
          y: textItem.y - padding,
          width: textItem.width + padding * 2,
          height: textItem.height + padding * 2,
          color: "#000000",
          text: "", // Empty string means it's just a white space over the text!
          originalText: textItem.text,
          fontSize: textItem.fontSize,
          page: currentPage,
        };
        onAnnotationsChange([...annotations, newAnn]);
      }
      return;
    }

    setIsDrawing(true);
    setDrawStart(pt);

    if (activeTool === "text") {
      // First check if clicking on an existing annotation to re-edit
      const existingAnn = findAnnotationAtPoint(pt);
      if (existingAnn) {
        setEditingText(existingAnn.text || "");
        setEditingTextId(existingAnn.id);
        setIsDrawing(false);
        setTimeout(() => textInputRef.current?.focus(), 50);
        return;
      }

      // Check if clicking on existing PDF text to replace it
      const textItem = findTextAtPoint(pt);
      if (textItem) {
        const id = crypto.randomUUID();
        const padding = 2;
        const newAnn: Annotation = {
          id,
          type: "text-replace",
          x: textItem.x - padding,
          y: textItem.y - padding,
          width: textItem.width + padding * 2,
          height: textItem.height + padding * 2,
          color: "#000000",
          text: textItem.text,
          originalText: textItem.text,
          fontSize: textItem.fontSize,
          page: currentPage,
        };
        onAnnotationsChange([...annotations, newAnn]);
        setEditingText(textItem.text);
        setEditingTextId(id);
        setIsDrawing(false);
        setTimeout(() => {
          const ta = textInputRef.current;
          if (ta) {
            ta.focus();
            ta.setSelectionRange(0, ta.value.length);
          }
        }, 60);
        return;
      }

      // Otherwise add new text
      const id = crypto.randomUUID();
      const newAnn: Annotation = {
        id,
        type: "text",
        x: pt.x,
        y: pt.y,
        color: activeColor,
        text: "",
        fontSize: 16,
        page: currentPage,
      };
      onAnnotationsChange([...annotations, newAnn]);
      setEditingText("");
      setEditingTextId(id);
      setIsDrawing(false);
      setTimeout(() => textInputRef.current?.focus(), 50);
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

  const commitTextEdit = useCallback(() => {
    if (editingTextId) {
      const ann = annotations.find((a) => a.id === editingTextId);
      if (editingText.trim()) {
        // For text-replace, update the white-out width to match new text
        if (ann?.type === "text-replace") {
          const canvas = overlayCanvasRef.current;
          let newWidth = ann.width || 0;
          if (canvas) {
            const ctx = canvas.getContext("2d")!;
            ctx.font = `${ann.fontSize || 16}px Inter, sans-serif`;
            const measured = ctx.measureText(editingText);
            newWidth = Math.max(ann.width || 0, measured.width + 4);
          }
          onAnnotationsChange(
            annotations.map((a) =>
              a.id === editingTextId ? { ...a, text: editingText, width: newWidth } : a
            )
          );
        } else {
          onAnnotationsChange(
            annotations.map((a) => (a.id === editingTextId ? { ...a, text: editingText } : a))
          );
        }
      } else {
        onAnnotationsChange(annotations.filter((a) => a.id !== editingTextId));
      }
      setEditingTextId(null);
      setEditingText("");
    }
  }, [editingTextId, editingText, annotations, onAnnotationsChange]);

  // Get the position for the editing input
  const getEditingInputStyle = (ann: Annotation) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return {};
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    const fontSize = ann.fontSize || 16;

    if (ann.type === "text-replace") {
      return {
        left: ann.x * scaleX,
        top: ann.y * scaleY,
        color: ann.color,
        borderColor: ann.color,
        fontSize: fontSize * scaleY,
        height: (ann.height || fontSize) * scaleY,
        zIndex: 20,
        minWidth: `${(ann.width || 100) * scaleX}px`,
        background: "white",
      };
    }
    return {
      left: ann.x * scaleX,
      top: (ann.y - fontSize) * scaleY,
      color: ann.color,
      borderColor: ann.color,
      fontSize: fontSize * scaleY,
      zIndex: 20,
      minWidth: "100px",
    };
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto bg-muted/50 flex items-start justify-center p-8"
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload}
        accept="image/*"
        className="hidden" 
      />
      <div className="relative shadow-2xl rounded-lg overflow-hidden">
        <canvas ref={pdfCanvasRef} className="block" />
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{
            cursor: activeTool === "select" ? "default" : activeTool === "text" ? "text" : "crosshair",
            pointerEvents: editingTextId ? "none" : "auto",
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
        {/* Text input overlays */}
        {annotations
          .filter(
            (a) =>
              (a.type === "text" || a.type === "text-replace") &&
              a.page === currentPage &&
              editingTextId === a.id
          )
          .map((ann) => {
            const canvas = overlayCanvasRef.current;
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / canvas.width;
            const scaleY = rect.height / canvas.height;
            const fontSize = ann.fontSize || 16;
            const isReplace = ann.type === "text-replace";
            const boxW = (ann.width || 200) * scaleX;
            const boxH = (ann.height || fontSize * 1.4) * scaleY;
            const boxX = ann.x * scaleX;
            const boxY = (isReplace ? ann.y : ann.y - fontSize) * scaleY;
            return (
              <Rnd
                key={ann.id}
                size={{ width: boxW, height: boxH }}
                position={{ x: boxX, y: boxY }}
                bounds="parent"
                cancel="textarea"
                style={{ zIndex: 30, pointerEvents: "auto" }}
                onDragStop={(e, d) => {
                  onAnnotationsChange(
                    annotations.map((a) =>
                      a.id === ann.id
                        ? {
                            ...a,
                            x: d.x / scaleX,
                            y: isReplace ? d.y / scaleY : d.y / scaleY + fontSize,
                          }
                        : a
                    )
                  );
                }}
                onResizeStop={(e, dir, refEl, delta, position) => {
                  const newW = parseFloat(refEl.style.width) / scaleX;
                  const newH = parseFloat(refEl.style.height) / scaleY;
                  onAnnotationsChange(
                    annotations.map((a) =>
                      a.id === ann.id
                        ? {
                            ...a,
                            width: newW,
                            height: newH,
                            x: position.x / scaleX,
                            y: isReplace ? position.y / scaleY : position.y / scaleY + fontSize,
                          }
                        : a
                    )
                  );
                }}
                enableResizing={{
                  top: true, right: true, bottom: true, left: true,
                  topRight: true, bottomRight: true, bottomLeft: true, topLeft: true,
                }}
              >
                <div
                  className="w-full h-full"
                  style={{
                    background: isReplace ? "white" : "transparent",
                    outline: "2px dashed #2563eb",
                  }}
                >
                  <textarea
                    ref={textInputRef}
                    className="w-full h-full outline-none resize-none bg-transparent p-0 m-0 border-0 leading-tight"
                    style={{
                      color: ann.color,
                      fontSize: fontSize * scaleY,
                      fontFamily: "Inter, sans-serif",
                    }}
                    value={editingText}
                    onChange={(e) => setEditingText(e.target.value)}
                    onBlur={commitTextEdit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        commitTextEdit();
                      }
                    }}
                  />
                </div>
              </Rnd>
            );
          })}
        {/* Image resize overlays */}
        {annotations
          .filter((a) => a.type === "image" && a.page === currentPage)
          .map((ann) => {
            const canvas = overlayCanvasRef.current;
            if (!canvas) return null;
            const rect = canvas.getBoundingClientRect();
            const scaleX = rect.width / canvas.width;
            const scaleY = rect.height / canvas.height;
            return (
              <Rnd
                key={ann.id}
                size={{ width: (ann.width || 100) * scaleX, height: (ann.height || 100) * scaleY }}
                position={{ x: ann.x * scaleX, y: ann.y * scaleY }}
                onDragStop={(e, d) => {
                   onAnnotationsChange(annotations.map(a => a.id === ann.id ? { ...a, x: d.x / scaleX, y: d.y / scaleY } : a));
                }}
                onResizeStop={(e, dir, ref, delta, position) => {
                   onAnnotationsChange(annotations.map(a => a.id === ann.id ? { 
                     ...a, 
                     width: parseFloat(ref.style.width) / scaleX, 
                     height: parseFloat(ref.style.height) / scaleY,
                     x: position.x / scaleX,
                     y: position.y / scaleY
                   } : a));
                }}
                bounds="parent"
                onMouseDown={() => {
                   if (activeTool === "select") setSelectedAnnotationId(ann.id);
                }}
                style={{ zIndex: 10, border: selectedAnnotationId === ann.id ? "2px dashed #2563eb" : activeTool === "select" ? "2px dashed transparent" : "none", pointerEvents: activeTool === "eraser" ? "none" : "auto" }}
                disableDragging={activeTool !== "select"}
                enableResizing={activeTool === "select" ? { top: true, right: true, bottom: true, left: true, topRight: true, bottomRight: true, bottomLeft: true, topLeft: true } : false}
              >
                <img src={ann.imageUrl} className="w-full h-full object-fill pointer-events-none" />
              </Rnd>
            );
          })}
      </div>
    </div>
  );
};

export default PdfCanvas;
