import React, { useCallback, useState } from 'react';
import { Upload, X, AlertCircle } from 'lucide-react';
import { UploadedImage } from '../../../shared/types';

interface ImageUploadProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  images, 
  onImagesChange, 
  maxImages = 4,
  disabled = false 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateId = () => Math.random().toString(36).substr(2, 9);

  const validateFile = (file: File): string | null => {
    if (!file.type.startsWith('image/')) {
      return '只支持图片文件';
    }
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return '图片大小不能超过10MB';
    }
    return null;
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFiles = useCallback(async (files: FileList) => {
    setError(null);
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;
    
    if (fileArray.length > remainingSlots) {
      setError(`最多上传 ${maxImages} 张，还可上传 ${remainingSlots} 张`);
      return;
    }

    const newImages: UploadedImage[] = [];
    
    for (const file of fileArray) {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        continue;
      }

      try {
        const base64 = await fileToBase64(file);
        const preview = URL.createObjectURL(file);
        
        newImages.push({
          id: generateId(),
          file,
          preview,
          base64,
          name: file.name,
          size: file.size
        });
      } catch (err) {
        console.error('文件处理失败:', err);
        setError('文件处理失败，请重试');
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }
  }, [images, maxImages, onImagesChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [disabled, handleFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    e.target.value = '';
  }, [handleFiles]);

  const removeImage = useCallback((id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onImagesChange(images.filter(img => img.id !== id));
    setError(null);
  }, [images, onImagesChange]);

  return (
    <div className="space-y-3">
      {images.length < maxImages && (
        <div
          className={`relative border border-dashed rounded-xl p-4 transition-all cursor-pointer ${
            dragActive 
              ? 'border-violet-500 bg-violet-500/10' 
              : 'border-zinc-700/50 hover:border-zinc-600 hover:bg-zinc-800/30'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !disabled && document.getElementById('file-upload')?.click()}
        >
          <input
            id="file-upload"
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            disabled={disabled}
            className="hidden"
          />
          
          <div className="flex flex-col items-center justify-center py-2">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-2 ${
              dragActive ? 'bg-violet-500/20' : 'bg-zinc-800/50'
            }`}>
              <Upload className={`w-5 h-5 ${dragActive ? 'text-violet-400' : 'text-zinc-500'}`} />
            </div>
            <p className="text-xs text-zinc-400 text-center">
              {dragActive ? '松开上传' : '拖拽或点击上传'}
            </p>
            <p className="text-xs text-zinc-600 text-center mt-1">
              {images.length}/{maxImages}
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2.5 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-red-300">{error}</span>
        </div>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {images.map((image) => (
            <div 
              key={image.id} 
              className="relative group rounded-lg overflow-hidden border border-zinc-800/50 bg-zinc-900/50"
            >
              <img 
                src={image.preview} 
                alt={image.name} 
                className="w-full h-16 object-cover" 
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(image.id); }}
                disabled={disabled}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
