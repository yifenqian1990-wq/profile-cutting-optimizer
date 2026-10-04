import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { FilterInput } from "../FilterInput";
import { 
  Filter, 
  ArrowUp, 
  ArrowDown, 
  ChevronDown, 
  Square, 
  CheckSquare, 
  Edit2, 
  ClipboardList, 
  ClipboardPaste, 
  Trash2,
  X 
} from "lucide-react";
import { OrderColumn } from "../../lib/optimizer";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface ProfileSalesHeaderCellProps {
  label: string | React.ReactNode;
  columnKey: string;
  widthKey: string;
  width: number;
  isSticky: boolean;
  stickyLeft?: number;
  isDraggableCol?: boolean;
  orderCol?: OrderColumn;
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null;
  filterValue?: string;
  onlyShowSold?: boolean;
  onlyShowShortage?: boolean;
  unmatchedTypes?: number;
  unmatchedTotalQty?: number;
  colTotal?: number;
  onSort: (key: string, direction: 'asc' | 'desc' | null) => void;
  onFilter: (key: string, val: string) => void;
  onToggleOnlyShowSold?: (colId: string) => void;
  onToggleOnlyShowShortage?: () => void;
  onStartResizing: (key: string, e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent, colId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, colId: string) => void;
  onOpenRename?: (colId: string, currentName: string) => void;
  onOpenRemark?: (colId: string, currentRemark: string) => void;
  onReimport?: (colId: string, planName: string) => void;
  onOpenImportOther?: (colId: string) => void;
  onOpenDelete?: (colId: string) => void;
}

export const ProfileSalesHeaderCell = React.memo(function ProfileSalesHeaderCell({
  label,
  columnKey,
  widthKey,
  width,
  isSticky,
  stickyLeft,
  isDraggableCol,
  orderCol,
  sortConfig,
  filterValue,
  onlyShowSold,
  onlyShowShortage,
  unmatchedTypes = 0,
  unmatchedTotalQty = 0,
  colTotal = 0,
  onSort,
  onFilter,
  onToggleOnlyShowSold,
  onToggleOnlyShowShortage,
  onStartResizing,
  onDragStart,
  onDragOver,
  onDrop,
  onOpenRename,
  onOpenRemark,
  onReimport,
  onOpenImportOther,
  onOpenDelete,
}: ProfileSalesHeaderCellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const isActive = sortConfig?.key === columnKey || !!filterValue || (orderCol && onlyShowSold) || (columnKey === 'remaining' && onlyShowShortage);

  return (
    <th 
      style={{ 
        width,
        position: 'sticky',
        top: 0,
        left: isSticky ? stickyLeft : undefined,
        zIndex: isSticky ? 30 : 20
      }} 
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0 p-0 relative group/head transition-colors bg-[#f4f4f5]", 
        isDraggableCol && "cursor-grab active:cursor-grabbing",
        isSticky ? "bg-[#f7f7f7] border-r border-black/[0.05]" : "",
        isSticky && widthKey === 'remaining' && "border-r-2 border-black/20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]"
      )}
      draggable={isDraggableCol}
      onDragStart={(e) => {
        if (isDraggableCol && orderCol && onDragStart) {
          onDragStart(e, orderCol.id);
        }
      }}
      onDragOver={(e) => {
        if (isDraggableCol && onDragOver) {
          onDragOver(e);
        }
      }}
      onDrop={(e) => {
        if (isDraggableCol && orderCol && onDrop) {
          onDrop(e, orderCol.id);
        }
      }}
    >
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger className={cn(
          "flex items-center justify-between w-full h-full px-3 py-2 hover:bg-black/5 transition-colors group outline-none cursor-pointer",
          isActive && "bg-black/[0.03] text-orange-600"
        )}>
          {typeof label === 'string' ? (
            <div className="flex flex-col items-start min-w-0 overflow-hidden text-left">
              <span className="text-[11px] font-bold uppercase tracking-wider truncate w-full" title={label}>{label}</span>
              {orderCol?.remark && (
                <span className="text-[9px] text-black/40 font-normal truncate w-full" title={orderCol.remark}>{orderCol.remark}</span>
              )}
            </div>
          ) : (
             <div className="text-[11px] font-bold uppercase tracking-wider truncate flex-1 text-left flex items-center gap-1.5 overflow-hidden">{label}</div>
          )}
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {sortConfig?.key === columnKey && (
              sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
            )}
            {(filterValue || (orderCol && onlyShowSold) || (columnKey === 'remaining' && onlyShowShortage)) && <Filter className="h-3 w-3 fill-current" />}
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
                  onSort(columnKey, 'asc');
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
                  onSort(columnKey, 'desc');
                  setIsOpen(false);
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
                    onSort(columnKey, null);
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
                onFilter={(val) => onFilter(columnKey, val)}
                onComplete={() => setIsOpen(false)}
              />
            </div>
            {columnKey === 'remaining' && onToggleOnlyShowShortage && (
              <>
                <Separator />
                <div className="px-1">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className={cn(
                      "justify-start font-normal h-8 w-full text-left",
                      onlyShowShortage ? "text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700 font-medium" : "text-black/70 hover:text-black"
                    )} 
                    onClick={() => {
                      onToggleOnlyShowShortage();
                      setIsOpen(false);
                    }}
                  >
                    {onlyShowShortage ? (
                      <CheckSquare className="mr-2 h-3.5 w-3.5 text-orange-600 shrink-0" />
                    ) : (
                      <Square className="mr-2 h-3.5 w-3.5 text-black/40 shrink-0" />
                    )}
                    仅显示缺料的数据
                  </Button>
                </div>
              </>
            )}
            {orderCol && (
              <>
                {onToggleOnlyShowSold && (
                  <>
                    <Separator />
                    <div className="px-1">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className={cn(
                          "justify-start font-normal h-8 w-full text-left",
                          onlyShowSold ? "text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700 font-medium" : "text-black/70 hover:text-black"
                        )} 
                        onClick={() => {
                          onToggleOnlyShowSold(orderCol.id);
                          setIsOpen(false);
                        }}
                      >
                        {onlyShowSold ? (
                          <CheckSquare className="mr-2 h-3.5 w-3.5 text-orange-600 shrink-0" />
                        ) : (
                          <Square className="mr-2 h-3.5 w-3.5 text-black/40 shrink-0" />
                        )}
                        仅显示已销料的数据
                      </Button>
                    </div>
                  </>
                )}
                <Separator />
                <div className="p-2 space-y-1 bg-orange-50/50 rounded-md mx-1 my-2 border border-orange-100">
                  <div className="text-xs flex justify-between items-center text-orange-900">
                    <span className="font-bold">销料总计</span>
                    <span className="font-mono bg-orange-200 px-1.5 rounded">{colTotal}</span>
                  </div>
                  {unmatchedTypes > 0 && (
                    <div className="text-[10px] text-red-600 mt-1 leading-tight">
                      未匹配警告: <span className="font-bold">{unmatchedTypes}</span> 种型号/颜色未能在销料表中找到对应数据，合计漏掉 <span className="font-bold">{unmatchedTotalQty}</span> 支。
                    </div>
                  )}
                </div>
                <Separator />
                <div className="flex flex-col gap-1 p-1">
                  {onOpenRename && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="justify-start font-normal h-8" 
                      onClick={() => { 
                        setIsOpen(false);
                        onOpenRename(orderCol.id, orderCol.name); 
                      }}
                    >
                      <Edit2 className="mr-2 h-3.5 w-3.5 text-black/40" /> 重命名单号
                    </Button>
                  )}
                  {onOpenRemark && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="justify-start font-normal h-8" 
                      onClick={() => { 
                        setIsOpen(false);
                        onOpenRemark(orderCol.id, orderCol.remark || ""); 
                      }}
                    >
                      <ClipboardList className="mr-2 h-3.5 w-3.5 text-black/40" /> {orderCol.remark ? "修改备注" : "添加备注"}
                    </Button>
                  )}
                  {onReimport && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="justify-start font-normal h-8" 
                      onClick={() => { 
                        setIsOpen(false);
                        onReimport(orderCol.id, orderCol.name); 
                      }}
                    >
                      <ClipboardPaste className="mr-2 h-3.5 w-3.5 text-black/40" /> 重新导入匹配套裁单
                    </Button>
                  )}
                  {onOpenImportOther && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="justify-start font-normal h-8" 
                      onClick={() => { 
                        setIsOpen(false);
                        onOpenImportOther(orderCol.id); 
                      }}
                    >
                      <ClipboardPaste className="mr-2 h-3.5 w-3.5 text-black/40" /> 导入其他套裁单
                    </Button>
                  )}
                  {onOpenDelete && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="justify-start font-normal h-8 text-red-500 hover:text-red-600 hover:bg-red-50" 
                      onClick={() => { 
                        setIsOpen(false);
                        onOpenDelete(orderCol.id); 
                      }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> 删除该单号
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-orange-400/50 group-hover/head:bg-black/10 transition-colors z-10" 
        onMouseDown={(e) => onStartResizing(widthKey, e)} 
      />
    </th>
  );
});
