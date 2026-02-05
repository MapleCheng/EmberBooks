import { useState, useRef, type DragEvent, type ChangeEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { importMoze, type ImportStats } from "../api/import.js";

export function ImportPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<ImportStats | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: importMoze,
    onSuccess: (data) => {
      setResult(data);
    },
  });

  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
      alert("請選擇 CSV 檔案");
      return;
    }
    setResult(null);
    mutation.mutate(file);
  };

  const handleClickUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-2">匯入 MOZE CSV</h1>
      <p className="text-gray-600 mb-8">上傳從 MOZE 匯出的 CSV 檔案來匯入記帳記錄</p>

      <div
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center transition-colors
          ${isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50"}
          ${mutation.isPending ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-blue-400 hover:bg-blue-50"}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClickUpload}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleFileChange}
          disabled={mutation.isPending}
        />

        <div className="space-y-4">
          <div className="text-6xl">📁</div>
          <div>
            <p className="text-lg font-medium text-gray-700">
              {mutation.isPending ? "上傳中..." : "拖曳檔案至此或點擊選擇"}
            </p>
            <p className="text-sm text-gray-500 mt-2">支援 CSV 格式</p>
          </div>
        </div>
      </div>

      {mutation.isError && (
        <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-red-800 font-semibold mb-1">匯入失敗</h3>
          <p className="text-red-600 text-sm">
            {mutation.error instanceof Error ? mutation.error.message : "未知錯誤"}
          </p>
        </div>
      )}

      {mutation.isSuccess && result && (
        <div className="mt-6 p-6 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="text-green-800 font-semibold text-lg mb-4">匯入成功！</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-gray-600 text-sm">總記錄數</p>
              <p className="text-2xl font-bold text-gray-800">{result.total}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-gray-600 text-sm">已匯入</p>
              <p className="text-2xl font-bold text-green-600">{result.imported}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-gray-600 text-sm">已跳過</p>
              <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-gray-600 text-sm">建立帳戶</p>
              <p className="text-2xl font-bold text-blue-600">{result.accounts_created}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-gray-600 text-sm">建立分類</p>
              <p className="text-2xl font-bold text-purple-600">{result.categories_created}</p>
            </div>
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-gray-600 text-sm">合併轉帳</p>
              <p className="text-2xl font-bold text-indigo-600">{result.transfers_merged}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
