import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { FilterInput } from "./FilterInput";
import { Button } from "@/components/ui/button";
import { 
  Plus, Trash2, Square, CheckSquare, ClipboardPaste, X, Filter, ArrowUp, ArrowDown, ChevronDown
} from "lucide-react";
import { PurchaseItem } from "../lib/optimizer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, useTableState } from "@/lib/utils";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { exportToExcel } from "../lib/exportUtils";

interface PurchaseManagementProps {
  data: PurchaseItem[];
  setData: React.Dispatch<React.SetStateAction<PurchaseItem[]>>;
}

type SortConfig = {
  key: keyof PurchaseItem;
  direction: 'asc' | 'desc';
} | null;

interface PurchaseHeaderCellProps {
  title: string;
  field: keyof PurchaseItem;
  sortConfig: SortConfig;
  filterValue: string;
  width: number;
  onSort: (key: keyof PurchaseItem, direction: 'asc' | 'desc' | null) => void;
  onFilter: (key: keyof PurchaseItem, value: string) => void;
  onResizeStart: (field: string, startX: number, startWidth: number) => void;
}

const PurchaseHeaderCell = React.memo(function PurchaseHeaderCell({
  title,
  field,
  sortConfig,
  filterValue,
  width,
  onSort,
  onFilter,
  onResizeStart,
}: PurchaseHeaderCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = sortConfig?.key === field || !!filterValue;

  return (
    <TableHead style={{ width }} className="p-0 font-medium group/head relative bg-[#F5F5F4]">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger className={cn(
          "flex items-center justify-between w-full h-full px-3 py-2 hover:bg-black/5 transition-colors group outline-none cursor-pointer",
          isActive && "bg-black/[0.03] text-orange-600"
        )}>
          <span className="font-bold whitespace-nowrap text-black/70 group-hover:text-black transition-colors text-[11px] uppercase pointer-events-none">{title}</span>
          <div className="flex items-center gap-1 shrink-0 ml-1 pointer-events-none">
            {sortConfig?.key === field && (
              sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
            {filterValue && <Filter className="h-3 w-3 fill-current" />}
            <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-40 transition-opacity" />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-2" align="start">
          <div className="space-y-2">
            <div className="flex flex-col gap-1">
              <Button 
                variant="ghost" 
                size="sm" 
                className="justify-start font-normal h-8" 
                onClick={() => {
                  onSort(field, 'asc');
                  setIsOpen(false);
                }}
              >
                <ArrowUp className="mr-2 h-3.5 w-3.5" /> 升序排列
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="justify-start font-normal h-8" 
                onClick={() => {
                  onSort(field, 'desc');
                  setIsOpen(false);
                }}
              >
                <ArrowDown className="mr-2 h-3.5 w-3.5" /> 降序排列
              </Button>
              {sortConfig?.key === field && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="justify-start font-normal h-8 text-red-500 hover:text-red-600 hover:bg-red-50" 
                  onClick={() => {
                    onSort(field, null);
                    setIsOpen(false);
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
                placeholder={`筛选...`}
                className="h-8 text-xs border-black/10 focus:border-orange-500"
                value={filterValue || ''}
                onFilter={(val) => onFilter(field, val)}
                onComplete={() => setIsOpen(false)}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-500 z-50 opacity-0 group-hover/head:opacity-100 transition-opacity"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onResizeStart(field, e.clientX, width);
        }}
      />
    </TableHead>
  );
});

interface PurchaseInputCellProps {
  initialValue: string | number;
  type?: 'text' | 'number';
  className?: string;
  isFloat?: boolean;
  onCommit: (val: any) => void;
}

const PurchaseInputCell = React.memo(function PurchaseInputCell({
  initialValue,
  type = 'text',
  className,
  isFloat = false,
  onCommit
}: PurchaseInputCellProps) {
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
      onChange={e => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  );
});

interface PurchaseRowProps {
  item: PurchaseItem;
  isSelected: boolean;
  colWidths: Record<string, number>;
  onToggleSelect: (id: string, e?: React.MouseEvent) => void;
  onUpdateItem: (id: string, field: keyof PurchaseItem, value: any) => void;
  onDeleteItem: (id: string) => void;
}

const PurchaseRow = React.memo(function PurchaseRow({
  item,
  isSelected,
  colWidths,
  onToggleSelect,
  onUpdateItem,
  onDeleteItem,
}: PurchaseRowProps) {
  const calculatedWeight = ((item.linearDensity || 0) * (item.quantity || 0) * (item.length || 0) / 1000).toFixed(2);

  return (
    <TableRow className={cn("transition-colors group hover:bg-black/[0.02] border-b border-black/5", isSelected && "bg-orange-50/50")}>
      <TableCell style={{ width: 40 }} className="text-center p-1">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-black/40 hover:text-black" onClick={(e) => onToggleSelect(item.id, e)}>
          {isSelected ? <CheckSquare className="h-4 w-4 text-orange-600" /> : <Square className="h-4 w-4" />}
        </Button>
      </TableCell>
      <TableCell style={{ width: colWidths['profileName'] || 135 }} className="p-1 px-3">
        <PurchaseInputCell 
          initialValue={item.profileName || ''} 
          onCommit={v => onUpdateItem(item.id, 'profileName', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs" 
        />
      </TableCell>
      <TableCell style={{ width: colWidths['model'] || 155 }} className="p-1 px-3">
        <PurchaseInputCell 
          initialValue={item.model} 
          onCommit={v => onUpdateItem(item.id, 'model', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs" 
        />
      </TableCell>
      <TableCell style={{ width: colWidths['length'] || 100 }} className="p-1 px-3">
        <PurchaseInputCell 
          type="number"
          isFloat={true}
          initialValue={item.length || ''} 
          onCommit={v => onUpdateItem(item.id, 'length', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs font-mono" 
        />
      </TableCell>
      <TableCell style={{ width: colWidths['color'] || 70 }} className="p-1 px-3">
        <PurchaseInputCell 
          initialValue={item.color} 
          onCommit={v => onUpdateItem(item.id, 'color', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs" 
        />
      </TableCell>
      <TableCell style={{ width: colWidths['quantity'] || 80 }} className="p-1 px-3">
        <PurchaseInputCell 
          type="number" 
          initialValue={item.quantity || ''} 
          onCommit={v => onUpdateItem(item.id, 'quantity', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs font-mono" 
        />
      </TableCell>
      <TableCell style={{ width: colWidths['linearDensity'] || 100 }} className="p-1 px-3">
        <PurchaseInputCell 
          type="number"
          isFloat={true}
          initialValue={item.linearDensity || ''} 
          onCommit={v => onUpdateItem(item.id, 'linearDensity', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs font-mono" 
        />
      </TableCell>
      <TableCell style={{ width: colWidths['weight'] || 80 }} className="p-1 px-3 font-mono text-[11px] text-black/60 h-10 align-middle">
        {calculatedWeight}
      </TableCell>
      <TableCell style={{ width: colWidths['orderNumber'] || 120 }} className="p-1 px-3">
        <PurchaseInputCell 
          initialValue={item.orderNumber} 
          onCommit={v => onUpdateItem(item.id, 'orderNumber', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs" 
        />
      </TableCell>
      <TableCell style={{ width: colWidths['remarks'] || 120 }} className="p-1 px-3">
        <PurchaseInputCell 
          initialValue={item.remarks} 
          onCommit={v => onUpdateItem(item.id, 'remarks', v)} 
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent text-xs" 
        />
      </TableCell>
      <TableCell style={{ width: 40 }} className="p-1 px-1 h-10 align-middle text-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-7 w-7 text-black/40 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity" 
          onClick={() => onDeleteItem(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}, (prevProps, nextProps) => {
  if (prevProps.isSelected !== nextProps.isSelected) return false;
  if (prevProps.item !== nextProps.item) {
    if (
      prevProps.item.id !== nextProps.item.id ||
      prevProps.item.profileName !== nextProps.item.profileName ||
      prevProps.item.model !== nextProps.item.model ||
      prevProps.item.length !== nextProps.item.length ||
      prevProps.item.color !== nextProps.item.color ||
      prevProps.item.quantity !== nextProps.item.quantity ||
      prevProps.item.linearDensity !== nextProps.item.linearDensity ||
      prevProps.item.orderNumber !== nextProps.item.orderNumber ||
      prevProps.item.remarks !== nextProps.item.remarks
    ) {
      return false;
    }
  }
  if (prevProps.colWidths !== nextProps.colWidths) {
    for (const key of Object.keys(nextProps.colWidths)) {
      if (prevProps.colWidths[key] !== nextProps.colWidths[key]) return false;
    }
  }
  return true;
});

export const PurchaseManagement = React.memo(function PurchaseManagement({ data, setData }: PurchaseManagementProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);
  const [sortConfig, setSortConfig] = useTableState<SortConfig>('purchase_sort', { key: 'orderNumber', direction: 'asc' });
  const [filters, setFilters] = useTableState<Partial<Record<keyof PurchaseItem, string>>>('purchase_filters', {});
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const [colWidths, setColWidths] = useTableState<Record<string, number>>('purchase_col_widths', {
    profileName: 135,
    model: 155,
    length: 100,
    color: 70,
    quantity: 80,
    linearDensity: 100,
    weight: 80,
    orderNumber: 120,
    remarks: 120,
  });

  const parentRef = useRef<HTMLDivElement>(null);

  const [pasteDialogOpen, setPasteDialogOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importMode, setImportMode] = useState<'overwrite' | 'append'>('append');

  const addItem = useCallback(() => {
    setData(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      profileName: '',
      model: '',
      length: 6000,
      quantity: 1,
      linearDensity: 0,
      color: '',
      orderNumber: '',
      remarks: ''
    }]);
  }, [setData]);

  const updateItem = useCallback((id: string, field: keyof PurchaseItem, value: any) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  }, [setData]);

  const deleteItems = useCallback((ids: Set<string>) => {
    setData(prev => prev.filter(item => !ids.has(item.id)));
    setSelectedIds(new Set());
  }, [setData]);

  const deleteSingleItem = useCallback((id: string) => {
    setData(prev => prev.filter(item => item.id !== id));
    setSelectedIds(prev => {
      if (prev.has(id)) {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }
      return prev;
    });
  }, [setData]);

  const handleSort = useCallback((key: keyof PurchaseItem, direction: 'asc' | 'desc' | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key, direction });
  }, [setSortConfig]);

  const updateFilter = useCallback((key: keyof PurchaseItem, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, [setFilters]);

  const handleResizeStart = useCallback((field: string, startX: number, startWidth: number) => {
    const onMouseMove = (moveEvent: MouseEvent) => {
      requestAnimationFrame(() => {
        setColWidths(prev => ({ 
          ...prev, 
          [field]: Math.max(50, startWidth + (moveEvent.clientX - startX)) 
        }));
      });
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [setColWidths]);

  const displayData = useMemo(() => {
    let result = [...data];

    // Apply filters
    const activeFilters = Object.entries(filters).filter(([_, v]) => Boolean(v));
    if (activeFilters.length > 0) {
      result = result.filter(item => 
        activeFilters.every(([key, value]) => 
          String(item[key as keyof PurchaseItem] ?? '').toLowerCase().includes(value!.toLowerCase())
        )
      );
    }

    // Apply sort
    if (sortConfig) {
      const { key, direction } = sortConfig;
      result.sort((a, b) => {
        const aVal = a[key];
        const bVal = b[key];
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        const sA = String(aVal ?? '');
        const sB = String(bVal ?? '');
        if (sA < sB) return direction === 'asc' ? -1 : 1;
        if (sA > sB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [data, sortConfig, filters]);

  const rowVirtualizer = useVirtualizer({
    count: displayData.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 41,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0]?.start || 0 : 0;
  const paddingBottom = virtualRows.length > 0 ? totalVirtualSize - (virtualRows[virtualRows.length - 1]?.end || 0) : 0;

  const totalCalculatedWidth = useMemo(() => {
    return 40 + 40 + 
      (colWidths.profileName || 135) +
      (colWidths.model || 155) +
      (colWidths.length || 100) +
      (colWidths.color || 70) +
      (colWidths.quantity || 80) +
      (colWidths.linearDensity || 100) +
      (colWidths.weight || 80) +
      (colWidths.orderNumber || 120) +
      (colWidths.remarks || 120);
  }, [colWidths]);

  const displayDataRef = useRef(displayData);
  displayDataRef.current = displayData;
  const lastClickedIdRef = useRef(lastClickedId);
  lastClickedIdRef.current = lastClickedId;

  const toggleSelect = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const currentDisplayData = displayDataRef.current;
    const currentLastClickedId = lastClickedIdRef.current;
    setSelectedIds(prevSelected => {
      const newSelected = new Set(prevSelected);
      if (e?.shiftKey && currentLastClickedId) {
        const currentIndex = currentDisplayData.findIndex(item => item.id === id);
        const lastIndex = currentDisplayData.findIndex(item => item.id === currentLastClickedId);
        if (currentIndex !== -1 && lastIndex !== -1) {
          const start = Math.min(currentIndex, lastIndex);
          const end = Math.max(currentIndex, lastIndex);
          const isSelecting = !prevSelected.has(id);
          for (let i = start; i <= end; i++) {
            if (isSelecting) newSelected.add(currentDisplayData[i].id);
            else newSelected.delete(currentDisplayData[i].id);
          }
        }
      } else {
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
      }
      return newSelected;
    });
    setLastClickedId(id);
  }, []);

  const toggleSelectAll = useCallback(() => {
    const currentDisplayData = displayDataRef.current;
    setSelectedIds(prev => {
      if (prev.size === currentDisplayData.length && currentDisplayData.length > 0) {
        return new Set();
      }
      return new Set(currentDisplayData.map(item => item.id));
    });
  }, []);

  const handlePasteImport = () => {
    if (!pasteText.trim()) return;
    
    try {
      const rows = pasteText.trim().split('\n');
      const newItems: PurchaseItem[] = [];
      
      rows.forEach((row, i) => {
        const cols = row.split('\t').map(c => c.trim());
        if (cols.length >= 4) {
          if (i === 0 && ['型号', '长度', '颜色', '型材名称'].some(h => cols.includes(h))) return;
          
          let profileName = '', model = '', length = 6000, color = '', qty = 1, linearDensity = 0, orderNumber = '', remarks = '';

          // Expect: 型材名称 | 型号 | 长度 | 颜色 | 数量 | 线密度 | 重量(忽略) | 采购单号 | 备注
          profileName = cols[0] || '';
          model = cols[1] || '';
          length = parseFloat(cols[2]) || 6000;
          color = cols[3] || '';
          qty = parseInt(cols[4], 10) || 1;
          linearDensity = parseFloat(cols[5]) || 0;
          orderNumber = cols[7] || '';
          remarks = cols[8] || '';

          newItems.push({
            id: Math.random().toString(36).substring(2, 9) + i,
            profileName,
            model,
            length,
            color,
            quantity: qty,
            linearDensity,
            orderNumber,
            remarks
          });
        }
      });
      
      if (importMode === 'overwrite') {
        setData(newItems);
      } else {
        setData(prev => [...prev, ...newItems]);
      }
      
      setPasteDialogOpen(false);
      setPasteText('');
      toast.success(`成功导入 ${newItems.length} 条采购记录`);
    } catch (e) {
      toast.error('导入失败，请检查数据格式');
    }
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error('当前没有采购记录可导出');
      return;
    }

    const columns = [
      { header: '型材名称', getValue: (item: PurchaseItem) => item.profileName || '' },
      { header: '型号', getValue: (item: PurchaseItem) => item.model || '' },
      { header: '长度(mm)', getValue: (item: PurchaseItem) => item.length || '' },
      { header: '颜色', getValue: (item: PurchaseItem) => item.color || '' },
      { header: '采购数量', getValue: (item: PurchaseItem) => item.quantity || 0 },
      { header: '单重(kg/m)', getValue: (item: PurchaseItem) => item.linearDensity || '' },
      { 
        header: '合计重量(kg)', 
        getValue: (item: PurchaseItem) => item.linearDensity ? (item.length / 1000 * item.linearDensity * item.quantity).toFixed(2) : '' 
      },
      { header: '采购单号', getValue: (item: PurchaseItem) => item.orderNumber || '' },
      { header: '备注', getValue: (item: PurchaseItem) => item.remarks || '' }
    ];

    exportToExcel({
      filename: `采购单_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: '采购单',
      columns,
      data,
      includeIndex: true,
    });
    toast.success('采购单导出成功');
  };

  const { mainDataCount, offcutDataCount, totalQuantity, totalWeight, offcutQuantity, offcutWeight } = useMemo(() => {
    let mCount = 0;
    let oCount = 0;
    let tQty = 0;
    let tWt = 0;
    let oQty = 0;
    let oWt = 0;

    displayData.forEach(item => {
      const text = `${item.profileName || ''} ${item.model || ''} ${item.orderNumber || ''} ${item.remarks || ''}`;
      const isOff = text.includes('二次利用') || text.includes('料头');
      const itemQty = item.quantity || 0;
      const itemWt = (item.linearDensity || 0) * itemQty * (item.length || 0) / 1000;

      if (isOff) {
        oCount++;
        oQty += itemQty;
        oWt += itemWt;
      } else {
        mCount++;
        tQty += itemQty;
        tWt += itemWt;
      }
    });

    return {
      mainDataCount: mCount,
      offcutDataCount: oCount,
      totalQuantity: tQty,
      totalWeight: tWt,
      offcutQuantity: oQty,
      offcutWeight: oWt
    };
  }, [displayData]);

  return (
    <Card className="h-[calc(100vh-220px)] min-h-[600px] flex flex-col shadow-md border-black/5 relative overflow-hidden group print:h-auto print:min-h-0 print:overflow-visible print:border-none print:shadow-none print:block">
      <CardHeader className="pb-4 bg-orange-50/30 border-b border-black/5 shrink-0 print:bg-transparent print:border-b-2 print:pb-2 print:block">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="text-xl flex flex-wrap items-center gap-2">
              采购单管理
              <span className="text-xs font-normal bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
                共 {mainDataCount} 条记录
              </span>
              <span className="text-xs font-normal bg-blue-100/80 text-blue-800 px-2 py-0.5 rounded-full">
                总支数 {totalQuantity}
              </span>
              <span className="text-xs font-normal bg-green-100/80 text-green-800 px-2 py-0.5 rounded-full border-r-2 border-transparent">
                总重量 {totalWeight.toFixed(2)} kg
              </span>
              
              <span className="text-xs font-normal bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full ml-2">
                料头: {offcutDataCount} 条记录
              </span>
              <span className="text-xs font-normal bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                支数 {offcutQuantity}
              </span>
              <span className="text-xs font-normal bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                重量 {offcutWeight.toFixed(2)} kg
              </span>
            </CardTitle>
            <CardDescription className="mt-1.5 text-black/60">
              录入和管理所有型材采购记录
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap print:hidden">
            {selectedIds.size > 0 && (
              <Button onClick={() => deleteItems(selectedIds)} variant="destructive" size="sm" className="gap-2 shrink-0">
                <Trash2 className="h-4 w-4" /> 删除选中 ({selectedIds.size})
              </Button>
            )}

            <Dialog open={pasteDialogOpen} onOpenChange={setPasteDialogOpen}>
              <Button variant="outline" onClick={() => setPasteDialogOpen(true)} size="sm" className="gap-2 border-black/10 hover:bg-black/5">
                <ClipboardPaste className="h-4 w-4" /> 粘贴导入
              </Button>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>从 Excel 粘贴导入</DialogTitle>
                  <DialogDescription>
                    请从 Excel 复制数据并粘贴到下方文本框中。
                    <br/>
                    期待格式：<strong className="text-black">型材名称 | 型号 | 长度 | 颜色 | 数量 | 线密度 | 重量(将被忽略) | 采购单号 | 备注</strong>
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <RadioGroup value={importMode} onValueChange={(val: any) => setImportMode(val)} className="flex gap-6">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="append" id="append" /><Label htmlFor="append">追加到现有数据(不合并数量)</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="overwrite" id="overwrite" /><Label htmlFor="overwrite" className="text-red-600">清空并覆盖现有数据</Label></div>
                  </RadioGroup>
                  <Textarea
                    placeholder="在此粘贴 Excel 数据..."
                    className="flex-1 min-h-[150px] max-h-[40vh] overflow-y-auto font-mono text-sm resize-none"
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                  />
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setPasteDialogOpen(false)}>取消</Button><Button onClick={handlePasteImport} className="bg-black text-white">确认导入</Button></DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={confirmClear} onOpenChange={setConfirmClear}>
              <Button variant="outline" onClick={() => setConfirmClear(true)} size="sm" className="gap-2 border-black/10 hover:bg-red-50 hover:text-red-600 hover:border-red-200">
                <X className="h-4 w-4" /> 清空数据
              </Button>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>确认清空</DialogTitle>
                  <DialogDescription>您确定要清空所有采购记录吗？此操作无法撤销。</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setConfirmClear(false)}>取消</Button>
                  <Button variant="destructive" onClick={() => { setData([]); setConfirmClear(false); toast.success('已清空采购记录'); }}>确认清空</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={handleExportCSV} size="sm" className="gap-2 bg-white text-orange-600 border border-orange-200 hover:bg-orange-50 no-print">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
              导出CSV
            </Button>

            <Button onClick={addItem} size="sm" className="gap-2 bg-black text-white hover:bg-black/90">
              <Plus className="h-4 w-4" /> 手动添加
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0 overflow-hidden flex flex-col flex-grow print:overflow-visible print:block">
        <div 
          ref={parentRef}
          className="overflow-auto flex-grow relative h-full custom-scrollbar print:overflow-visible print:h-auto print:block"
        >
          <table 
            style={{ width: totalCalculatedWidth, minWidth: '100%' }} 
            className="w-full caption-bottom text-sm select-none table-fixed border-collapse"
          >
            <TableHeader className="bg-[#F5F5F4] border-b shadow-sm border-black/5 sticky top-0 z-20 print:static print:bg-transparent">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead style={{ width: 40 }} className="text-center px-0 bg-[#F5F5F4]">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-black/40 hover:text-black" onClick={toggleSelectAll}>
                    {selectedIds.size === displayData.length && displayData.length > 0 ? <CheckSquare className="h-4 w-4 text-orange-600" /> : <Square className="h-4 w-4" />}
                  </Button>
                </TableHead>
                <PurchaseHeaderCell 
                  title="型材名称" 
                  field="profileName" 
                  sortConfig={sortConfig} 
                  filterValue={filters.profileName || ''} 
                  width={colWidths['profileName'] || 135} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <PurchaseHeaderCell 
                  title="型号" 
                  field="model" 
                  sortConfig={sortConfig} 
                  filterValue={filters.model || ''} 
                  width={colWidths['model'] || 155} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <PurchaseHeaderCell 
                  title="长度(mm)" 
                  field="length" 
                  sortConfig={sortConfig} 
                  filterValue={filters.length ? String(filters.length) : ''} 
                  width={colWidths['length'] || 100} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <PurchaseHeaderCell 
                  title="颜色" 
                  field="color" 
                  sortConfig={sortConfig} 
                  filterValue={filters.color || ''} 
                  width={colWidths['color'] || 70} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <PurchaseHeaderCell 
                  title="数量" 
                  field="quantity" 
                  sortConfig={sortConfig} 
                  filterValue={filters.quantity ? String(filters.quantity) : ''} 
                  width={colWidths['quantity'] || 80} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <PurchaseHeaderCell 
                  title="线密(kg/m)" 
                  field="linearDensity" 
                  sortConfig={sortConfig} 
                  filterValue={filters.linearDensity ? String(filters.linearDensity) : ''} 
                  width={colWidths['linearDensity'] || 100} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <TableHead style={{ width: colWidths['weight'] || 80 }} className="font-bold text-black/70 px-3 text-[11px] uppercase group bg-[#F5F5F4] relative" title="根据公式自动计算: 线密 × 长度 × 数量 / 1000">
                  <div className="flex items-center h-full">重量(kg)</div>
                  <div 
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-500 z-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleResizeStart('weight', e.clientX, colWidths['weight'] || 80);
                    }}
                  />
                </TableHead>
                <PurchaseHeaderCell 
                  title="采购单号" 
                  field="orderNumber" 
                  sortConfig={sortConfig} 
                  filterValue={filters.orderNumber || ''} 
                  width={colWidths['orderNumber'] || 120} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <PurchaseHeaderCell 
                  title="备注" 
                  field="remarks" 
                  sortConfig={sortConfig} 
                  filterValue={filters.remarks || ''} 
                  width={colWidths['remarks'] || 120} 
                  onSort={handleSort} 
                  onFilter={updateFilter} 
                  onResizeStart={handleResizeStart} 
                />
                <TableHead style={{ width: 40 }} className="bg-[#F5F5F4]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-32 text-center text-black/40 italic">
                    {data.length === 0 ? "暂无采购记录" : "未找到匹配项"}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <TableRow style={{ height: `${paddingTop}px` }}>
                      <TableCell colSpan={11} style={{ height: `${paddingTop}px`, padding: 0, border: 0 }} />
                    </TableRow>
                  )}
                  {virtualRows.map((virtualRow) => {
                    const item = displayData[virtualRow.index];
                    return (
                      <PurchaseRow
                        key={item.id}
                        item={item}
                        isSelected={selectedIds.has(item.id)}
                        colWidths={colWidths}
                        onToggleSelect={toggleSelect}
                        onUpdateItem={updateItem}
                        onDeleteItem={deleteSingleItem}
                      />
                    );
                  })}
                  {paddingBottom > 0 && (
                    <TableRow style={{ height: `${paddingBottom}px` }}>
                      <TableCell colSpan={11} style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }} />
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

