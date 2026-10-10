import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, CalendarDays, Edit2, GripVertical, Play } from "lucide-react";
import { SavedPlan, OrderColumn, ProfileSalesItem, Settings, PurchaseItem } from "../lib/optimizer";
import { ResultsView } from "./ResultsView";
import { cn, useTableState } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface PlanManagementProps {
  savedPlans: SavedPlan[];
  setSavedPlans: React.Dispatch<React.SetStateAction<SavedPlan[]>>;
  columns: OrderColumn[];
  salesData: ProfileSalesItem[];
  purchases?: PurchaseItem[];
  onSaleFromPlan?: (planId: string) => void;
  onBatchSaleFromPlans?: (planIds: string[]) => void;
  onUtilizeOffcuts?: (planId: string) => void;
  onDeletePlan?: (planId: string, revokeRelated: boolean) => void;
  onRenamePlan?: (planId: string, newName: string) => void;
  settings: Settings;
  isActive?: boolean;
}

export const PlanManagement = React.memo(function PlanManagement({ savedPlans, setSavedPlans, columns, salesData, purchases = [], onSaleFromPlan, onBatchSaleFromPlans, onUtilizeOffcuts, onDeletePlan, onRenamePlan, settings, isActive }: PlanManagementProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useTableState<'name' | 'time' | 'status'>('plan_management_sort', 'time');

  // Rename states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // Drag states
  const [draggedPlanId, setDraggedPlanId] = useState<string | null>(null);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<{ id: string } | null>(null);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirmOpen({ id });
  };

  const executeDelete = (revokeRelated: boolean) => {
    if (!deleteConfirmOpen) return;
    const { id } = deleteConfirmOpen;
    if (onDeletePlan) {
       onDeletePlan(id, revokeRelated);
    } else {
       setSavedPlans(prev => prev.filter(p => p.id !== id));
    }
    if (selectedId === id) setSelectedId(null);
    setDeleteConfirmOpen(null);
  };

  const [duplicateConfirmRename, setDuplicateConfirmRename] = useState<{ id: string, name: string } | null>(null);

  const handleRename = (id: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
       setEditingId(null);
       return;
    }
    
    // Check if the name hasn't changed
    if (savedPlans.find(p => p.id === id)?.name === trimmedName) {
       setEditingId(null);
       return;
    }

    if (savedPlans.some(p => p.name === trimmedName)) {
       setDuplicateConfirmRename({ id, name: trimmedName });
       return;
    }

    if (onRenamePlan) {
      onRenamePlan(id, trimmedName);
    } else {
      setSavedPlans(prev => prev.map(p => p.id === id ? { ...p, name: trimmedName } : p));
    }
    setEditingId(null);
  };

  const executeRenameOverwrite = () => {
    if (!duplicateConfirmRename) return;
    const { id, name } = duplicateConfirmRename;
    
    const overwrittenPlan = savedPlans.find(p => p.name === name);
    if (overwrittenPlan && onDeletePlan) {
       onDeletePlan(overwrittenPlan.id, true);
    }

    if (onRenamePlan) {
      onRenamePlan(id, name);
    } else {
      setSavedPlans(prev => {
         const filtered = prev.filter(p => p.name !== name); // delete the old duplicated one
         return filtered.map(p => p.id === id ? { ...p, name } : p);
      });
    }
    setDuplicateConfirmRename(null);
    setEditingId(null);
    
    toast.success("套裁单已重命名，原同名套裁单的取料和销料记录已一并撤销");
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedPlanId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, dropPlanId: string) => {
    e.preventDefault();
    if (!draggedPlanId || draggedPlanId === dropPlanId) return;

    setSavedPlans(prev => {
      const draggedIndex = prev.findIndex(p => p.id === draggedPlanId);
      const dropIndex = prev.findIndex(p => p.id === dropPlanId);
      if (draggedIndex === -1 || dropIndex === -1) return prev;

      const newPlans = [...prev];
      const [draggedItem] = newPlans.splice(draggedIndex, 1);
      newPlans.splice(dropIndex, 0, draggedItem);
      return newPlans;
    });
    setDraggedPlanId(null);
  };

  const sortedPlans = useMemo(() => {
    let sorted = [...savedPlans];
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'time') {
      sorted.sort((a, b) => (new Date(b.createdAt || 0).getTime() || 0) - (new Date(a.createdAt || 0).getTime() || 0));
    } else if (sortBy === 'status') {
      const isSold = (p: SavedPlan) => columns && columns.some(c => c.name === p.name) ? 1 : 0;
      sorted.sort((a, b) => isSold(b) - isSold(a));
    }
    return sorted;
  }, [savedPlans, sortBy, columns]);

  const selectedPlan = savedPlans.find(p => p.id === selectedId);

  const handleBatchImport = () => {
    const unsoldIds = savedPlans.filter(p => !(columns && columns.some(c => c.name === p.name))).map(p => p.id);
    if (unsoldIds.length === 0) {
      toast.info("没有未销料单");
      return;
    }
    onBatchSaleFromPlans?.(unsoldIds);
    toast.success(`已导入 ${unsoldIds.length} 个套裁单`);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-220px)] min-h-[600px] print:block print:h-auto print:min-h-0 print:m-0 print:p-0">
      
      {duplicateConfirmRename && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
               <h3 className="text-lg font-bold mb-2">覆盖同名套裁单</h3>
               <p className="text-sm text-black/70 mb-6">
                 已存在名为 <strong className="text-orange-600">"{duplicateConfirmRename.name}"</strong> 的套裁单。继续重命名将删除原来的同名数据，是否确定？
               </p>
               <div className="flex justify-end gap-2">
                 <Button variant="outline" onClick={() => { setDuplicateConfirmRename(null); setEditingId(null); }}>取消</Button>
                 <Button className="bg-red-600 text-white hover:bg-red-700" onClick={executeRenameOverwrite}>确定覆盖</Button>
               </div>
            </div>
         </div>
      )}

      {deleteConfirmOpen && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-lg">
               <h3 className="text-lg font-bold mb-2">删除套裁单</h3>
               <p className="text-sm text-black/70 mb-6">
                 是否同时撤销该套裁单下的取料和销料记录？
               </p>
               <div className="flex justify-end gap-2">
                 <Button variant="outline" onClick={() => setDeleteConfirmOpen(null)}>取消</Button>
                 <Button className="bg-red-600/80 hover:bg-red-600 text-white" onClick={() => executeDelete(false)}>仅删除</Button>
                 <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => executeDelete(true)}>同时撤销</Button>
               </div>
            </div>
         </div>
      )}

      {/* Left: List */}
      <Card className="w-full lg:w-[30%] flex flex-col h-full bg-white shadow-sm border-black/5 no-print">
        <CardHeader className="pb-4 border-b border-black/5 shrink-0 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-lg">套裁单列表</CardTitle>
              <CardDescription>管理已保存的套裁方案</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                <SelectTrigger className="w-24 h-8 text-xs">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time">按时间</SelectItem>
                  <SelectItem value="name">按名称</SelectItem>
                  <SelectItem value="status">按状态</SelectItem>
                </SelectContent>
              </Select>
              {savedPlans.length > 0 && (
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8 text-black/40 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
                  onClick={() => {
                    if (confirm("确定要清空所有套裁单吗？此操作无法恢复！")) {
                       setSavedPlans([]);
                       setSelectedId(null);
                    }
                  }}
                  title="清空所有套裁单"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {savedPlans.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100 font-medium tracking-wide"
              onClick={handleBatchImport}
            >
              <Play className="h-3 w-3 mr-1.5 fill-current" />
              一键全部导入未销料单
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-2 overflow-y-auto grow custom-scrollbar">
          {sortedPlans.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-black/40 text-sm py-10">
              <FileText className="h-8 w-8 mb-2 opacity-20" />
              暂无保存的套裁单
            </div>
          ) : (
            <div className="space-y-1">
              {sortedPlans.map(plan => {
                const planCol = columns?.find(c => c.name === plan.name);
                const isSold = !!planCol;
                const isFetched = purchases.some(pur => 
                  pur.remarks.includes(`来自<${plan.name}>`) || 
                  pur.orderNumber === `料头(${plan.name})`
                );
                const isEditing = editingId === plan.id;
                
                let unmatchedTypes = 0;
                let unmatchedTotalQty = 0;

                if (isSold) {
                   plan.results.summaries.forEach(s => {
                     const hasExact = salesData.some(item => {
                       const amountInOrder = planCol ? (item.orders?.[planCol.id] || 0) : 0;
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
                         unmatchedTypes++;
                         unmatchedTotalQty += s.totalQuantity;
                     }
                   });
                }
                
                return (
                  <div
                    key={plan.id}
                    draggable={!isEditing}
                    onDragStart={(e) => handleDragStart(e, plan.id)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, plan.id)}
                    className={cn(
                      "w-full text-left flex items-center justify-between rounded-lg transition-colors border border-transparent group cursor-default",
                      selectedId === plan.id ? "bg-orange-50 border-orange-200" : "hover:bg-black/5"
                    )}
                  >
                    <div 
                      className="flex-grow min-w-0 flex items-center px-3 py-3"
                      onClick={() => !isEditing && setSelectedId(plan.id)}
                    >
                      <GripVertical className="h-4 w-4 text-black/20 shrink-0 mr-2 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100" />
                      <div className="overflow-hidden grow">
                        {isEditing ? (
                          <div className="flex items-center" onClick={e => e.stopPropagation()}>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              autoFocus
                              className="h-7 text-sm py-1 px-2"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleRename(plan.id, editName);
                                if (e.key === 'Escape') setEditingId(null);
                              }}
                              onBlur={() => handleRename(plan.id, editName)}
                            />
                          </div>
                        ) : (
                          <div className={cn(
                            "font-medium truncate flex items-center",
                            selectedId === plan.id ? "text-orange-900" : "text-black/80"
                          )}>
                            {plan.name}
                            <span className="ml-2 font-mono bg-blue-50 text-blue-700 text-[10px] px-1.5 py-0.5 rounded border border-blue-200/50" title="整体优化率">
                              {plan.results.averageEfficiency.toFixed(1)}%
                            </span>
                            {isFetched && (
                              <span 
                                className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 border bg-blue-100 text-blue-700 border-blue-200 cursor-default"
                                title="已导入料头到采购单"
                              >
                                已取料
                              </span>
                            )}
                            {isSold && (
                              <span 
                                className={cn(
                                  "ml-1.5 px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 border cursor-help",
                                  unmatchedTypes > 0 
                                    ? "bg-orange-100 text-orange-700 border-orange-200" 
                                    : "bg-green-100 text-green-700 border-green-200"
                                )}
                                title={unmatchedTypes > 0 ? `未销料数量: ${unmatchedTotalQty} 支，共 ${unmatchedTypes} 种型材` : `各型材数量全部匹配`}
                              >
                                {unmatchedTypes > 0 ? "部分销料" : "已销料"}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-1 text-[11px] text-black/40 mt-1">
                          <CalendarDays className="h-3 w-3 shrink-0" />
                          <span className="truncate">{new Date(plan.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    
                    {!isEditing && (
                      <div className="flex items-center shrink-0 pr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 mr-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            onUtilizeOffcuts?.(plan.id);
                          }}
                          title="导入料头到采购单"
                        >
                          <Play className="h-3 w-3 mr-1 fill-current" /> 取料
                        </Button>
                        {!isSold && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50 mr-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSaleFromPlan?.(plan.id);
                            }}
                          >
                            <Play className="h-3 w-3 mr-1 fill-current" /> 销料
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-black/40 hover:text-orange-600 hover:bg-orange-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditName(plan.name);
                            setEditingId(plan.id);
                          }}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-black/40 hover:text-red-500 hover:bg-red-50"
                          onClick={(e) => handleDeleteClick(plan.id, e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-xs text-black/40 text-center mt-3 px-2 pb-2 border-t pt-3">
            提示: 点击侧边栏【开始优化】出现结果后，可将其实时保存为套裁方案
          </div>
        </CardContent>
      </Card>

      {/* Right: Results Display */}
      <Card className="w-full lg:w-[70%] h-full bg-[#fcfcfc] shadow-sm border-black/5 flex flex-col print:w-full print:h-auto print:border-none print:shadow-none print:overflow-visible print:bg-white print:block print:p-0">
        {selectedPlan ? (
          <div className="grow p-4 custom-scrollbar overflow-y-auto print:overflow-visible print:h-auto print:p-0">
            <div className="mb-4 flex items-center justify-between border-b pb-4 no-print">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-orange-600" />
                {selectedPlan.name}
              </h2>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 gap-1 border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100"
                  onClick={() => onUtilizeOffcuts?.(selectedPlan.id)}
                >
                  <Play className="h-3 w-3 fill-current" />
                  料头利用
                </Button>
                <div className="text-sm text-black/50">
                  保存于: {new Date(selectedPlan.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <ResultsView 
              summary={selectedPlan.results} 
              settings={settings}
              isOptimizing={false}
              progress={100}
              salesData={salesData}
              columns={columns}
              planName={selectedPlan.name}
              hideReportConfigButton={true}
              isActive={isActive}
              purchases={purchases}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-black/40 gap-4">
            <FileText className="h-16 w-16 opacity-10" />
            <p>在左侧选择一个套裁单以查看结果详情</p>
          </div>
        )}
      </Card>
    </div>
  );
});
