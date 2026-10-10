
import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { FilterInput } from "./FilterInput";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Trash2, 
  Copy, 
  ArrowUpDown, 
  CheckSquare, 
  Square, 
  X,
  Filter,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  Package,
  FileDown
} from "lucide-react";
import { StockItem, ProfileSalesItem, Settings, PurchaseItem } from "../lib/optimizer";
import { exportToExcel } from "../lib/exportUtils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImportDialog } from "./ImportDialog";
import { cn, useTableState } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface StockTableProps {
  data: StockItem[];
  setData: React.Dispatch<React.SetStateAction<StockItem[]>>;
  salesData?: ProfileSalesItem[]; // Now expects salesData for cross-import
  purchases?: PurchaseItem[];
  settings: Settings;
}

type SortConfig = {
  key: keyof StockItem;
  direction: 'asc' | 'desc';
} | null;

interface StockInputCellProps {
  initialValue: string | number;
  type?: 'text' | 'number';
  className?: string;
  isFloat?: boolean;
  placeholder?: string;
  onCommit: (val: any) => void;
}

const StockInputCell = React.memo(function StockInputCell({
  initialValue,
  type = 'text',
  className,
  isFloat = false,
  placeholder,
  onCommit
}: StockInputCellProps) {
  const [val, setVal] = useState<string>(initialValue === 0 && type === 'number' ? '' : String(initialValue ?? ''));

  React.useEffect(() => {
    setVal(initialValue === 0 && type === 'number' ? '' : String(initialValue ?? ''));
  }, [initialValue, type]);

  const handleBlur = () => {
    let parsed: any = val;
    if (type === 'number') {
      parsed = isFloat ? (parseFloat(val) || 0) : (parseInt(val, 10) || 0);
    }
    if (parsed !== initialValue) {
      onCommit(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      let parsed: any = val;
      if (type === 'number') {
        parsed = isFloat ? (parseFloat(val) || 0) : (parseInt(val, 10) || 0);
      }
      if (parsed !== initialValue) {
        onCommit(parsed);
      }
    }
  };

  return (
    <Input
      type={type}
      value={val}
      placeholder={placeholder}
      onChange={e => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
});

interface StockRowProps {
  item: StockItem;
  idx: number;
  isSelected: boolean;
  columnWidths: Record<string, number>;
  onRowClick: (id: string, e: React.MouseEvent) => void;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onMouseEnter: (id: string) => void;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onUpdateItem: (id: string, field: keyof StockItem, value: any) => void;
  onDeleteItem: (id: string) => void;
}

const StockRow = React.memo(function StockRow({
  item,
  idx,
  isSelected,
  columnWidths,
  onRowClick,
  onMouseDown,
  onMouseEnter,
  onToggleSelect,
  onUpdateItem,
  onDeleteItem,
}: StockRowProps) {
  return (
    <TableRow 
      className={cn(
        "group transition-colors border-b border-black/[0.03] last:border-0",
        isSelected ? "bg-orange-50/60 hover:bg-orange-50" : "hover:bg-black/[0.01]"
      )}
      onClick={(e) => onRowClick(item.id, e)}
      onMouseDown={(e) => onMouseDown(item.id, e)}
      onMouseEnter={() => onMouseEnter(item.id)}
    >
      <TableCell style={{ width: columnWidths.selection }} className="px-3 relative z-10"
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect(item.id, e);
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-center cursor-pointer p-1">
          {isSelected ? <CheckSquare className="h-4 w-4 text-orange-600" /> : <Square className="h-4 w-4 text-black/10 group-hover:text-black/20" />}
        </div>
      </TableCell>
      <TableCell style={{ width: columnWidths.index || 55 }} className="p-1 px-2 text-center text-xs font-mono text-black/50 select-none">
        {idx + 1}
      </TableCell>
      <TableCell style={{ width: columnWidths.model }} className="p-1 px-3">
        <StockInputCell 
          initialValue={item.model} 
          onCommit={(val) => onUpdateItem(item.id, 'model', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.length }} className="p-1 px-3">
        <StockInputCell 
          type="number"
          isFloat={true}
          initialValue={item.length || ''} 
          onCommit={(val) => onUpdateItem(item.id, 'length', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs font-mono"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.quantity }} className="p-1 px-3">
        <StockInputCell 
          type="number" 
          initialValue={item.quantity || ''} 
          onCommit={(val) => onUpdateItem(item.id, 'quantity', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs font-mono"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.color }} className="p-1 px-3">
        <StockInputCell 
          initialValue={item.color} 
          onCommit={(val) => onUpdateItem(item.id, 'color', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.orderNumber || 100 }} className="p-1 px-3">
        <StockInputCell 
          initialValue={item.orderNumber || ''} 
          placeholder="自动导入"
          onCommit={(val) => onUpdateItem(item.id, 'orderNumber', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.remarks }} className="p-1 px-3">
        <StockInputCell 
          initialValue={item.remarks} 
          onCommit={(val) => onUpdateItem(item.id, 'remarks', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.actions }} className="text-right pr-4">
        <Button 
          variant="ghost" size="icon" 
          onClick={(e) => { e.stopPropagation(); onDeleteItem(item.id); }}
          className="h-7 w-7 text-black/10 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" 
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.idx !== nextProps.idx) return false;
  if (prevProps.item !== nextProps.item) {
    if (
      prevProps.item.id !== nextProps.item.id ||
      prevProps.item.model !== nextProps.item.model ||
      prevProps.item.length !== nextProps.item.length ||
      prevProps.item.quantity !== nextProps.item.quantity ||
      prevProps.item.color !== nextProps.item.color ||
      prevProps.item.orderNumber !== nextProps.item.orderNumber ||
      prevProps.item.remarks !== nextProps.item.remarks
    ) {
      return false;
    }
  }
  if (prevProps.columnWidths !== nextProps.columnWidths) {
    for (const key of Object.keys(nextProps.columnWidths)) {
      if (prevProps.columnWidths[key] !== nextProps.columnWidths[key]) return false;
    }
  }
  return true;
});

export const StockTable = React.memo(function StockTable({ data, setData, salesData = [], purchases, settings }: StockTableProps) {
  const [sortConfig, setSortConfig] = useTableState<SortConfig>('stock_sort', null);
  const [filters, setFilters] = useTableState<Partial<Record<keyof StockItem, string>>>('stock_filters', {});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Import Sales
  const [importSalesDialogOpen, setImportSalesDialogOpen] = useState(false);
  const [salesImportMode, setSalesImportMode] = useState<'overwrite' | 'append'>('overwrite');

  const handleSalesImport = () => {
    let itemsToImport: StockItem[] = salesData.map(item => ({
       id: Math.random().toString(36).substring(2, 9),
       model: item.model,
       length: item.length,
       quantity: Math.max(0, item.quantity - Object.values(item.orders || {}).reduce((a: any, b: any) => a + (b || 0), 0)),
       color: item.color,
       remarks: '从销料表导入',
       orderNumber: item.orderNumber
    })).filter(i => i.quantity > 0);
    
    // Always aggregate by orderNumber so that we preserve stock provenance
    const aggregated = new Map<string, StockItem>();
    itemsToImport.forEach(item => {
      const key = `${item.model}|${item.length}|${item.color}|${item.orderNumber || ''}`;
      if (aggregated.has(key)) {
        aggregated.get(key)!.quantity += item.quantity;
      } else {
        aggregated.set(key, { ...item });
      }
    });
    itemsToImport = Array.from(aggregated.values());

    if (salesImportMode === 'overwrite') {
       setData(itemsToImport);
    } else {
       const newData = [...data];
       itemsToImport.forEach(item => {
          const existing = newData.find(d => d.model === item.model && d.length === item.length && d.color === item.color && d.orderNumber === item.orderNumber);
          if (existing) { existing.quantity += item.quantity; }
          else { newData.push(item); }
       });
       setData(newData);
    }
    setImportSalesDialogOpen(false);
    toast.success(`自销料表导入了 ${itemsToImport.length} 条余料纪录为库存`);
  };

  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    selection: 40,
    index: 55,
    model: 240,    
    length: 120,
    quantity: 100,
    color: 120,
    orderNumber: 120,    
    remarks: 150,  
    actions: 60
  });

  const totalCalculatedWidth = useMemo(() => {
    return Object.values(columnWidths).reduce((a, b) => a + b, 0);
  }, [columnWidths]);

  const parentRef = useRef<HTMLDivElement>(null);

  const handleExportExcel = () => {
    if (data.length === 0) {
      toast.error('当前没有原材料可导出');
      return;
    }

    const columns = [
      { header: '型号', getValue: (item: StockItem) => item.model || '' },
      { header: '长度(mm)', getValue: (item: StockItem) => item.length || '' },
      { header: '数量', getValue: (item: StockItem) => item.quantity || 0 },
      { header: '颜色', getValue: (item: StockItem) => item.color || '' },
      { header: '单号源', getValue: (item: StockItem) => item.orderNumber || '' },
      { header: '备注', getValue: (item: StockItem) => item.remarks || '' }
    ];

    exportToExcel({
      filename: `原材料库_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: '原材料库',
      columns,
      data: processedData,
      includeIndex: true,
    });
    toast.success('原材料数据导出成功');
  };

  const resizingRef = useRef<{ key: string, startX: number, startWidth: number } | null>(null);

  const startResizing = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      key,
      startX: e.pageX,
      startWidth: columnWidths[key]
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const delta = e.pageX - startX;
    setColumnWidths(prev => ({
      ...prev,
      [key]: Math.max(50, startWidth + delta)
    }));
  }, []);

  const stopResizing = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  // Sorting
  const handleSort = (key: keyof StockItem, direction: 'asc' | 'desc' | null) => {
    if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ key, direction });
    }
  };

  // Filter & Sort processed data
  const processedData = useMemo(() => {
    let result = [...data];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      result = result.filter(item => 
        String(item[key as keyof StockItem]).toLowerCase().includes(value.toLowerCase())
      );
    });
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const sA = String(aVal);
        const sB = String(bVal);
        if (sA < sB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (sA > sB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, sortConfig, filters]);

  const rowVirtualizer = useVirtualizer({
    count: processedData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 41,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalVirtualSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;

  // Selection handlers
  const handleRowClick = (id: string, event: React.MouseEvent) => {
    const newSelected = new Set(selectedIds);
    if (event.ctrlKey || event.metaKey) {
      if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
      setLastClickedId(id);
    } else if (event.shiftKey && lastClickedId) {
      const idx1 = processedData.findIndex(item => item.id === lastClickedId);
      const idx2 = processedData.findIndex(item => item.id === id);
      const [start, end] = [Math.min(idx1, idx2), Math.max(idx1, idx2)];
      processedData.slice(start, end + 1).forEach(item => newSelected.add(item.id));
    } else {
      newSelected.clear();
      newSelected.add(id);
      setLastClickedId(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedData.length && processedData.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedData.map(item => item.id)));
    }
  };

  const handleMouseDown = (id: string, event: React.MouseEvent) => {
    if (event.button !== 0) return;
    if (event.ctrlKey || event.shiftKey || event.metaKey) return;
    setIsDragging(true);
    setSelectedIds(new Set([id]));
    setLastClickedId(id);
  };

  const handleMouseEnter = (id: string) => {
    if (!isDragging || !lastClickedId) return;
    const newSelected = new Set(selectedIds);
    const idx1 = processedData.findIndex(item => item.id === lastClickedId);
    const idx2 = processedData.findIndex(item => item.id === id);
    const [start, end] = [Math.min(idx1, idx2), Math.max(idx1, idx2)];
    processedData.slice(start, end + 1).forEach(item => newSelected.add(item.id));
    setSelectedIds(newSelected);
  };

  const stopDragging = () => setIsDragging(false);

  // Actions
  const addItem = () => {
    const newItem: StockItem = {
      id: Math.random().toString(36).substr(2, 9),
      model: '', length: 6000, quantity: 1, color: '', remarks: '',
    };
    setData([...data, newItem]);
  };

  const removeSelected = () => {
    setData(data.filter(item => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  };

  const duplicateSelected = () => {
    const toDuplicate = data.filter(item => selectedIds.has(item.id));
    const newItems = toDuplicate.map(item => ({ ...item, id: Math.random().toString(36).substr(2, 9) }));
    setData([...data, ...newItems]);
  };

  const updateItem = useCallback((id: string, field: keyof StockItem, value: any) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }, [setData]);

  const handleToggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setLastClickedId(id);
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setData(prev => prev.filter(i => i.id !== id));
  }, [setData]);

  const handleUpdateItem = useCallback((id: string, field: keyof StockItem, value: any) => {
    updateItem(id, field, value);
  }, [updateItem]);

  const HeaderCell = ({ label, columnKey, widthKey }: { label: string, columnKey: string, widthKey: string }) => {
    const [open, setOpen] = useState(false);
    const isActive = sortConfig?.key === columnKey || filters[columnKey as keyof StockItem];
    
    return (
      <TableHead style={{ width: columnWidths[widthKey] }} className="p-0 font-medium relative group/head bg-stone-50">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger className={cn(
            "flex items-center justify-between w-full h-full px-3 py-2 hover:bg-black/5 transition-colors group outline-none cursor-pointer",
            isActive && "bg-black/[0.03] text-orange-600"
          )}>
            <span className="text-[11px] font-bold uppercase tracking-wider truncate">{label}</span>
            <div className="flex items-center gap-1 shrink-0">
              {sortConfig?.key === columnKey && (
                sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
              )}
              {filters[columnKey as keyof StockItem] && <Filter className="h-3 w-3 fill-current" />}
              <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-2">
              <div className="flex flex-col gap-1">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start font-normal h-8"
                  onClick={() => {
                    handleSort(columnKey as keyof StockItem, 'asc');
                    setOpen(false);
                  }}
                >
                  <ArrowUp className="mr-2 h-3.5 w-3.5" /> 升序排列
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start font-normal h-8"
                  onClick={() => {
                    handleSort(columnKey as keyof StockItem, 'desc');
                    setOpen(false);
                  }}
                >
                  <ArrowDown className="mr-2 h-3.5 w-3.5" /> 降序排列
                </Button>
                {sortConfig?.key === columnKey && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="justify-start font-normal h-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      handleSort(columnKey as keyof StockItem, null);
                      setOpen(false);
                    }}
                  >
                    <X className="mr-2 h-3.5 w-3.5" /> 清除排序
                  </Button>
                )}
              </div>
              <Separator />
              <div className="p-1 space-y-2">
                <div className="text-[10px] uppercase font-bold text-black/40 px-1">文本筛选</div>
                <FilterInput 
                  placeholder={`筛选 ${label}...`}
                  className="h-8 text-xs border-black/10 focus:border-orange-500"
                  value={filters[columnKey as keyof StockItem] || ''}
                  onFilter={(val) => setFilters(prev => ({ ...prev, [columnKey]: val }))}
                  onComplete={() => setOpen(false)}
                />
              </div>
            </div>
          </PopoverContent>
        </Popover>
        <div 
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-400/50 group-hover/head:bg-black/10 transition-colors z-10"
          onMouseDown={(e) => startResizing(widthKey, e)}
        />
      </TableHead>
    );
  };

  return (
    <Card className="border-black/5 shadow-sm" onMouseUp={stopDragging} onMouseLeave={stopDragging}>
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-bold">原材料库</CardTitle>
          <CardDescription>管理库存 (可拖拽表头边缘调整列宽)</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedIds.size > 0 && (
            <div className="flex gap-2 mr-2 animate-in fade-in zoom-in-95">
              <Button size="sm" variant="outline" className="text-red-600 border-red-100 hover:bg-red-50" onClick={removeSelected}>
                <Trash2 className="h-4 w-4 mr-1" /> 清空数据 ({selectedIds.size})
              </Button>
              <Button size="sm" variant="outline" className="text-blue-600 border-blue-100 hover:bg-blue-50" onClick={duplicateSelected}>
                <Copy className="h-4 w-4 mr-1" /> 复制
              </Button>
            </div>
          )}
          {confirmClear ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2 mr-2">
              <span className="text-sm font-medium text-red-600 mr-2">确定清空所有数据?</span>
              <Button variant="default" size="sm" className="bg-red-600 text-white hover:bg-red-700 h-8" onClick={() => { setData([]); setConfirmClear(false); }}>
                确认
              </Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setConfirmClear(false)}>
                取消
              </Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-black/40 hover:text-red-600 gap-1" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4 w-4" />
              清空数据
            </Button>
          )}
          <Dialog open={importSalesDialogOpen} onOpenChange={setImportSalesDialogOpen}>
            <Button variant="outline" onClick={() => setImportSalesDialogOpen(true)} size="sm" className="gap-2 border-black/10 hover:bg-black/5">
              <Package className="h-4 w-4" /> 引用型材销料表数据
            </Button>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>引用销料表数据</DialogTitle>
                <DialogDescription>将销料表中的余量（大于0的部分）导入至在此处。</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <RadioGroup value={salesImportMode} onValueChange={(val: 'overwrite' | 'append') => setSalesImportMode(val)} className="flex flex-col gap-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="overwrite" id="so-overwrite" /><Label htmlFor="so-overwrite" className="text-red-600">全量覆盖</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="append" id="so-append" /><Label htmlFor="so-append">追加合并</Label></div>
                </RadioGroup>
              </div>
              <DialogFooter><Button variant="outline" onClick={() => setImportSalesDialogOpen(false)}>取消</Button><Button onClick={handleSalesImport} className="bg-black text-white">确认同步</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2 border-black/10 hover:bg-black/5">
            <FileDown className="h-4 w-4" /> 导出 Excel
          </Button>
          <ImportDialog 
            title="批量导入原材料" 
            onImport={(newData, append) => setData(append ? [...data, ...newData] : newData)}
            description="粘贴数据导入"
            purchases={purchases}
          />
          <Button onClick={addItem} size="sm" className="gap-2 bg-black text-white hover:bg-black/90 px-4">
            <Plus className="h-4 w-4" /> 添加库存
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0 text-[13px]">
        <div 
          ref={parentRef}
          className="rounded-md border border-black/5 w-full overflow-auto max-h-[650px] custom-scrollbar print:overflow-visible print:max-h-none"
        >
          <table style={{ width: totalCalculatedWidth, minWidth: '100%' }} className="w-full caption-bottom text-sm select-none table-fixed">
            <TableHeader className="bg-stone-50 border-b border-black/5 sticky top-0 z-20 shadow-sm">
              <TableRow className="hover:bg-transparent">
                <TableHead style={{ width: columnWidths.selection }} className="px-3 relative group/head bg-stone-50">
                  <div className="flex items-center justify-center cursor-pointer p-1 rounded hover:bg-black/5" onClick={toggleSelectAll}>
                    {selectedIds.size === processedData.length && processedData.length > 0 ? <CheckSquare className="h-4 w-4 text-orange-600" /> : <Square className="h-4 w-4 text-black/20" />}
                  </div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-400/50 transition-colors z-10"
                    onMouseDown={(e) => startResizing('selection', e)}
                  />
                </TableHead>
                <HeaderCell label="序号" columnKey="index" widthKey="index" />
                <HeaderCell label="型号" columnKey="model" widthKey="model" />
                <HeaderCell label="长度 (mm)" columnKey="length" widthKey="length" />
                <HeaderCell label="数量" columnKey="quantity" widthKey="quantity" />
                <HeaderCell label="颜色" columnKey="color" widthKey="color" />
                <HeaderCell label="单号源" columnKey="orderNumber" widthKey="orderNumber" />
                <HeaderCell label="备注" columnKey="remarks" widthKey="remarks" />
                <TableHead style={{ width: columnWidths.actions }} className="text-right pr-4 text-[10px] uppercase font-bold text-black/40 relative group/head bg-stone-50">
                  操作
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-400/50 transition-colors z-10"
                    onMouseDown={(e) => startResizing('actions', e)}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-black/30 italic">
                    {data.length === 0 ? "暂无原材料" : "未找到匹配项"}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <TableRow style={{ height: `${paddingTop}px` }}>
                      <TableCell colSpan={9} style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} />
                    </TableRow>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const item = processedData[virtualRow.index];
                    return (
                      <StockRow
                        key={item.id}
                        item={item}
                        idx={virtualRow.index}
                        isSelected={selectedIds.has(item.id)}
                        columnWidths={columnWidths}
                        onRowClick={handleRowClick}
                        onMouseDown={handleMouseDown}
                        onMouseEnter={handleMouseEnter}
                        onToggleSelect={handleToggleSelect}
                        onUpdateItem={handleUpdateItem}
                        onDeleteItem={handleDeleteItem}
                      />
                    );
                  })}
                  {paddingBottom > 0 && (
                    <TableRow style={{ height: `${paddingBottom}px` }}>
                      <TableCell colSpan={9} style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} />
                    </TableRow>
                  )}
                </>
              )}
            </TableBody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
});
