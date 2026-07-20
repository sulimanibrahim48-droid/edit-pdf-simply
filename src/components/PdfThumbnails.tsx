import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { cn } from "@/lib/utils";

interface PdfThumbnailsProps {
  file: File;
  currentPage: number;
  onPageChange: (page: number) => void;
}

const PdfThumbnails = ({ file, currentPage, onPageChange }: PdfThumbnailsProps) => {
  const [thumbs, setThumbs] = useState<string[]>([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    cancelRef.current = false;
    const build = async () => {
      const buf = await file.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buf }).promise;
      const out: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelRef.current) return;
        const page = await doc.getPage(i);
        const viewport = page.getViewport({ scale: 0.25 });
        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d")!;
        await page.render({ canvasContext: ctx, viewport }).promise;
        out.push(canvas.toDataURL("image/png"));
        setThumbs([...out]);
      }
    };
    build();
    return () => {
      cancelRef.current = true;
    };
  }, [file]);

  if (thumbs.length <= 1) return null;

  return (
    <aside className="w-40 shrink-0 bg-muted/30 border-r overflow-y-auto p-3 space-y-3">
      {thumbs.map((src, idx) => {
        const page = idx + 1;
        const active = page === currentPage;
        return (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={cn(
              "w-full block rounded-md overflow-hidden border-2 transition",
              active
                ? "border-primary ring-2 ring-primary/30"
                : "border-transparent hover:border-muted-foreground/40"
            )}
          >
            <img src={src} alt={`Page ${page}`} className="w-full block bg-white" />
            <div className="text-xs py-1 text-center text-muted-foreground">
              {page}
            </div>
          </button>
        );
      })}
    </aside>
  );
};

export default PdfThumbnails;
