
import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FixedLengthPlan, Settings, OptimizationSummary, StockItem } from "../lib/optimizer";
import { Ruler, AlertCircle, RefreshCw, Pin, PinOff, PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface FixedLengthTableProps {
  models: string[];
  plans: Record<string, FixedLengthPlan>;
  onUpdatePlan: (model: string, plan: FixedLengthPlan) => void;
  onClearPlans?: () => void;
  onToggleAllLock?: (lock: boolean) => void;
  settings: Settings;
  results?: OptimizationSummary | null;
  stocks?: StockItem[];
}

export function FixedLengthTable({ 
  models, 
  plans, 
  onUpdatePlan, 
  onClearPlans, 
  onToggleAllLock,
  settings,
  results,
  stocks
}: FixedLengthTableProps) {
  const handleUpdateLength = (model: string, index: number, value: string) => {
    // Determine the baseline plan. If it doesn't exist, use the same default as the render logic
    const currentPlan = plans[model] || { 
      model, 
      lengths: [6000, 0, 0, 0, 0, 0] 
    };
    const newLengths = [...currentPlan.lengths];
    newLengths[index] = parseFloat(value) || 0;
    
    onUpdatePlan(model, {
      ...currentPlan,
      lengths: newLengths
    });
  };

  const handleUpdateTrim = (model: string, value: string) => {
    const currentPlan = plans[model] || { model, lengths: Array(6).fill(0) };
    onUpdatePlan(model, {
      ...currentPlan,
      trim: value === '' ? undefined : parseFloat(value) || 0
    });
  };

  const handleTogglePin = (model: string) => {
    const currentPlan = plans[model] || { model, lengths: [6000, 0, 0, 0, 0, 0] };
    onUpdatePlan(model, {
      ...currentPlan,
      isPinned: !currentPlan.isPinned
    });
  };

  // Calculate optimization rate per model for fixed length parts
  const getOptimizationRate = (model: string) => {
    if (!results || !results.summaries) return null;
    
    // Find all summaries for this model that are "fixed length"
    const fixedSummaries = results.summaries.filter(s => 
      s.model === model && 
      typeof s.originalLength === 'string' && 
      s.originalLength.includes('(定尺)')
    );

    if (fixedSummaries.length === 0) return null;

    // Calculate weighted average efficiency
    let totalCut = 0;
    let totalOriginal = 0;

    fixedSummaries.forEach(s => {
      s.patterns.forEach(p => {
        const patternCut = p.cuts.reduce((sum, c) => sum + c.length * c.count, 0);
        totalCut += patternCut * p.count;
        totalOriginal += p.originalLength * p.count;
      });
    });

    if (totalOriginal === 0) return null;
    return (totalCut / totalOriginal) * 100;
  };

  return (
    <Card className="border-black/5 shadow-sm overflow-hidden">
      <CardHeader className="bg-black/[0.01] border-b border-black/5 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
            <Ruler className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-lg">定尺方案</CardTitle>
            <CardDescription>为每个型号设置最多6种常用定尺长度，型号后可统一设置料头参数</CardDescription>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {onToggleAllLock && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onToggleAllLock(true)} 
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Pin className="h-4 w-4 mr-2" />
                全部锁定
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => onToggleAllLock(false)} 
                className="text-gray-500 border-gray-200 hover:bg-gray-50"
              >
                <PinOff className="h-4 w-4 mr-2" />
                全部解锁
              </Button>
            </>
          )}

          {onClearPlans && (
            <Button variant="outline" size="sm" onClick={onClearPlans} className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
              <RefreshCw className="h-4 w-4 mr-2" />
              清空/重置
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-black/[0.01]">
            <TableRow>
              <TableHead className="w-[200px]">材料型号 / 料头(mm)</TableHead>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <TableHead key={i} className="text-center border-l border-black/5">
                  定尺 {i} (mm)
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-black/40">
                  请先在“下料清单”中添加数据以自动获取型号
                </TableCell>
              </TableRow>
            ) : (
              models.map(model => {
                const plan: FixedLengthPlan = plans[model] || { 
                  model, 
                  lengths: [6000, 0, 0, 0, 0, 0] 
                };
                const optRate = getOptimizationRate(model);

                return (
                  <TableRow key={model}>
                    <TableCell className="bg-black/[0.01] p-2">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <button
                            type="button"
                            onClick={() => handleTogglePin(model)}
                            className={cn(
                              "font-bold text-sm px-1 py-0.5 cursor-pointer hover:bg-black/5 rounded group flex items-center gap-1.5 transition-colors text-left",
                              plan.isPinned ? "text-blue-600 bg-blue-50/50" : "text-black/80"
                            )}
                            title={plan.isPinned ? "点击解锁该型号定尺" : "点击锁定该型号定尺（禁止自动调整和采购单覆盖）"}
                          >
                            <span>{model}</span>
                            {plan.isPinned ? (
                              <span className="flex items-center gap-0.5 text-[10px] bg-blue-100 text-blue-700 px-1 py-0.2 rounded font-normal">
                                <Pin className="h-2.5 w-2.5" />
                                已锁定
                              </span>
                            ) : (
                              <PinOff className="h-3 w-3 text-black/20 group-hover:text-black/60" />
                            )}
                          </button>

                          {optRate !== null && (
                            <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full border border-green-100 font-medium shrink-0">
                              优化率: {optRate.toFixed(1)}%
                            </span>
                          )}
                        </div>
                        <Input 
                          type="number"
                          placeholder="料头(选填)"
                          className="h-7 text-[10px] border-black/10 bg-white focus:border-blue-500"
                          value={plan.trim ?? ''}
                          onChange={(e) => handleUpdateTrim(model, e.target.value)}
                        />
                      </div>
                    </TableCell>
                    {[0, 1, 2, 3, 4, 5].map(idx => {
                      const len = plan.lengths[idx] || 0;
                      const isModulusEnabled = settings.modulusEnabled;
                      const modulus = settings.modulusValue || 1;
                      const isInvalid = isModulusEnabled && len > 0 && len % modulus !== 0;

                      return (
                        <TableCell key={idx} className="p-2 border-l border-black/5">
                          <div className="relative">
                            <Input 
                              type="number"
                              placeholder="长度"
                              className={cn(
                                "h-9 text-xs border-black/5 transition-all text-center font-mono",
                                isInvalid ? "border-red-500 focus:border-red-500 bg-red-50 text-red-600" : "focus:border-blue-500"
                              )}
                              value={len || ''}
                              onChange={(e) => handleUpdateLength(model, idx, e.target.value)}
                              title={isInvalid ? `定尺长度必须是 ${modulus} 的倍数` : ""}
                            />
                            {isInvalid && (
                              <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white shadow-sm ring-2 ring-white">
                                <AlertCircle className="h-2.5 w-2.5" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
