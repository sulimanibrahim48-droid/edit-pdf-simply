import { useState, useEffect } from "react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import PdfEditor from "@/components/PdfEditor";

const Index = () => {
  const [file, setFile] = useState<File | null>(null);

  // Auto-load test PDF for testing - remove after testing
  useEffect(() => {
    fetch("/test.pdf")
      .then((res) => res.blob())
      .then((blob) => {
        const f = new File([blob], "test.pdf", { type: "application/pdf" });
        setFile(f);
      })
      .catch(() => {});
  }, []);

  if (file) {
    return <PdfEditor file={file} onBack={() => setFile(null)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <UploadZone onFileSelect={setFile} />
    </div>
  );
};

export default Index;
