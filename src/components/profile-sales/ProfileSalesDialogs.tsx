import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, ChevronUp, ChevronDown } from "lucide-react";
import { SavedPlan } from "../../lib/optimizer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProfileSalesDialogsProps {
  renameColId: string | null;
  setRenameColId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (val: string) => void;
  onRenameConfirm: (colId: string, name: string) => void;

  importOrderColId: string | null;
  setImportOrderColId: (id: string | null) => void;
  importSelectedPlanId: string;
  setImportSelectedPlanId: (id: string) => void;
  savedPlans: SavedPlan[];
  onImportPlanUsage: () => void;

  colToDelete: string | null;
  setColToDelete: (id: string | null) => void;
  onDeleteConfirm: (colId: string) => void;

  mismatchData: { planId: string, colId?: string, unmatchedCount: number, matchedCount: number } | null;
  setMismatchData: (data: any) => void;
  onMismatchConfirm: () => void;
  onMismatchCancel: () => void;

  addOrderDialogOpen: boolean;
  setAddOrderDialogOpen: (open: boolean) => void;
  onAddEmptyColumn: () => void;
  onAddFromPlan: (planId: string) => void;

  sortPriorityDialogData: { 
    type?: 'import' | 'refresh' | 'digest';
    planId?: string; 
    colId?: string; 
    priority: string[]; 
    checked: string[];
    title?: string;
    description?: string;
    confirmText?: string;
  } | null;
  setSortPriorityDialogData: (data: any) => void;
  onPriorityConfirm: (planId?: string, colId?: string, priority?: string[], checked?: string[], type?: 'import' | 'refresh' | 'digest') => void;
  onPriorityCancel: (cancelAll?: boolean) => void;
  importQueueLength?: number;

  remarkColId: string | null;
  setRemarkColId: (id: string | null) => void;
  remarkValue: string;
  setRemarkValue: (val: string) => void;
  onRemarkConfirm: (colId: string, remark: string) => void;
}

export function ProfileSalesDialogs({
  renameColId,
  setRenameColId,
  renameValue,
  setRenameValue,
  onRenameConfirm,

  importOrderColId,
  setImportOrderColId,
  importSelectedPlanId,
  setImportSelectedPlanId,
  savedPlans,
  onImportPlanUsage,

  colToDelete,
  setColToDelete,
  onDeleteConfirm,

  mismatchData,
  setMismatchData,
  onMismatchConfirm,
  onMismatchCancel,

  addOrderDialogOpen,
  setAddOrderDialogOpen,
  onAddEmptyColumn,
  onAddFromPlan,

  sortPriorityDialogData,
  setSortPriorityDialogData,
  onPriorityConfirm,
  onPriorityCancel,
  importQueueLength,

  remarkColId,
  setRemarkColId,
  remarkValue,
  setRemarkValue,
  onRemarkConfirm,
}: ProfileSalesDialogsProps) {
  return (
    <>
      {/* Rename Dialog */}
      <Dialog open={!!renameColId} onOpenChange={(open) => { if (!open) setRenameColId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>重命名单号</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="请输入新的单号名称..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onRenameConfirm(renameColId!, renameValue);
                  setRenameColId(null);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameColId(null)}>取消</Button>
            <Button onClick={() => { onRenameConfirm(renameColId!, renameValue); setRenameColId(null); }} className="bg-black text-white hover:bg-black/90">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import from plan dialog */}
      <Dialog open={!!importOrderColId && !mismatchData} onOpenChange={(open) => { if (!open) setImportOrderColId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>从套裁单导入用量</DialogTitle>
            <DialogDescription>
              选择一个已保存的套裁单。系统将根据“型号”、“颜色”和“定尺”进行匹配，并将对应的原材料使用量填入该单号列。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Select value={importSelectedPlanId} onValueChange={setImportSelectedPlanId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择一个套裁单" />
              </SelectTrigger>
              <SelectContent>
                {savedPlans.length === 0 ? (
                  <div className="text-center p-4 text-xs tracking-wider text-black/40">暂无已保存的套裁单</div>
                ) : (
                  savedPlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOrderColId(null)}>取消</Button>
            <Button onClick={onImportPlanUsage} disabled={!importSelectedPlanId} className="bg-black text-white hover:bg-black/90">确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Column Dialog */}
      <Dialog open={!!colToDelete} onOpenChange={(open) => { if (!open) setColToDelete(null); }}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-red-600">确认删除单号</DialogTitle>
            <DialogDescription>
              确定要删除该单号及其所有的销料记录吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setColToDelete(null)}>取消</Button>
            <Button onClick={() => onDeleteConfirm(colToDelete!)} className="bg-red-600 text-white hover:bg-red-700">删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mismatch Dialog */}
      <Dialog open={!!mismatchData} onOpenChange={(open) => { if (!open) onMismatchCancel(); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>部分数据未匹配</DialogTitle>
            <DialogDescription>
              该套裁单中有 <strong className="text-orange-600 font-bold">{mismatchData?.unmatchedCount}</strong> 种材料（型号+长度+颜色）在当前销料表中找不到对应的记录匹配。<br/>
              已匹配的材料有 <strong className="text-green-600 font-bold">{mismatchData?.matchedCount}</strong> 种。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 text-sm text-black/70">
            是否忽略未匹配的项，继续导入已匹配的数据？
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onMismatchCancel}>取消导入</Button>
            <Button onClick={onMismatchConfirm} className="bg-orange-600 text-white hover:bg-orange-700">忽略未匹配并继续</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Order Dialog */}
      <Dialog open={addOrderDialogOpen} onOpenChange={setAddOrderDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新建单号</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-4">
            <Button
              variant="outline"
              className="justify-start h-12 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200"
              onClick={() => {
                onAddEmptyColumn();
                setAddOrderDialogOpen(false);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建空单号 (手动录入)
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/10" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-black/40">或者</span></div>
            </div>
            <Select 
              onValueChange={(val) => {
                setAddOrderDialogOpen(false);
                onAddFromPlan(val as string);
              }}
            >
              <SelectTrigger className="h-12 border-black/10">
                <SelectValue placeholder="新建并从套裁单导入..." />
              </SelectTrigger>
              <SelectContent>
                {savedPlans.length === 0 ? (
                  <div className="text-center p-4 text-xs tracking-wider text-black/40">暂无已保存的套裁单</div>
                ) : (
                  savedPlans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>

      {/* Priority Dialog */}
      <Dialog open={!!sortPriorityDialogData} onOpenChange={(open) => { if (!open) onPriorityCancel(); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{sortPriorityDialogData?.title || "选择并排序要销料的单号"}</DialogTitle>
            <DialogDescription>
              {sortPriorityDialogData?.description || "支持复选、排序、置顶和置尾。勾选的单号参与销料，排列越靠上扣减优先级越高。"}
            </DialogDescription>
          </DialogHeader>

          {sortPriorityDialogData && (
            <div className="flex items-center justify-between pb-2 border-b border-black/5 mt-2">
              <div className="flex items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => {
                    setSortPriorityDialogData({
                      ...sortPriorityDialogData,
                      checked: [...sortPriorityDialogData.priority]
                    });
                  }}
                  className="text-xs text-orange-600 hover:text-orange-700 font-medium cursor-pointer"
                >
                  全选
                </button>
                <span className="text-black/10 text-xs">|</span>
                <button 
                  type="button" 
                  onClick={() => {
                    setSortPriorityDialogData({
                      ...sortPriorityDialogData,
                      checked: []
                    });
                  }}
                  className="text-xs text-black/50 hover:text-black font-medium cursor-pointer"
                >
                  全不选
                </button>
              </div>
              <div className="text-xs text-black/40">
                已勾选 {sortPriorityDialogData.checked.length} / {sortPriorityDialogData.priority.length} 个单号
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 py-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
            {sortPriorityDialogData?.priority.map((orderNum, idx) => {
              const isChecked = sortPriorityDialogData.checked.includes(orderNum);
              return (
                <div key={orderNum} className={cn(
                  "flex items-center gap-2 border rounded-md p-2 transition-colors",
                  isChecked ? "bg-orange-50/20 border-orange-200" : "bg-black/[0.01] border-black/5 opacity-60"
                )}>
                  <div className="flex items-center justify-center pl-1 pr-2">
                    <input 
                      type="checkbox" 
                      id={`chk-${orderNum}`}
                      checked={isChecked}
                      onChange={(e) => {
                        let newChecked: string[];
                        if (e.target.checked) {
                          newChecked = [...sortPriorityDialogData.checked, orderNum];
                        } else {
                          newChecked = sortPriorityDialogData.checked.filter(c => c !== orderNum);
                        }
                        setSortPriorityDialogData({ ...sortPriorityDialogData, checked: newChecked });
                      }}
                      className="h-4 w-4 rounded border-black/10 text-orange-600 focus:ring-orange-500 cursor-pointer"
                    />
                  </div>

                  <label htmlFor={`chk-${orderNum}`} className="flex-1 text-sm font-medium select-none cursor-pointer truncate">
                    {orderNum || '(空单号)'}
                  </label>

                  <div className="flex items-center gap-1 pl-2 border-l border-black/5 shrink-0">
                    <button 
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                          const newP = [...sortPriorityDialogData.priority];
                          [newP[idx], newP[idx - 1]] = [newP[idx - 1], newP[idx]];
                          setSortPriorityDialogData({ ...sortPriorityDialogData, priority: newP });
                      }}
                      title="上移"
                      className="p-1 rounded text-black/40 hover:text-orange-500 disabled:opacity-20 hover:bg-black/5 cursor-pointer"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </button>

                    <button 
                      type="button"
                      disabled={idx === sortPriorityDialogData.priority.length - 1}
                      onClick={() => {
                          const newP = [...sortPriorityDialogData.priority];
                          [newP[idx], newP[idx + 1]] = [newP[idx + 1], newP[idx]];
                          setSortPriorityDialogData({ ...sortPriorityDialogData, priority: newP });
                      }}
                      title="下移"
                      className="p-1 rounded text-black/40 hover:text-orange-500 disabled:opacity-20 hover:bg-black/5 cursor-pointer"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </button>

                    <button 
                      type="button"
                      disabled={idx === 0}
                      onClick={() => {
                          const newP = [...sortPriorityDialogData.priority];
                          const [removed] = newP.splice(idx, 1);
                          newP.unshift(removed);
                          setSortPriorityDialogData({ ...sortPriorityDialogData, priority: newP });
                      }}
                      className="text-xs px-1.5 py-1 rounded bg-black/5 hover:bg-orange-100 hover:text-orange-700 disabled:opacity-20 cursor-pointer transition-colors"
                    >
                      置顶
                    </button>

                    <button 
                      type="button"
                      disabled={idx === sortPriorityDialogData.priority.length - 1}
                      onClick={() => {
                          const newP = [...sortPriorityDialogData.priority];
                          const [removed] = newP.splice(idx, 1);
                          newP.push(removed);
                          setSortPriorityDialogData({ ...sortPriorityDialogData, priority: newP });
                      }}
                      className="text-xs px-1.5 py-1 rounded bg-black/5 hover:bg-orange-100 hover:text-orange-700 disabled:opacity-20 cursor-pointer transition-colors"
                    >
                      置尾
                    </button>
                  </div>
                </div>
              );
            })}
            {(!sortPriorityDialogData?.priority || sortPriorityDialogData.priority.length === 0) && (
              <div className="text-sm text-black/40 text-center py-4">无可用单号</div>
            )}
          </div>
          <DialogFooter className="flex items-center justify-between sm:justify-between w-full">
            {importQueueLength && importQueueLength > 1 && (!sortPriorityDialogData?.type || sortPriorityDialogData.type === 'import') ? (
              <div className="flex items-center gap-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={() => onPriorityCancel(true)}
                  className="text-black/50 hover:text-red-600 hover:bg-red-50 text-xs px-2 h-8"
                >
                  取消全部
                </Button>
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={() => onPriorityCancel(false)}
                >
                  取消此单
                </Button>
              </div>
            ) : (
              <Button 
                type="button"
                variant="outline" 
                onClick={() => onPriorityCancel(false)}
              >
                取消
              </Button>
            )}
            <Button onClick={() => {
               const data = sortPriorityDialogData!;
               setSortPriorityDialogData(null);
               onPriorityConfirm(data.planId, data.colId, data.priority, data.checked, data.type);
            }} className="bg-orange-500 text-white hover:bg-orange-600">
              {sortPriorityDialogData?.confirmText || "确认导入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remark Dialog */}
      <Dialog open={!!remarkColId} onOpenChange={(open) => { if (!open) setRemarkColId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑单号备注</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={remarkValue}
              onChange={(e) => setRemarkValue(e.target.value)}
              placeholder="请输入单号备注信息（例如：客户要求、交期、规格等）..."
              className="min-h-[100px]"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  onRemarkConfirm(remarkColId!, remarkValue);
                  setRemarkColId(null);
                  toast.success("备注保存成功");
                }
              }}
            />
            <div className="text-[10px] text-black/40 text-right">
              按 Ctrl+Enter 快速保存
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemarkColId(null)}>取消</Button>
            <Button onClick={() => { onRemarkConfirm(remarkColId!, remarkValue); setRemarkColId(null); toast.success("备注保存成功"); }} className="bg-black text-white hover:bg-black/90">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
