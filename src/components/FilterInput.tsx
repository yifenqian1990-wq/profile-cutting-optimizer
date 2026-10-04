import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";

interface FilterInputProps extends React.ComponentProps<typeof Input> {
  value: string;
  onFilter: (value: string) => void;
  onComplete?: () => void;
}

export function FilterInput({ value, onFilter, onComplete, className, ...props }: FilterInputProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync local value when the external value changes (e.g. from a clear action)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleApply = () => {
    onFilter(localValue);
    onComplete?.();
  };

  const handleCancel = () => {
    setLocalValue('');
    onFilter('');
    onComplete?.();
  };

  return (
    <div className="flex items-center gap-1 w-full">
      <div className="relative flex-1">
        <Input
          {...props}
          className={className}
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleApply();
            }
            props.onKeyDown?.(e);
          }}
        />
      </div>
      <button
        type="button"
        onClick={handleApply}
        title="执行筛选"
        className="flex items-center justify-center h-8 w-8 rounded border border-green-200/50 bg-green-50/50 hover:bg-green-100 hover:border-green-300 text-green-600 transition-colors shrink-0 cursor-pointer"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleCancel}
        title="取消筛选"
        className="flex items-center justify-center h-8 w-8 rounded border border-red-200/50 bg-red-50/50 hover:bg-red-100 hover:border-red-300 text-red-500 transition-colors shrink-0 cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
