import { useCallback, useState, useRef } from "react";
import { Upload, FileUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface UploadZoneProps {
  onFileSelect: (file: File) => void;
}

const UploadZone = ({ onFileSelect }: UploadZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(e.type === "dragenter" || e.type === "dragover");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file?.type === "application/pdf") onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl mx-auto"
      >
        <h1 className="text-4xl md:text-5xl font-extrabold text-foreground mb-4 tracking-tight">
          PDF Editor
        </h1>
        <p className="text-lg text-muted-foreground mb-10 leading-relaxed">
          Edit PDF by adding text, shapes, comments and highlights.
          <br className="hidden sm:block" />
          Your secure and simple tool to edit PDF.
        </p>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className={`relative rounded-2xl border-2 border-dashed p-12 transition-all duration-300 cursor-pointer ${
            isDragging
              ? "border-primary bg-accent drop-zone-active"
              : "border-border bg-card hover:border-primary/50 hover:bg-accent/50"
          }`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleChange}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <Button variant="hero" size="xl">
              <FileUp className="h-5 w-5 mr-2" />
              Select PDF file
            </Button>
            <p className="text-sm text-muted-foreground">or drop PDF here</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6"
        >
          {[
            { icon: "✏️", label: "Add Text" },
            { icon: "🔲", label: "Draw Shapes" },
            { icon: "💬", label: "Comments" },
            { icon: "🖍️", label: "Highlights" },
          ].map((feature) => (
            <div
              key={feature.label}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <span className="text-2xl">{feature.icon}</span>
              <span className="text-sm font-medium text-foreground">
                {feature.label}
              </span>
            </div>
          ))}
        </motion.div>
      </motion.div>
    </div>
  );
};

export default UploadZone;
