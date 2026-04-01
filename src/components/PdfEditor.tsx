import { useState, useCallback } from "react";
import EditorToolbar, { type Tool } from "./EditorToolbar";
import PdfCanvas from "./PdfCanvas";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  const handleDownload = () => {
    // For now, download the original file
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = `edited-${file.name}`;
    a.click();
    URL.revokeObjectURL(url);
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
