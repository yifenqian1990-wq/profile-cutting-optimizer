
import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ClipboardPaste, Info, Palette } from "lucide-react";
import { toast } from "sonner";
import { PurchaseItem } from "../lib/optimizer";

interface ImportDialogProps {
  onImport: (data: any[], append: boolean) => void;
  title: string;
  description: string;
  purchases?: PurchaseItem[];
}

export function ImportDialog({ onImport, title, description, purchases }: ImportDialogProps) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [autoMatchColor, setAutoMatchColor] = useState(true);

  const handleImport = (append: boolean) => {
    if (!text.trim()) {
      toast.error("请输入粘贴内容");
      return;
    }

    try {
      // Build model to color mapping from purchases if available
      const modelColorMap = new Map<string, string>();
      if (purchases && purchases.length > 0) {
        purchases.forEach(p => {
          if (p.model && p.color && p.color.trim() !== '') {
            const m = p.model.trim();
            if (!modelColorMap.has(m)) {
              modelColorMap.set(m, p.color.trim());
            }
            if (!modelColorMap.has(m.toLowerCase())) {
              modelColorMap.set(m.toLowerCase(), p.color.trim());
            }
          }
        });
      }

      let autoMatchedCount = 0;
      const rows = text.trim().split('\n');
      const parsedData = rows.map(row => {
        const cols = row.split('\t');
        const model = cols[0]?.trim() || '';
        let color = cols[3]?.trim() || '';

        // If color is missing and autoMatchColor is enabled, match from purchases
        if (autoMatchColor && !color && model) {
          const matchedColor = modelColorMap.get(model) || modelColorMap.get(model.toLowerCase());
          if (matchedColor) {
            color = matchedColor;
            autoMatchedCount++;
          }
        }

        return {
          id: Math.random().toString(36).substr(2, 9),
          model,
          length: parseFloat(cols[1]) >= 0 ? parseFloat(cols[1]) : 0,
          quantity: parseInt(cols[2], 10) >= 0 ? parseInt(cols[2], 10) : 1,
          color,
          remarks: cols[4]?.trim() || '',
        };
      });

      onImport(parsedData, append);
      setText('');
      setOpen(false);
      
      if (autoMatchedCount > 0) {
        toast.success(`成功导入 ${parsedData.length} 条数据（其中 ${autoMatchedCount} 条自动匹配采购单颜色）`);
      } else {
        toast.success(`成功导入 ${parsedData.length} 条数据`);
      }
    } catch (error) {
      toast.error("导入失败，请检查格式是否正确（型号\t长度\t数量\t颜色\t备注）");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2 border-black/10 hover:bg-black/5" onClick={() => setOpen(true)}>
        <ClipboardPaste className="h-4 w-4" />
        粘贴导入
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-700 flex gap-2">
            <Info className="h-4 w-4 shrink-0" />
            <p>请从 Excel 中复制 5 列数据（型号、长度、数量、颜色、备注），然后粘贴到下方文本框中。</p>
          </div>

          <div className="flex items-center justify-between bg-orange-50/70 p-3 rounded-lg border border-orange-200/80">
            <div className="flex items-center space-x-2.5">
              <Switch 
                id="auto-match-color" 
                checked={autoMatchColor} 
                onCheckedChange={setAutoMatchColor} 
              />
              <Label htmlFor="auto-match-color" className="text-xs font-semibold text-neutral-800 cursor-pointer select-none flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-orange-600" />
                从采购单管理自动匹配颜色
              </Label>
            </div>
            <span className="text-[11px] text-neutral-500 font-medium">
              {autoMatchColor ? '默认启用（未填颜色的项自动匹配采购单颜色）' : '已关闭'}
            </span>
          </div>

          <Textarea 
            placeholder="在此粘贴 Excel 数据..." 
            className="flex-1 min-h-[150px] max-h-[40vh] resize-none font-mono text-sm overflow-y-auto"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>
        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleImport(false)} className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">清空并导入</Button>
            <Button onClick={() => handleImport(true)} className="bg-black text-white hover:bg-black/80">追加导入</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
