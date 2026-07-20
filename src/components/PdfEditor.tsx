import { useState, useCallback } from "react";
import EditorToolbar, { type Tool } from "./EditorToolbar";
import PdfCanvas from "./PdfCanvas";
import PdfThumbnails from "./PdfThumbnails";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { PDFDocument, rgb } from 'pdf-lib';

interface PdfEditorProps {
  file: File;
  onBack: () => void;
}

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
  fontSize?: number;
  imageUrl?: string;
}

const PdfEditor = ({ file, onBack }: PdfEditorProps) => {
  const [activeTool, setActiveTool] = useState<Tool>("select");
  const [zoom, setZoom] = useState(1);
  const [activeColor, setActiveColor] = useState("#e53e3e");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [history, setHistory] = useState<Annotation[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  const handleAnnotationsChange = useCallback(
    (newAnnotations: Annotation[]) => {
      setAnnotations(newAnnotations);
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(newAnnotations);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex]
  );

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setAnnotations(history[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setAnnotations(history[historyIndex + 1]);
    }
  };

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      
      const scale = zoom * 1.5;

      for (const ann of annotations) {
        if (ann.page < 1 || ann.page > pages.length) continue;
        const page = pages[ann.page - 1];
        const { height: pageHeight } = page.getSize();
        
        const px = (ann.x) / scale;
        const py = pageHeight - ((ann.y) / scale);

        const hexToRgb = (hex: string) => {
           let r = 0, g = 0, b = 0;
           if (hex.startsWith('#')) {
              const hexStr = hex.slice(1);
              if (hexStr.length === 3) {
                 r = parseInt(hexStr[0] + hexStr[0], 16) / 255;
                 g = parseInt(hexStr[1] + hexStr[1], 16) / 255;
                 b = parseInt(hexStr[2] + hexStr[2], 16) / 255;
              } else if (hexStr.length === 6) {
                 r = parseInt(hexStr.slice(0, 2), 16) / 255;
                 g = parseInt(hexStr.slice(2, 4), 16) / 255;
                 b = parseInt(hexStr.slice(4, 6), 16) / 255;
              }
           }
           return rgb(r, g, b);
        };
        const color = hexToRgb(ann.color || '#000000');

        if (ann.type === "rectangle" || ann.type === "highlight") {
           const width = (ann.width || 0) / scale;
           const height = (ann.height || 0) / scale;
           const isHighlight = ann.type === "highlight";
           
           page.drawRectangle({
              x: px,
              y: py - height,
              width: width,
              height: height,
              color: isHighlight ? color : undefined,
              borderColor: isHighlight ? undefined : color,
              borderWidth: isHighlight ? 0 : 2,
              opacity: isHighlight ? 0.25 : 1,
           });
        }
        else if (ann.type === "circle") {
           const width = (ann.width || 0) / scale;
           const height = (ann.height || 0) / scale;
           page.drawEllipse({
               x: px + width / 2,
               y: py - height / 2,
               xScale: Math.abs(width / 2),
               yScale: Math.abs(height / 2),
               borderColor: color,
               borderWidth: 2,
           });
        }
        else if (ann.type === "text" || ann.type === "text-replace") {
           const fontSize = (ann.fontSize || 16) / scale;
           if (ann.type === "text-replace") {
               const rw = (ann.width || 0) / scale;
               const rh = (ann.height || 0) / scale;
               page.drawRectangle({
                   x: px,
                   y: py - rh,
                   width: rw,
                   height: rh,
                   color: rgb(1, 1, 1),
               });
           }
           if (ann.text) {
               page.drawText(ann.text, {
                   x: px,
                   y: py - fontSize, 
                   size: fontSize,
                   color: color,
               });
           }
        }
        else if (ann.type === "line") {
           page.drawLine({
               start: { x: px, y: py },
               end: { x: (ann.endX || ann.x) / scale, y: pageHeight - ((ann.endY || ann.y) / scale) },
               thickness: 2,
               color: color,
           });
        }
        else if (ann.type === "draw" && ann.points && ann.points.length > 1) {
           for (let i = 1; i < ann.points.length; i++) {
               const p1 = ann.points[i - 1];
               const p2 = ann.points[i];
               page.drawLine({
                   start: { x: p1.x / scale, y: pageHeight - Math.abs(p1.y) / scale },
                   end: { x: p2.x / scale, y: pageHeight - Math.abs(p2.y) / scale },
                   thickness: 2,
                   color: color,
               });
           }
        }
        else if (ann.type === "image" && ann.imageUrl) {
           try {
              const res = await fetch(ann.imageUrl);
              const imgBytes = await res.arrayBuffer();
              let pdfImg;
              try {
                  pdfImg = await pdfDoc.embedPng(imgBytes);
              } catch (_) {
                  pdfImg = await pdfDoc.embedJpg(imgBytes);
              }
              const width = (ann.width || 100) / scale;
              const height = (ann.height || 100) / scale;
              page.drawImage(pdfImg, {
                  x: px,
                  y: py - height,
                  width: width,
                  height: height,
              });
           } catch (e) {
               console.error("Failed to embed image", e);
           }
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited-${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Failed to generate PDF", e);
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url;
      a.download = `edited-${file.name}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <EditorToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onZoomIn={() => setZoom((z) => Math.min(z + 0.25, 3))}
        onZoomOut={() => setZoom((z) => Math.max(z - 0.25, 0.5))}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDownload={handleDownload}
        onBack={onBack}
        zoom={zoom}
        activeColor={activeColor}
        onColorChange={setActiveColor}
      />
      <PdfCanvas
        file={file}
        activeTool={activeTool}
        zoom={zoom}
        activeColor={activeColor}
        annotations={annotations}
        onAnnotationsChange={handleAnnotationsChange}
        onToolChange={setActiveTool}
        currentPage={currentPage}
        onPageCountChange={setPageCount}
      />
      {/* Page navigation */}
      <div className="bg-toolbar text-toolbar-foreground px-4 py-2 flex items-center justify-center gap-4">
        <Button
          variant="toolbar"
          size="icon-sm"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          Page {currentPage} of {pageCount}
        </span>
        <Button
          variant="toolbar"
          size="icon-sm"
          onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
          disabled={currentPage >= pageCount}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default PdfEditor;
