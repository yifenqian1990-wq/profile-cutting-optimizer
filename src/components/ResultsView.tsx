
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OptimizationSummary, ModelColorSummary, CuttingPattern, Settings, DemandItem, StockItem, ProfileSalesItem, OrderColumn, PurchaseItem } from "../lib/optimizer";
import { Info, Printer, Share2, BarChart3, Edit3, AlertTriangle, ChevronDown, ChevronUp, Download, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ResultsViewProps {
  summary: OptimizationSummary | null;
  settings: Settings;
  setSettings?: React.Dispatch<React.SetStateAction<Settings>>;
  isOptimizing: boolean;
  progress: number;
  salesData?: ProfileSalesItem[];
  columns?: OrderColumn[];
  planName?: string;
  hideReportConfigButton?: boolean;
  purchases?: PurchaseItem[];
  isActive?: boolean;
}

export function ResultsView({ summary, settings, setSettings, isOptimizing, progress, salesData, columns, planName, hideReportConfigButton, purchases = [], isActive = true }: ResultsViewProps) {
  const [showUnfulfilled, setShowUnfulfilled] = useState(false);
  const [editPrintInfoVisible, setEditPrintInfoVisible] = useState(false);
  const [localPrintInfo, setLocalPrintInfo] = useState({ orderNo: settings.printInfo?.orderNo || '' });

  // 用料统计部分的数据列表宽度状态
  const [colWidths, setColWidths] = useState(() => {
    try {
      const saved = localStorage.getItem('optimizer_results_col_widths_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            model: parsed.model ?? 110,
            length: parsed.length ?? 136,
            quantity: parsed.quantity ?? 72,
            color: parsed.color ?? 140,
            efficiency: parsed.efficiency ?? 124,
          };
        }
      }
    } catch (e) {
      console.error('Error loading colWidths from localStorage:', e);
    }
    return {
      model: 110,
      length: 136,
      quantity: 72,
      color: 140,
      efficiency: 124,
    };
  });

  // 保存宽度状态到本地存储
  React.useEffect(() => {
    try {
      localStorage.setItem('optimizer_results_col_widths_v1', JSON.stringify(colWidths));
    } catch (e) {
      console.error('Error saving colWidths to localStorage:', e);
    }
  }, [colWidths]);

  const startResize = (e: React.MouseEvent, column: keyof typeof colWidths) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = colWidths[column];
    
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      setColWidths(prev => ({
        ...prev,
        [column]: Math.max(50, startWidth + deltaX) // 最小宽度50px
      }));
    };

    const handleMouseUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleResetColWidths = () => {
    const defaultWidths = {
      model: 110,
      length: 136,
      quantity: 72,
      color: 140,
      efficiency: 124,
    };
    setColWidths(defaultWidths);
    try {
      localStorage.setItem('optimizer_results_col_widths_v1', JSON.stringify(defaultWidths));
      toast.success("已恢复默认列宽");
    } catch (e) {
      console.error('Error saving colWidths to localStorage:', e);
    }
  };

  // Sync when settings change fundamentally
  React.useEffect(() => {
    setLocalPrintInfo({ orderNo: settings.printInfo?.orderNo || '' });
  }, [settings.printInfo?.orderNo]);

  // Restore scroll position
  React.useEffect(() => {
    // Only try to restore if we're not actively optimizing and the tab is active
    if (!isOptimizing && summary && isActive) {
      const savedPos = sessionStorage.getItem(`resultsScrollY_${planName || 'current'}`);
      if (savedPos) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            window.scrollTo({ top: parseInt(savedPos, 10), behavior: 'instant' as any });
          }, 0);
        });
      }
    }
  }, [isActive, isOptimizing, summary, planName]);

  React.useEffect(() => {
    const handleScroll = () => {
      // Only track scroll if the tab is currently active
      if (!isOptimizing && summary && isActive) {
        sessionStorage.setItem(`resultsScrollY_${planName || 'current'}`, window.scrollY.toString());
      }
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOptimizing, summary, planName, isActive]);


  const printInfoObj = { ...settings.printInfo, orderNo: localPrintInfo.orderNo };

  const handleExportCSV = () => {
    if (!summary) return;
    
    // BOM for UTF-8 Excel compatibility
    const BOM = "\uFEFF";
    const csvLines: string[] = [];
    
    // ===== 1. 用料统计 =====
    csvLines.push("--- 用料统计 ---");
    const summaryHeaders = ["序号", "型材名称", "型号", "采购单号", "长度(mm)", "数量", "单位", "颜色"];
    csvLines.push(summaryHeaders.join(','));
    
    let summaryIndex = 1;
    summary.summaries.forEach((s) => {
      const matchPurchase = purchases.find(p => p.model === s.model && p.color === s.color) || purchases.find(p => p.model === s.model);
      const profileName = matchPurchase?.profileName || "";
      const lengthMm = Math.round(parseFloat(String(s.originalLength).replace(/[^\d.-]/g, '')) * 1000);
      
      let purchaseOrderNo = "";
      if (s.isFixed || String(s.originalLength).includes('定尺') || String(s.originalLength).includes('(定)')) {
        purchaseOrderNo = "定尺料";
      } else {
        // Check pattern order numbers first
        const patternOrders = Array.from(new Set(
          (s.patterns || [])
            .map(p => p.orderNumber)
            .filter((ord): ord is string => Boolean(ord && ord.trim()))
        ));
        
        if (patternOrders.length > 0) {
          purchaseOrderNo = patternOrders.join('; ');
        } else {
          // Check originalLength string for parenthesized info
          const origStr = String(s.originalLength);
          const firstParen = origStr.indexOf('(');
          const lastParen = origStr.lastIndexOf(')');
          if (firstParen !== -1 && lastParen > firstParen) {
            const inside = origStr.substring(firstParen + 1, lastParen).trim();
            if (inside === '定尺' || inside === '定') {
              purchaseOrderNo = "定尺料";
            } else if (inside === '料头利用' || inside.startsWith('料头')) {
              purchaseOrderNo = inside;
            } else if (inside === '库存' || inside === '库') {
              const matchWithLength = purchases.find(p => p.model === s.model && p.color === s.color && p.length === lengthMm)
                || purchases.find(p => p.model === s.model && p.length === lengthMm);
              if (matchWithLength?.orderNumber) {
                purchaseOrderNo = matchWithLength.orderNumber;
              } else {
                purchaseOrderNo = "库存料";
              }
            } else if (!inside.startsWith('使用 ') && !inside.startsWith('型号') && !inside.startsWith('颜色')) {
              purchaseOrderNo = inside;
            }
          }
          
          if (!purchaseOrderNo) {
            const matchWithLength = purchases.find(p => p.model === s.model && p.color === s.color && p.length === lengthMm)
              || purchases.find(p => p.model === s.model && p.length === lengthMm);
            if (matchWithLength?.orderNumber) {
              purchaseOrderNo = matchWithLength.orderNumber;
            } else {
              purchaseOrderNo = s.isFixed ? "定尺料" : "料头利用";
            }
          }
        }
      }

      csvLines.push([
        String(summaryIndex++),
        profileName,
        s.model,
        purchaseOrderNo,
        String(lengthMm),
        String(s.totalQuantity),
        "支",
        s.color
      ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });
    
    csvLines.push("");
    csvLines.push("");
    
    // ===== 2. 下料清单 =====
    csvLines.push("--- 下料清单 ---");
    const patternHeaders = ["序号", "型材名称", "型号", "颜色", "原料规格", "下料数量", "下料方式", "利用率(%)", "总废料(mm)", "备注"];
    csvLines.push(patternHeaders.join(','));
    
    let patternIndex = 1;
    summary.summaries.forEach((s) => {
      const matchPurchase = purchases.find(p => p.model === s.model && p.color === s.color) || purchases.find(p => p.model === s.model);
      const profileName = matchPurchase?.profileName || "";
      s.patterns.forEach((p) => {
        const cutsStr = p.cuts.map(c => `${c.length}x${c.count}`).join(', ');
        let remarksStr = p.cuts.map(c => c.remarks).filter(Boolean).join('; ');

        const pLengthMm = Math.round(parseFloat(String(p.originalLength).replace(/[^\d.-]/g, '')));

        csvLines.push([
          String(patternIndex++),
          profileName,
          s.model,
          s.color,
          String(pLengthMm),
          String(p.count),
          cutsStr,
          p.efficiency.toFixed(2) + '%',
          p.waste.toFixed(2),
          remarksStr
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
      });
    });

    // ===== 3. 未完成下料清单 (库存不足) =====
    if (summary.unfulfilled && summary.unfulfilled.length > 0) {
      csvLines.push("");
      csvLines.push("");
      csvLines.push("--- 未完成下料清单 (库存不足) ---");
      csvLines.push(["型材名称", "型号", "颜色", "未完成长度(mm)", "未完成数量(支)"].join(','));
      summary.unfulfilled.forEach(u => {
        const matchPurchase = purchases.find(p => p.model === u.model && p.color === u.color) || purchases.find(p => p.model === u.model);
        const profileName = matchPurchase?.profileName || "";
        csvLines.push([
          profileName,
          u.model,
          u.color,
          String(u.length),
          String(u.quantity)
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
      });
    }
    
    const csvContent = csvLines.join('\n');
    
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `下料方案_${planName || '默认'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isOptimizing) {
    return (
      <Card className="border-black/10 shadow-none bg-white">
        <CardContent className="flex flex-col items-center justify-center h-[400px] space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <BarChart3 className="h-12 w-12 text-orange-600 animate-pulse" />
            <h3 className="text-lg font-bold">正在进行深度优化计算...</h3>
            <p className="text-sm text-black/40">正在搜索最佳组合，请稍候</p>
          </div>
          <div className="w-full max-w-md space-y-2">
            <Progress value={progress} className="h-2" />
            <div className="flex justify-between text-[10px] text-black/40 font-mono">
              <span>进度: {progress}%</span>
              <span>已找到次优解，正在尝试改进...</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card className="border-dashed border-black/10 bg-transparent">
        <CardContent className="flex flex-col items-center justify-center h-[400px] text-black/40">
          <Info className="h-12 w-12 mb-4 opacity-20" />
          <p>点击上方“开始优化”按钮生成计算结果</p>
        </CardContent>
      </Card>
    );
  }

  // Pre-calculate material groups and their chunks for pagination
  const CHUNK_SIZE = 25; // Safely fits standard detail page height
  const SUMMARY_CHUNK_SIZE = 36; // Balanced for 2-line text items to prevent overflow

  const fixedSummaries = summary.summaries.filter(s => s.isFixed);
  const stockSummaries = summary.summaries.filter(s => !s.isFixed);
  
  type SummaryRow = { isHeader: boolean, type: 'fixed'|'stock', s?: any, index?: number, totalCount?: number };
  const summaryRows: SummaryRow[] = [];
  
  if (fixedSummaries.length > 0) {
    summaryRows.push({ isHeader: true, type: 'fixed', totalCount: fixedSummaries.reduce((sum, s) => sum + s.totalQuantity, 0) });
    fixedSummaries.forEach((s, i) => summaryRows.push({ isHeader: false, type: 'fixed', s, index: i }));
  }
  
  if (stockSummaries.length > 0) {
    summaryRows.push({ isHeader: true, type: 'stock', totalCount: stockSummaries.reduce((sum, s) => sum + s.totalQuantity, 0) });
    stockSummaries.forEach((s, i) => summaryRows.push({ isHeader: false, type: 'stock', s, index: i }));
  }
  
  const summaryPages: SummaryRow[][] = [];
  const MAX_UNITS_PER_PAGE = 24; // Limit max printing lines per page to 24 to prevent overflow with headers
  let currentChunk: SummaryRow[] = [];
  let currentUnits = 0;

  for (const row of summaryRows) {
    let units = 1;
    if (row.isHeader) {
      units = 2.5; // Headers take up more vertical space (margin top/bottom)
    } else if (row.s) {
      const modelLen = row.s.model ? String(row.s.model).length : 0;
      
      const linesForModel = Math.ceil(modelLen / 13);
      
      const maxLines = Math.max(1, linesForModel);
      units = 1 + (maxLines - 1) * 0.8;
    }

    if (currentUnits + units > MAX_UNITS_PER_PAGE && currentChunk.length > 0) {
      summaryPages.push(currentChunk);
      currentChunk = [row];
      currentUnits = units;
    } else {
      currentChunk.push(row);
      currentUnits += units;
    }
  }
  if (currentChunk.length > 0) {
    summaryPages.push(currentChunk);
  }
  if (summaryPages.length === 0) summaryPages.push([]); // Ensure at least 1 summary page

  
  const pagedMaterialGroups: Array<{
    model: string;
    color: string;
    demandSummary: string;
    patterns: any[];
    isFirstChunk: boolean;
    isLastOfGroup: boolean; // Flag for printing overall summary
    groupSummary: {
       details: string;
       totalQuantity: number;
       efficiency: number;
       individualLines: Array<{
         originalLength: string;
         count: number;
         efficiency: number;
       }>;
    };
    startIndex: number;
    unfulfilledWarning?: string;
  }> = [];

  const materialGroups = new Map<string, ModelColorSummary[]>();
  summary.summaries.forEach(s => {
    const mKey = `${s.model}|${s.color}`;
    const existing = materialGroups.get(mKey) || [];
    existing.push(s);
    materialGroups.set(mKey, existing);
  });

  Array.from(materialGroups.entries()).forEach(([mKey, sList]) => {
    const [model, color] = mKey.split('|');
    const allPatterns = sList.flatMap(s => s.patterns);
    const demandSummary = sList[0].demandSummary;
    
    // Aggregated stats for the whole model|color group
    let totalOriginalLen = 0;
    let totalCutLen = 0;
    let totalQty = 0;
    const usageParts: string[] = [];

    sList.forEach(s => {
      const lenVal = parseFloat(String(s.originalLength));
      const subTotalOriginal = s.totalQuantity * lenVal;
      totalOriginalLen += subTotalOriginal;
      totalCutLen += (s.efficiency / 100) * subTotalOriginal;
      totalQty += s.totalQuantity;
      
      const label = String(s.originalLength).replace(' (定尺)', '(定)').replace(' (库存)', '(库)');
      usageParts.push(`${label}x${s.totalQuantity}支`);
    });

    const groupSummary = {
      model,
      details: usageParts.join(' ; '),
      totalQuantity: totalQty,
      efficiency: (totalCutLen / totalOriginalLen) * 100,
      individualLines: sList.map(s => ({
        model: s.model,
        originalLength: String(s.originalLength),
        count: s.totalQuantity,
        efficiency: s.efficiency
      }))
    };

    // Check for items that were too long to be cut for THIS specific material
    const failedForThis = summary.unfulfilled.filter(u => u.model === model && u.color === color);
    const warning = failedForThis.length > 0 
      ? `！！！警告：有 ${failedForThis.length} 类零件因太长无法排料 (最大需求:${Math.max(...failedForThis.map(f => f.length))}mm)`
      : undefined;

    // Split patterns into chunks
    let remainingPatterns = [...allPatterns];
    let startIndex = 0;
    while(remainingPatterns.length > 0 || startIndex === 0) { // Keep at least one chunk even if empty
      const isFirstChunk = startIndex === 0;
      let currentChunkSize = CHUNK_SIZE;
      
      if (isFirstChunk) {
         const demandItems = demandSummary.split(';').filter(x => x.trim()).length;
         const demandRows = Math.ceil(demandItems / 4);
         currentChunkSize = Math.max(3, CHUNK_SIZE - Math.ceil(demandRows * 1.5));
      }

      const chunk = remainingPatterns.slice(0, currentChunkSize);
      remainingPatterns = remainingPatterns.slice(currentChunkSize);
      const isLast = remainingPatterns.length === 0;
      
      pagedMaterialGroups.push({
        model,
        color,
        demandSummary,
        patterns: chunk,
        isFirstChunk,
        isLastOfGroup: isLast,
        groupSummary,
        startIndex,
        unfulfilledWarning: warning
      });
      startIndex += chunk.length;
      if (remainingPatterns.length === 0) break;
    }
  });

  const totalPages = summaryPages.length + pagedMaterialGroups.length + (summary.unfulfilled.length > 0 ? 1 : 0);

  // Helper to render the common boxed frame for each page
  const PageFrame = ({ children, pageNum }: { children: React.ReactNode, pageNum: number }) => (
    <div className="a4-page">
      <div className="a4-inner-frame">
        {/* Header Table */}
        <table className="print-header-table border-collapse w-full">
          <tbody>
            <tr>
              <td className="w-[70%] font-bold">项目名称：{printInfoObj.project}</td>
              <td className="w-[30%] font-bold">张数：{totalPages}</td>
            </tr>
            <tr>
              <td className="font-bold">单号：{planName || printInfoObj.orderNo}</td>
              <td className="font-bold">张号：{pageNum}</td>
            </tr>
          </tbody>
        </table>

        {/* Content Area */}
        <div className="flex-1 p-5 relative flex flex-col overflow-hidden">
          {children}
        </div>

        {/* Footer Table */}
        <table className="print-footer-table border-collapse w-full">
          <tbody>
            <tr>
              <td className="w-1/5 text-xs">设计：{printInfoObj.designer}</td>
              <td className="w-1/5 text-xs">校对：{printInfoObj.reviewer}</td>
              <td className="w-1/5 text-xs">标审：{printInfoObj.checker}</td>
              <td className="w-1/5 text-xs">审核：{printInfoObj.auditor}</td>
              <td className="w-1/5 text-xs">工艺：{printInfoObj.craftsman}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDemandGrid = (summary: string) => {
    // summary is like "1509x24 ; 1381x64 ; ..."
    const parts = summary.split(';').map(p => p.trim()).filter(Boolean);
    return (
      <div className="grid grid-cols-4 gap-x-4 gap-y-1 text-[11px] font-mono">
        {parts.map((p, idx) => (
          <div key={idx} className="flex gap-3 border-b border-black/5">
            <span className="w-10 text-right">{p.split('x')[0]}</span>
            <span className="font-bold">x{p.split('x')[1]}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className="a4-container-bg no-print:pb-20" 
      style={{ "--total-pages": `"${totalPages}"` } as any}
    >
      <div className="max-w-4xl mx-auto mb-6 px-4 no-print flex justify-end items-center gap-3">
        {summary.unfulfilled.length > 0 && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 font-bold gap-2"
            onClick={() => setShowUnfulfilled(!showUnfulfilled)}
          >
            <AlertTriangle className="h-4 w-4" />
            未完成清单 ({summary.unfulfilled.length})
            {showUnfulfilled ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        )}
        {!hideReportConfigButton && (
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-black/10 hover:bg-black/5 shrink-0 px-4 h-9" 
          onClick={() => setEditPrintInfoVisible(true)}
        >
          <Edit3 className="h-4 w-4" />
          修改报表参数
        </Button>
        )}
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-black/10 hover:bg-black/5 shrink-0 px-4 h-9 text-slate-700" 
          onClick={handleResetColWidths}
        >
          <RotateCcw className="h-4 w-4" />
          恢复默认列宽
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50/50 hover:text-blue-800 shrink-0 px-4 h-9" 
          onClick={handleExportCSV}
        >
          <Download className="h-4 w-4" />
          导出CSV方案
        </Button>
        <Button variant="outline" size="sm" className="gap-2 bg-orange-600 text-white hover:bg-orange-700 border-none px-6 h-9 shrink-0 shadow-lg shadow-orange-600/20" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          直接打印报表
        </Button>
      </div>

      {showUnfulfilled && summary.unfulfilled.length > 0 && (
        <div className="max-w-4xl mx-auto mb-6 px-4 no-print animate-in slide-in-from-top-2 duration-200">
          <Card className="border-red-200 bg-red-50/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm font-bold text-red-700">缺失零件详情 (由于原材料长度不足或库存耗尽)</CardTitle>
            </CardHeader>
            <CardContent className="py-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {summary.unfulfilled.map((u, i) => (
                  <div key={i} className="text-[11px] flex justify-between bg-white/50 p-1.5 rounded border border-red-100">
                    <span className="font-medium text-black/70">{u.model}</span>
                    <span className="font-bold text-red-600">{u.length}mm x {u.quantity}支</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- PAGE(S) 1 to N: Summary --- */}
      <div className="print-pages">
      {summaryPages.map((pageRows, pageIdx) => (
        <PageFrame key={`summary-page-${pageIdx}`} pageNum={pageIdx + 1}>
          <div className="text-center mb-4 relative">
            <h2 className="text-lg font-bold underline underline-offset-4 tracking-widest uppercase">
              ***** 用料统计 ***** {pageIdx > 0 && <span className="text-xs text-black/50 ml-2">(续)</span>}
            </h2>
            {pageIdx === 0 && (
              <button
                onClick={handleResetColWidths}
                className="absolute right-0 top-1/2 -translate-y-1/2 no-print text-[11px] text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1.5 cursor-pointer bg-orange-50 hover:bg-orange-100 border border-orange-200/50 px-2.5 py-1 rounded transition-all shadow-sm"
                title="一键恢复所有列的默认宽度"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>恢复默认列宽</span>
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-1 overflow-hidden">
            {/* 拖拽式表头 */}
            <div className="flex items-center gap-x-1 sm:gap-x-2 text-[10px] font-bold text-black/60 py-2 border-b-2 border-black/15 uppercase tracking-wider mb-2 select-none">
              <span className="w-6 shrink-0 text-black/30">#</span>
              <div 
                style={{ width: `${colWidths.model}px` }} 
                className="shrink-0 relative flex items-center pr-2 group/resizer"
              >
                <span className="truncate">型材型号</span>
                <div 
                  className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-orange-500/50 bg-transparent active:bg-orange-600 transition-colors z-20 no-print"
                  onMouseDown={(e) => startResize(e, 'model')}
                  title="拖拽调节宽度"
                />
              </div>
              <div 
                style={{ width: `${colWidths.length}px` }} 
                className="shrink-0 relative flex items-center pr-2 group/resizer"
              >
                <span className="truncate">用料规格(采购单号)</span>
                <div 
                  className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-orange-500/50 bg-transparent active:bg-orange-600 transition-colors z-20 no-print"
                  onMouseDown={(e) => startResize(e, 'length')}
                  title="拖拽调节宽度"
                />
              </div>
              <div 
                style={{ width: `${colWidths.quantity}px` }} 
                className="shrink-0 relative flex items-center pr-2 group/resizer"
              >
                <span className="truncate">用料数量</span>
                <div 
                  className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-orange-500/50 bg-transparent active:bg-orange-600 transition-colors z-20 no-print"
                  onMouseDown={(e) => startResize(e, 'quantity')}
                  title="拖拽调节宽度"
                />
              </div>
              <div 
                style={{ width: `${colWidths.color}px` }} 
                className="shrink-0 relative flex items-center pr-2 group/resizer"
              >
                <span className="truncate">型材颜色</span>
                <div 
                  className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-orange-500/50 bg-transparent active:bg-orange-600 transition-colors z-20 no-print"
                  onMouseDown={(e) => startResize(e, 'color')}
                  title="拖拽调节宽度"
                />
              </div>
              <div 
                style={{ width: `${colWidths.efficiency}px` }} 
                className="shrink-0 relative flex items-center justify-start group/resizer"
              >
                <span className="truncate">切割利用率</span>
                <div 
                  className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-col-resize hover:bg-orange-500/50 bg-transparent active:bg-orange-600 transition-colors z-20 no-print"
                  onMouseDown={(e) => startResize(e, 'efficiency')}
                  title="拖拽调节宽度"
                />
              </div>
            </div>

            {pageRows.map((row, rowIdx) => {
              if (row.isHeader && row.type === 'fixed') {
                return (
                  <div key={`hr-fixed-${pageIdx}-${rowIdx}`} className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                    <h3 className="text-xs font-black bg-black text-white px-2 py-0.5">定尺规格用料</h3>
                    <span className="text-[10px] text-black/40 font-mono italic">(总计: {row.totalCount} 支)</span>
                  </div>
                );
              }
              
              if (row.isHeader && row.type === 'stock') {
                return (
                  <div key={`hr-stock-${pageIdx}-${rowIdx}`} className="flex items-center gap-2 mb-2 mt-4 first:mt-0">
                    <h3 className="text-xs font-black bg-black text-white px-2 py-0.5">库存余料用料</h3>
                    <span className="text-[10px] text-black/40 font-mono italic">(总计: {row.totalCount} 支)</span>
                  </div>
                );
              }

              const { s, index } = row;
              
              let isModelRed = false;
              let isColorRed = false;
              let isLengthRed = false;
              let isMatched = true;
              
              let mismatchReason = "";
              
              if (salesData && columns && planName) {
                const col = columns.find(c => c.name === planName);
                if (col) {
                   const hasExact = salesData.some(item => {
                     const amountInOrder = col ? (item.orders?.[col.id] || 0) : 0;
                     if (amountInOrder <= 0) return false;

                     if (String(item.model).trim() !== String(s.model).trim() || item.color !== s.color) {
                       return false;
                     }

                     const sLenStr = String(s.originalLength);
                     let sLen = parseFloat(sLenStr);
                     if (sLen < 100) sLen = Math.floor(sLen * 100) / 100;
                     else sLen = Math.floor(sLen / 10) * 10;
                     const normalizedSLen = sLen < 100 ? sLen * 1000 : sLen;

                     if (item.length === sLen || item.length === normalizedSLen) {
                       return true;
                     }

                     return s.patterns && s.patterns.some(p => {
                       let rawLength = parseFloat(String(p.originalLength));
                       if (rawLength < 100) rawLength = Math.floor(rawLength * 100) / 100;
                       else rawLength = Math.floor(rawLength / 10) * 10;
                       const normalizedRawLength = rawLength < 100 ? rawLength * 1000 : rawLength;

                       return item.length === rawLength || item.length === normalizedRawLength;
                     });
                   });
                   
                   if (!hasExact) {
                      isMatched = false;
                      isModelRed = true; // Move all red highlights to model
                      mismatchReason = "⚠️ 该型材未成功匹配销料";
                   }
                }
              }

              return (
                <div key={`row-${row.type}-${index}-${pageIdx}`} className="flex items-center gap-x-1 sm:gap-x-2 text-[11px] py-1 border-b border-black/5 leading-tight group relative">
                  <span className="w-6 shrink-0 text-black/40">{index! + 1})</span>
                  <span 
                    style={{ width: `${colWidths.model}px` }}
                    className={cn(
                      "font-bold hover:underline cursor-pointer transition-all shrink-0 whitespace-nowrap overflow-hidden text-ellipsis",
                      isModelRed ? "text-red-600 hover:text-red-800" : "text-blue-600 hover:text-blue-800"
                    )}
                    title={`点击跳转到详情 (或 Ctrl + 点击)${mismatchReason ? '\n' + mismatchReason : ''}`}
                    onClick={(e) => {
                      const id = `detail-${s.model}-${s.color}`.replace(/\s+/g, '-');
                      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    型材：{s.model ? String(s.model).trim() || '未填写' : '未填写'}
                  </span>
                  <span style={{ width: `${colWidths.length}px` }} className="shrink-0 whitespace-nowrap overflow-hidden text-ellipsis text-left">规格：{s.originalLength}</span>
                  <span style={{ width: `${colWidths.quantity}px` }} className="shrink-0 whitespace-nowrap overflow-hidden text-ellipsis text-left">数量：{s.totalQuantity}</span>
                  <span style={{ width: `${colWidths.color}px` }} className="shrink-0 min-w-0 pr-1 text-left font-bold whitespace-nowrap overflow-hidden text-ellipsis" title={s.color}>颜色：{s.color}</span>
                  <div style={{ width: `${colWidths.efficiency}px` }} className="shrink-0 text-left flex items-center justify-start gap-1 font-mono">
                    <span>利用率:</span>
                    <span className="font-bold">({s.efficiency.toFixed(2)}%)</span>
                  </div>

                  {/* 悬浮复制规格与数量 */}
                  <button 
                    id={`copy-row-btn-${row.type}-${index}-${pageIdx}`}
                    title="复制该行的规格和数量（可直接粘贴到Excel中）"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rawNum = parseFloat(String(s.originalLength).replace(/[^\d.-]/g, ''));
                      const formattedLen = isNaN(rawNum) ? s.originalLength : Math.round(rawNum * 1000);
                      const qtyVal = s.totalQuantity;
                      const textToCopy = `${formattedLen}\t${qtyVal}`;
                      navigator.clipboard.writeText(textToCopy).then(() => {
                         toast.success(`复制成功：[${formattedLen}] 和数量 [${qtyVal}] 已写入剪贴板，可直接在 Excel 中粘贴`);
                      }).catch((err) => {
                         console.error('Failed to copy', err);
                         toast.error('复制失败，请重试');
                      });
                    }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-slate-50 text-blue-600 border border-black/10 px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[9px] no-print"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    <span>复制</span>
                  </button>
                </div>
              );
            })}
          </div>
          
          <div className="mt-auto pt-4 border-t border-transparent text-right text-[11px] italic">
             &nbsp;
          </div>
        </PageFrame>
      ))}

      {/* --- PAGE(S) Detail : Material Details (Chunked) --- */}
      {pagedMaterialGroups.map((group, gIdx) => (
        <PageFrame key={gIdx} pageNum={summaryPages.length + gIdx + 1}>
          <div 
            id={group.isFirstChunk ? `detail-${group.model}-${group.color}`.replace(/\s+/g, '-') : undefined}
            className="text-center space-y-1 mb-6 scroll-mt-10"
          >
            <h2 className="text-lg font-bold tracking-widest underline underline-offset-4">***** 下料清单 *****</h2>
            <p className="text-[10px] font-bold text-black/60">
              材料型号：{group.model} &nbsp;&nbsp; 颜色：{group.color} &nbsp; | &nbsp; 刀具:{settings.kerf}mm 修边:{settings.trim}mm
            </p>
            {!group.isFirstChunk && <p className="text-[9px] text-black/40 text-center">(续前页)</p>}
          </div>

          <div className="flex-1 flex flex-col gap-6">
            {group.isFirstChunk && (
              <div className="space-y-2">
                <div className="pl-4 text-[12px] font-bold bg-black/5 py-3 border-l-4 border-black">
                  {renderDemandGrid(group.demandSummary)}
                </div>
                {group.unfulfilledWarning && (
                  <div className="mx-4 p-2 bg-red-50 border-2 border-red-500 text-red-700 text-xs font-black animate-pulse rounded">
                    {group.unfulfilledWarning}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1 pl-2">
              {group.patterns.map((pattern, pIdx) => (
                <div key={pIdx} className="flex items-center gap-x-2 print-row-item text-[12px] py-1 border-b border-black/5 last:border-0 leading-tight">
                  <span className="w-10 text-black/40">{group.startIndex + pIdx + 1})</span>
                  <span className="w-12 text-right font-medium">{pattern.count} 支</span>
                  <span className="w-16">{( (pattern.originalLength || 0) / 1000).toFixed(2)} 米</span>
                  <span className="font-bold font-mono tracking-tight flex-1 text-xs">
                    ::{ (pattern.cuts || []).length > 0 
                        ? (pattern.cuts || []).map((c: any) => `${c.length}x${c.count}`).join(' ; ')
                        : '无切割项' 
                    }
                  </span>
                  <span className="ml-auto text-[10px] text-black/50 pr-2">料头:{Math.round(pattern.waste || 0)}</span>
                </div>
              ))}
            </div>

            {group.isLastOfGroup && (
               <div className="mt-8 pt-4 border-t-2 border-black/10 text-[12px] font-bold text-left space-y-1">
                 {group.groupSummary.individualLines.map((line: any, idx: number) => (
                   <div key={idx} className="flex items-center gap-x-1 sm:gap-x-2 text-[12px] py-1">
                     <span className="w-32 shrink-0 whitespace-nowrap overflow-hidden text-ellipsis">型材：<span className="text-black font-black">{line.model || group.model}</span></span>
                     <span className="w-36 shrink-0 whitespace-nowrap overflow-hidden text-ellipsis text-left">规格：{line.originalLength}</span>
                     <span className="w-[72px] shrink-0 whitespace-nowrap overflow-hidden text-ellipsis text-left">数量：{line.count}</span>
                     <span className="flex-1 min-w-0 text-left font-bold whitespace-nowrap" title={group.color}>颜色：{group.color}</span>
                     <span className="w-28 shrink-0 text-right font-medium text-black/60 whitespace-nowrap">利用率：({line.efficiency.toFixed(2)}%)</span>
                   </div>
                 ))}
               </div>
            )}
          </div>
        </PageFrame>
      ))}
      {summary.unfulfilled.length > 0 && (
        <PageFrame pageNum={totalPages}>
          <div className="p-6 border-2 border-red-500 border-dashed rounded bg-red-50/50 flex-1">
            <h3 className="font-black text-red-700 mb-4 underline decoration-red-700/30 underline-offset-4 tracking-widest text-center">***** 未完成下料清单 (库存不足) *****</h3>
            <div className="space-y-1 font-mono text-xs text-black/80">
              {summary.unfulfilled.map((u, i) => (
                <div key={i} className="flex justify-between items-center border-b border-red-100 pb-0.5">
                  <span className="font-bold">{u.model} | {u.color}</span>
                  <span className="text-red-600 font-bold">{u.length}mm x {u.quantity}支</span>
                </div>
              ))}
            </div>
          </div>
        </PageFrame>
      )}
      </div>

      <Dialog open={editPrintInfoVisible} onOpenChange={setEditPrintInfoVisible}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>修改报表打印参数</DialogTitle>
            <p className="text-sm text-black/60">只有单号可以修改，其余参数来自工程设置</p>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>项目名称</Label>
              <Input 
                value={settings.printInfo?.project || ''} 
                disabled
                placeholder="项目名称" 
              />
            </div>
            <div className="space-y-2">
              <Label>单号</Label>
              <Input 
                value={localPrintInfo.orderNo || ''} 
                onChange={e => setLocalPrintInfo({ ...localPrintInfo, orderNo: e.target.value })}
                placeholder="单号" 
              />
            </div>
            <div className="col-span-2 border-t border-black/5 my-2"></div>
            <div className="space-y-2">
              <Label>设计</Label>
              <Input 
                value={settings.printInfo?.designer || ''} 
                disabled
                placeholder="签名" 
              />
            </div>
            <div className="space-y-2">
              <Label>校对</Label>
              <Input 
                value={settings.printInfo?.reviewer || ''} 
                disabled
                placeholder="签名" 
              />
            </div>
            <div className="space-y-2">
              <Label>标审</Label>
              <Input 
                value={settings.printInfo?.checker || ''} 
                disabled
                placeholder="签名" 
              />
            </div>
            <div className="space-y-2">
              <Label>审核</Label>
              <Input 
                value={settings.printInfo?.auditor || ''} 
                disabled
                placeholder="签名" 
              />
            </div>
            <div className="space-y-2">
              <Label>工艺</Label>
              <Input 
                value={settings.printInfo?.craftsman || ''} 
                disabled
                placeholder="签名" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              if (setSettings) {
                setSettings(prev => ({ ...prev, printInfo: { ...prev.printInfo, orderNo: localPrintInfo.orderNo } }));
              }
              setEditPrintInfoVisible(false);
            }} className="bg-orange-600 hover:bg-orange-700 text-white">确定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Global Print Footer removed */}
    </div>
  );
}
