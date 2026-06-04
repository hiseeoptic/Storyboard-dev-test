"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, X, Upload } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface UploadedImage {
  id: string;
  preview: string;
  base64: string;
  fileName: string;
}

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  label?: string;
  hint?: string;
  className?: string;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:image/...;base64, prefix for API usage
      const base64 = result.split(",")[1] ?? result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function resizeImage(file: File, maxSize = 1280): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const { width, height } = img;
      // Always re-encode to JPEG (flattening transparency on white) so the
      // base64 data and the declared mime type always match — required for
      // the Gemini reference-image API to accept the photos reliably.
      const scale = Math.min(1, maxSize / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(file); return; }
          const name = file.name.replace(/\.\w+$/, "") + ".jpg";
          resolve(new File([blob], name, { type: "image/jpeg" }));
        },
        "image/jpeg",
        0.9
      );
    };
    img.src = url;
  });
}

export function ImageUploader({
  images,
  onChange,
  maxImages = 3,
  label,
  hint,
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const remaining = maxImages - images.length;
      if (remaining <= 0) return;

      const toProcess = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, remaining);

      const newImages: UploadedImage[] = [];
      for (const file of toProcess) {
        const resized = await resizeImage(file);
        const base64 = await fileToBase64(resized);
        const preview = URL.createObjectURL(resized);
        newImages.push({
          id: generateId(),
          preview,
          base64,
          fileName: file.name,
        });
      }

      onChange([...images, ...newImages]);
    },
    [images, maxImages, onChange]
  );

  const removeImage = (id: string) => {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.preview);
    onChange(images.filter((i) => i.id !== id));
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  return (
    <div className={cn("space-y-3", className)}>
      {label && <p className="text-sm font-medium">{label}</p>}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {/* Preview grid */}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative h-24 w-24 overflow-hidden rounded-lg border"
            >
              <img
                src={img.preview}
                alt={img.fileName}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {images.length < maxImages && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          )}
          onClick={() => inputRef.current?.click()}
        >
          {dragging ? (
            <Upload className="h-8 w-8 text-primary" />
          ) : (
            <ImagePlus className="h-8 w-8 text-muted-foreground" />
          )}
          <p className="text-xs text-muted-foreground">
            {dragging
              ? "Drop images here"
              : `Click or drag images (${images.length}/${maxImages})`}
          </p>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
