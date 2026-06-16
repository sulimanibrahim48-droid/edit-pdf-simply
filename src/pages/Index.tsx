import { useState } from "react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import PdfEditor from "@/components/PdfEditor";
import { PDFDocument } from "pdf-lib";
import { Loader2 } from "lucide-react";

const imageToPdfFile = async (file: File): Promise<File> => {
  const bytes = await file.arrayBuffer();
  const pdfDoc = await PDFDocument.create();

  let img;
  if (file.type === "image/png") {
    img = await pdfDoc.embedPng(bytes);
  } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
    img = await pdfDoc.embedJpg(bytes);
  } else {
    // Convert other formats (webp, gif, bmp...) to PNG via canvas
    const url = URL.createObjectURL(file);
    const htmlImg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = htmlImg.naturalWidth;
    canvas.height = htmlImg.naturalHeight;
    canvas.getContext("2d")!.drawImage(htmlImg, 0, 0);
    URL.revokeObjectURL(url);
    const pngBlob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/png")
    );
    img = await pdfDoc.embedPng(await pngBlob.arrayBuffer());
  }

  const page = pdfDoc.addPage([img.width, img.height]);
  page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  const pdfBytes = await pdfDoc.save();
  const baseName = file.name.replace(/\.[^.]+$/, "");
  return new File([pdfBytes.buffer as ArrayBuffer], `${baseName}.pdf`, {
    type: "application/pdf",
  });
};

const Index = () => {
  const [file, setFile] = useState<File | null>(null);
  const [converting, setConverting] = useState(false);

  const handleSelect = async (selected: File) => {
    if (selected.type === "application/pdf") {
      setFile(selected);
      return;
    }
    if (selected.type.startsWith("image/")) {
      try {
        setConverting(true);
        const pdfFile = await imageToPdfFile(selected);
        setFile(pdfFile);
      } catch (e) {
        console.error("Failed to convert image to PDF", e);
      } finally {
        setConverting(false);
      }
    }
  };

  if (file) {
    return <PdfEditor file={file} onBack={() => setFile(null)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <UploadZone onFileSelect={handleSelect} />
      {converting && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="flex items-center gap-3 text-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Preparing image for editing…</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
