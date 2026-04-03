import { useState, useEffect } from "react";
import Header from "@/components/Header";
import UploadZone from "@/components/UploadZone";
import PdfEditor from "@/components/PdfEditor";

const Index = () => {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    fetch('/test.pdf')
      .then(r => r.arrayBuffer())
      .then(buf => setFile(new File([buf], 'test.pdf', { type: 'application/pdf' })));
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
