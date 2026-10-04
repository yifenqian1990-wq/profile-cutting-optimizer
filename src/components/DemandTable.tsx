
import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  FileDown
} from "lucide-react";
import { toast } from "sonner";
import { exportToExcel } from "../lib/exportUtils";
import { DemandItem, PurchaseItem } from "../lib/optimizer";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ImportDialog } from "./ImportDialog";
import { cn, useTableState } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface DemandTableProps {
  data: DemandItem[];
  setData: React.Dispatch<React.SetStateAction<DemandItem[]>>;
  purchases?: PurchaseItem[];
}

type SortConfig = {
  key: keyof DemandItem;
  direction: 'asc' | 'desc';
} | null;

interface DemandInputCellProps {
  initialValue: string | number;
  type?: 'text' | 'number';
  className?: string;
  isFloat?: boolean;
  onCommit: (val: any) => void;
}

const DemandInputCell = React.memo(function DemandInputCell({
  initialValue,
  type = 'text',
  className,
  isFloat = false,
  onCommit
}: DemandInputCellProps) {
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

interface DemandRowProps {
  item: DemandItem;
  idx: number;
  isSelected: boolean;
  columnWidths: Record<string, number>;
  onRowClick: (id: string, e: React.MouseEvent) => void;
  onMouseDown: (id: string, e: React.MouseEvent) => void;
  onMouseEnter: (id: string) => void;
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onUpdateItem: (id: string, field: keyof DemandItem, value: any) => void;
  onDeleteItem: (id: string) => void;
}

const DemandRow = React.memo(function DemandRow({
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
}: DemandRowProps) {
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
        <DemandInputCell 
          initialValue={item.model} 
          onCommit={(val) => onUpdateItem(item.id, 'model', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.length }} className="p-1 px-3">
        <DemandInputCell 
          type="number"
          isFloat={true}
          initialValue={item.length || ''} 
          onCommit={(val) => onUpdateItem(item.id, 'length', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs font-mono"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.quantity }} className="p-1 px-3">
        <DemandInputCell 
          type="number" 
          initialValue={item.quantity || ''} 
          onCommit={(val) => onUpdateItem(item.id, 'quantity', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs font-mono"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.color }} className="p-1 px-3">
        <DemandInputCell 
          initialValue={item.color} 
          onCommit={(val) => onUpdateItem(item.id, 'color', val)}
          className="h-8 border-transparent hover:border-black/5 focus:border-orange-500 bg-transparent transition-all text-xs"
        />
      </TableCell>
      <TableCell style={{ width: columnWidths.remarks }} className="p-1 px-3">
        <DemandInputCell 
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
      prevProps.item.remarks !== nextProps.item.remarks
    ) {
      return false;
    }
  }
  if (prevProps.columnWidths !== nextProps.columnWidths) {
    for (const k of Object.keys(nextProps.columnWidths)) {
      if (prevProps.columnWidths[k] !== nextProps.columnWidths[k]) return false;
    }
  }
  return true;
});

export function DemandTable({ data, setData, purchases }: DemandTableProps) {
  const [sortConfig, setSortConfig] = useTableState<SortConfig>('demand_sort', null);
  const [filters, setFilters] = useTableState<Partial<Record<keyof DemandItem, string>>>('demand_filters', {});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  
  // Column resizing state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    selection: 40,
    index: 55,
    model: 320,    
    length: 120,
    quantity: 100,
    color: 120,    
    remarks: 150,  
    actions: 60
  });

  const handleExportExcel = () => {
    if (data.length === 0) {
      toast.error('当前没有零件需求可导出');
      return;
    }

    const columns = [
      { header: '型号', getValue: (item: DemandItem) => item.model || '' },
      { header: '长度(mm)', getValue: (item: DemandItem) => item.length || '' },
      { header: '数量', getValue: (item: DemandItem) => item.quantity || 0 },
      { header: '颜色', getValue: (item: DemandItem) => item.color || '' },
      { 
        header: '关联采购单', 
        getValue: (item: DemandItem) => {
          const match = purchases?.find(p => p.model === item.model && p.color === item.color);
          return match?.orderNumber || item.remarks || '';
        } 
      },
      { header: '备注', getValue: (item: DemandItem) => item.remarks || '' }
    ];

    exportToExcel({
      filename: `下料清单_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: '下料清单',
      columns,
      data: processedData,
      includeIndex: true,
    });
    toast.success('下料清单导出成功');
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

  // Sorting logic
  const handleSort = (key: keyof DemandItem, direction: 'asc' | 'desc' | null) => {
    if (direction === null) {
      setSortConfig(null);
    } else {
      setSortConfig({ key, direction });
    }
  };

  // Filter & Sort processed data
  const processedData = useMemo(() => {
    let result = [...data];
    
    // Filtering
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      result = result.filter(item => 
        String(item[key as keyof DemandItem]).toLowerCase().includes(value.toLowerCase())
      );
    });

    // Sorting
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

  // Selection handlers
  const handleRowClick = (id: string, event: React.MouseEvent) => {
    const newSelected = new Set(selectedIds);
    
    if (event.ctrlKey || event.metaKey) {
      if (newSelected.has(id)) newSelected.delete(id);
      else newSelected.add(id);
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
    if (event.button !== 0) return; // Only left click
    if (event.ctrlKey || event.shiftKey || event.metaKey) return;
    
    setIsDragging(true);
    const newSelected = new Set([id]);
    setSelectedIds(newSelected);
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

  // Data Actions
  const addItem = () => {
    const newItem: DemandItem = {
      id: Math.random().toString(36).substr(2, 9),
      model: '', length: 0, quantity: 1, color: '', remarks: '',
    };
    setData([...data, newItem]);
  };

  const removeSelected = () => {
    setData(data.filter(item => !selectedIds.has(item.id)));
    setSelectedIds(new Set());
  };

  const duplicateSelected = () => {
    const toDuplicate = data.filter(item => selectedIds.has(item.id));
    const newItems = toDuplicate.map(item => ({
      ...item, id: Math.random().toString(36).substr(2, 9)
    }));
    setData([...data, ...newItems]);
  };

  const updateItem = (id: string, field: keyof DemandItem, value: any) => {
    setData(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const HeaderCell = ({ label, columnKey, widthKey }: { label: string, columnKey: string, widthKey: string }) => {
    const [open, setOpen] = useState(false);
    const isActive = sortConfig?.key === columnKey || filters[columnKey as keyof DemandItem];
    
    return (
      <TableHead style={{ width: columnWidths[widthKey] }} className="p-0 font-medium relative group/head">
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
              {filters[columnKey] && <Filter className="h-3 w-3 fill-current" />}
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
                    handleSort(columnKey as keyof DemandItem, 'asc');
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
                    handleSort(columnKey as keyof DemandItem, 'desc');
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
                      handleSort(columnKey as keyof DemandItem, null);
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
                  value={filters[columnKey as keyof DemandItem] || ''}
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
          <CardTitle className="text-lg font-bold">下料清单</CardTitle>
          <CardDescription>管理零件需求 (可拖拽表头边缘调整列宽)</CardDescription>
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
          <Button onClick={handleExportExcel} variant="outline" size="sm" className="gap-2 border-black/10 hover:bg-black/5">
            <FileDown className="h-4 w-4" /> 导出 Excel
          </Button>
          <ImportDialog 
            title="批量导入下料清单" 
            onImport={(newData, append) => setData(append ? [...data, ...newData] : newData)}
            description="粘贴数据导入"
            purchases={purchases}
          />
          <Button onClick={addItem} size="sm" className="gap-2 bg-black text-white hover:bg-black/90 px-4">
            <Plus className="h-4 w-4" /> 添加零件
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0 overflow-x-auto">
        <div className="rounded-md border border-black/5 min-w-full inline-block">
          <Table className="select-none table-fixed">
            <TableHeader className="bg-black/[0.03] border-b border-black/5">
              <TableRow>
                <TableHead style={{ width: columnWidths.selection }} className="px-3 relative group/head">
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
                <HeaderCell label="备注" columnKey="remarks" widthKey="remarks" />
                <TableHead style={{ width: columnWidths.actions }} className="text-right pr-4 text-[10px] uppercase font-bold text-black/40 relative group/head">
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
                  <TableCell colSpan={7} className="h-32 text-center text-black/30 italic">
                    {data.length === 0 ? "暂无下料清单" : "未找到匹配项"}
                  </TableCell>
                </TableRow>
              ) : (
                processedData.map((item, idx) => (
                  <DemandRow
                    key={item.id}
                    item={item}
                    idx={idx}
                    isSelected={selectedIds.has(item.id)}
                    columnWidths={columnWidths}
                    onRowClick={handleRowClick}
                    onMouseDown={handleMouseDown}
                    onMouseEnter={handleMouseEnter}
                    onToggleSelect={(id) => {
                      const newSelected = new Set(selectedIds);
                      if (newSelected.has(id)) {
                        newSelected.delete(id);
                      } else {
                        newSelected.add(id);
                      }
                      setSelectedIds(newSelected);
                      setLastClickedId(id);
                    }}
                    onUpdateItem={updateItem}
                    onDeleteItem={(id) => setData(prev => prev.filter(i => i.id !== id))}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
