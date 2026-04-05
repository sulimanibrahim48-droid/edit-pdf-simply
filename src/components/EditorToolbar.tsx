import {
  Type,
  Square,
  Circle,
  Minus,
  Highlighter,
  MessageSquare,
  Pencil,
  Eraser,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  ArrowLeft,
  Image as ImageIcon,
  MousePointer2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type Tool =
  | "select"
  | "text"
  | "text-replace"
  | "image"
  | "rectangle"
  | "circle"
  | "line"
  | "highlight"
  | "comment"
  | "draw"
  | "eraser";

interface EditorToolbarProps {
  activeTool: Tool;
  onToolChange: (tool: Tool) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDownload: () => void;
  onBack: () => void;
  zoom: number;
  activeColor: string;
  onColorChange: (color: string) => void;
}

const tools: { tool: Tool; icon: React.ElementType; label: string }[] = [
  { tool: "select", icon: MousePointer2, label: "Select/Move" },
  { tool: "text", icon: Type, label: "Add Text" },
  { tool: "image", icon: ImageIcon, label: "Add Image" },
  { tool: "draw", icon: Pencil, label: "Draw" },
  { tool: "highlight", icon: Highlighter, label: "Highlight" },
  { tool: "rectangle", icon: Square, label: "Rectangle" },
  { tool: "circle", icon: Circle, label: "Circle" },
  { tool: "line", icon: Minus, label: "Line" },
  { tool: "comment", icon: MessageSquare, label: "Comment" },
  { tool: "eraser", icon: Eraser, label: "Eraser" },
];

const colors = [
  "#e53e3e",
  "#3182ce",
  "#38a169",
  "#d69e2e",
  "#805ad5",
  "#1a202c",
];

const EditorToolbar = ({
  activeTool,
  onToolChange,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  onDownload,
  onBack,
  zoom,
  activeColor,
  onColorChange,
}: EditorToolbarProps) => {
  return (
    <div className="bg-toolbar text-toolbar-foreground px-4 py-2 flex items-center gap-1 shadow-lg">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="toolbar" size="icon-sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Back</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-2 bg-toolbar-foreground/20" />

      {tools.map(({ tool, icon: Icon, label }) => (
        <Tooltip key={tool}>
          <TooltipTrigger asChild>
            <Button
              variant={activeTool === tool ? "toolbar-active" : "toolbar"}
              size="icon-sm"
              onClick={() => onToolChange(tool)}
            >
              <Icon className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}

      <Separator orientation="vertical" className="h-6 mx-2 bg-toolbar-foreground/20" />

      <div className="flex items-center gap-1">
        {colors.map((color) => (
          <button
            key={color}
            className={`h-6 w-6 rounded-full border-2 transition-all ${activeColor === color
              ? "border-toolbar-foreground scale-110"
              : "border-transparent hover:scale-105"
              }`}
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>

      <Separator orientation="vertical" className="h-6 mx-2 bg-toolbar-foreground/20" />

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="toolbar" size="icon-sm" onClick={onUndo}>
            <Undo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Undo</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="toolbar" size="icon-sm" onClick={onRedo}>
            <Redo2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Redo</TooltipContent>
      </Tooltip>

      <Separator orientation="vertical" className="h-6 mx-2 bg-toolbar-foreground/20" />

      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="toolbar" size="icon-sm" onClick={onZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom Out</TooltipContent>
        </Tooltip>
        <span className="text-xs font-medium min-w-[3rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="toolbar" size="icon-sm" onClick={onZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom In</TooltipContent>
        </Tooltip>
      </div>

      <div className="ml-auto">
        <Button variant="hero" size="sm" onClick={onDownload}>
          <Download className="h-4 w-4 mr-1" />
          Save and Download PDF
        </Button>
      </div>
    </div>
  );
};

export default EditorToolbar;
