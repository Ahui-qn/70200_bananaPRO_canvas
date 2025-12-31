import React, { useCallback, useState } from 'react';
import { Upload, X, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { UploadedImage } from '../shared/types';

interface ImageUploadProps {
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  disabled?: boolean;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  images, 
  onImagesChange, 
  maxImages = 14,
  disabled = false 
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 生成唯一ID
  const generateId = () => Math.random().toString(36).substr(2, 9);

  // 验证文件
  const validateFile = (file: File): string | null => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      return '只支持图片文件';
    }
    
    // 检查文件大小（最大10MB）
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return '图片大小不能超过10MB';
    }
    
    return null;
  };

  // 将文件转换为Base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 处理文件上传
  const handleFiles = useCallback(async (files: FileList) => {
    setError(null);
    
    const fileArray = Array.from(files);
    const remainingSlots = maxImages - images.length;
    
    if (fileArray.length > remainingSlots) {
      setError(`最多只能上传${maxImages}张图片，当前还可以上传${remainingSlots}张`);
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
        
        const uploadedImage: UploadedImage = {
          id: generateId(),
          file,
          preview,
          base64,
          name: file.name,
          size: file.size
        };
        
        newImages.push(uploadedImage);
      } catch (err) {
        console.error('文件处理失败:', err);
        setError('文件处理失败，请重试');
      }
    }

    if (newImages.length > 0) {
      onImagesChange([...images, ...newImages]);
    }
  }, [images, maxImages, onImagesChange]);

  // 拖拽处理
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

  // 文件选择处理
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
    // 清空input值，允许重复选择同一文件
    e.target.value = '';
  }, [handleFiles]);

  // 删除图片
  const removeImage = useCallback((id: string) => {
    const imageToRemove = images.find(img => img.id === id);
    if (imageToRemove) {
      // 释放blob URL
      URL.revokeObjectURL(imageToRemove.preview);
    }
    onImagesChange(images.filter(img => img.id !== id));
    setError(null);
  }, [images, onImagesChange]);

  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      {/* 上传区域 */}
      <div
        className={`relative border-2 border-dashed rounded-xl p-4 transition-all ${
          dragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-zinc-700 hover:border-zinc-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
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
          <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'text-blue-500' : 'text-zinc-500'}`} />
          <p className="text-sm text-zinc-300 text-center mb-1">
            {dragActive ? '松开鼠标上传图片' : '拖拽图片到此处或点击上传'}
          </p>
          <p className="text-xs text-zinc-500 text-center">
            支持 JPG、PNG、GIF 等格式，最大10MB
          </p>
          <p className="text-xs text-zinc-500 text-center mt-1">
            最多可上传 {maxImages} 张图片 ({images.length}/{maxImages})
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-950/50 border border-red-900/50 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* 图片预览网格 */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
          {images.map((image) => (
            <div key={image.id} className="relative group bg-zinc-900/50 rounded-lg overflow-hidden border border-zinc-800">
              <img
                src={image.preview}
                alt={image.name}
                className="w-full h-20 object-cover"
              />
              
              {/* 删除按钮 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(image.id);
                }}
                disabled={disabled}
                className="absolute top-1 right-1 w-6 h-6 bg-red-600 hover:bg-red-700 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
              
              {/* 文件信息 */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1">
                <p className="text-xs text-white truncate">{image.name}</p>
                <p className="text-xs text-zinc-300">{formatFileSize(image.size)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};