/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { 
  Scissors, 
  Package, 
  Settings as SettingsIcon, 
  Play, 
  Plus, 
  Trash2, 
  Download,
  Upload,
  Save,
  BarChart3,
  LayoutDashboard,
  Ruler,
  Sparkles,
  ArrowUp,
  ClipboardList,
  FolderOpen,
  FileText,
  Check
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { 
  DemandItem, 
  StockItem, 
  Settings, 
  OptimizationSummary,
  FixedLengthPlan,
  ProfileSalesItem,
  OrderColumn,
  SavedPlan,
  PurchaseItem
} from "./lib/optimizer.ts";
import { DemandTable } from "./components/DemandTable";
import { StockTable } from "./components/StockTable";
import { FixedLengthTable } from "./components/FixedLengthTable";
import { ProfileSalesTable } from "./components/ProfileSalesTable";
import { PurchaseManagement } from "./components/PurchaseManagement";
import { SettingsPanel } from "./components/SettingsPanel";
import { ProjectSettings } from "./components/ProjectSettings";
import { ResultsView } from "./components/ResultsView";
import { AIAdvisor } from "./components/AIAdvisor";
import { PlanManagement } from "./components/PlanManagement";
import { ChatMessage, AISuggestion } from "./services/aiService";

import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export default function App() {
  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [profileSales, setProfileSales] = useState<ProfileSalesItem[]>([]);
  const [profileSalesColumns, setProfileSalesColumns] = useState<OrderColumn[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savePlanDialogOpen, setSavePlanDialogOpen] = useState(false);
  const [savePlanName, setSavePlanName] = useState('');

  const [fixedPlans, setFixedPlans] = useState<Record<string, FixedLengthPlan>>({});

  const [settings, setSettings] = useState<Settings>({
    kerf: 5,
    trim: 10,
    timeoutMinutes: 10,
    algorithm: 'CG',
    prioritizeStock: true,
    strictOrderPriority: false,
    autoAdjustFixedLength: false,
    autoAdjustMode: 'efficiency',
    maxAutoLengthsCount: 6,
    modulusEnabled: false,
    modulusValue: 100,
    limitLengthEnabled: true,
    maxLength: 7000,
    minLength: 3000,
    usableOffcutLength: 1000,
    substituteColorsEnabled: false,
    substituteColorRules: [],
    printInfo: {
      project: '',
      orderNo: '',
      designer: '',
      reviewer: '',
      checker: '',
      auditor: '',
      craftsman: ''
    },
    ai: {
      enabled: true,
      provider: 'Gemini',
      apiKey: '',
      baseUrl: '',
      model: 'gemini-3-flash-preview'
    }
  });

  const [results, setResults] = useState<OptimizationSummary | null>(null);
  const [mainMode, setMainMode] = useState<'engineering' | 'optimization'>('engineering');
  const [activeEngTab, setActiveEngTab] = useState("purchase");
  const [activeOptTab, setActiveOptTab] = useState("demand");
  const activeTab = mainMode === 'engineering' ? activeEngTab : activeOptTab;
  const setActiveTab = (tab: string) => {
    if (['plan-management', 'sales', 'purchase', 'project-settings'].includes(tab)) {
      setActiveEngTab(tab);
    } else {
      setActiveOptTab(tab);
    }
  };
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const cancelRef = useRef<boolean>(false);

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Auto-load settings from "database" (localStorage)
  React.useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('wire-optimizer-settings');
      
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings);
          setSettings(prev => ({ 
            ...prev, 
            ...parsed,
            timeoutMinutes: (parsed.timeoutMinutes !== undefined && parsed.timeoutMinutes !== null && !isNaN(Number(parsed.timeoutMinutes))) 
              ? Number(parsed.timeoutMinutes) 
              : 10,
            ai: { ...prev.ai, ...(parsed.ai || {}) },
            printInfo: { ...prev.printInfo, ...(parsed.printInfo || {}) }
          }));
        } catch (e) {
          console.error("Failed to load settings from database", e);
        }
      } else {
        // Fallback for old AI settings save format
        const oldAISettings = localStorage.getItem('wire-optimizer-ai-settings');
        if (oldAISettings) {
          try {
            const parsed = JSON.parse(oldAISettings);
            setSettings(prev => ({ ...prev, ai: { ...prev.ai, ...parsed } }));
          } catch(e) {}
        }
      }
    } catch (e) {
      console.warn("localStorage is not available:", e);
    }

    setSettingsLoaded(true);
  }, []);

  // Save settings when they change, but ONLY AFTER initial load
  React.useEffect(() => {
    if (settingsLoaded && settings) {
      try {
        localStorage.setItem('wire-optimizer-settings', JSON.stringify(settings));
      } catch (e) {
        console.warn("Failed to save settings: localStorage is not available:", e);
      }
    }
  }, [settings, settingsLoaded]);

  // Automatically sync profileSales based on purchases at root App level with change detection
  React.useEffect(() => {
    const map = new Map<string, ProfileSalesItem>();
    
    purchases.forEach(pu => {
      const key = `${pu.profileName || ''}|${pu.model}|${pu.color}|${pu.length}|${pu.orderNumber}`;
        
      if (!map.has(key)) {
        map.set(key, {
           id: key,
           profileName: pu.profileName || '',
           model: pu.model,
           length: pu.length,
           color: pu.color,
           quantity: pu.quantity,
           orderNumber: pu.orderNumber,
           orders: {}
        });
      } else {
        map.get(key)!.quantity += pu.quantity;
      }
    });

    setProfileSales(prevData => {
      const newItems = Array.from(map.values());
      const prevDataMap = new Map<string, Record<string, number>>();
      prevData.forEach(p => prevDataMap.set(p.id, p.orders));
      
      let hasStructuralChanges = newItems.length !== prevData.length;
      if (!hasStructuralChanges) {
        for (let i = 0; i < newItems.length; i++) {
          const item = newItems[i];
          const prev = prevData[i];
          if (
            item.id !== prev.id ||
            item.quantity !== prev.quantity ||
            item.profileName !== prev.profileName ||
            item.model !== prev.model ||
            item.length !== prev.length ||
            item.color !== prev.color ||
            item.orderNumber !== prev.orderNumber
          ) {
            hasStructuralChanges = true;
            break;
          }
        }
      }

      if (!hasStructuralChanges) {
        return prevData;
      }

      newItems.forEach(item => {
        if (prevDataMap.has(item.id)) {
           item.orders = { ...prevDataMap.get(item.id)! };
        }
      });
      return newItems;
    });
  }, [purchases]);



  // Lifted AI state to prevent re-analysis on tab switch
  const [aiMessages, setAiMessages] = useState<ChatMessage[]>([]);
  const [aiLatestSuggestion, setAiLatestSuggestion] = useState<AISuggestion | null>(null);

  // Snapshot functionality to check if data is saved / unchanged
  const currentEngineeringSnapshot = useMemo(() => JSON.stringify({ purchases, profileSales, profileSalesColumns, savedPlans, printInfo: settings.printInfo }), [purchases, profileSales, profileSalesColumns, savedPlans, settings.printInfo]);
  const currentOptimizationSnapshot = useMemo(() => JSON.stringify({ demands, stocks, fixedPlans, settings, results }), [demands, stocks, fixedPlans, settings, results]);

  const [savedEngineeringSnapshot, setSavedEngineeringSnapshot] = useState<string>(currentEngineeringSnapshot);
  const [savedOptimizationSnapshot, setSavedOptimizationSnapshot] = useState<string>(currentOptimizationSnapshot);

  React.useEffect(() => {
    if (settingsLoaded) {
      setSavedOptimizationSnapshot(JSON.stringify({ demands, stocks, fixedPlans, settings, results }));
    }
  }, [settingsLoaded]);

  const engDirty = currentEngineeringSnapshot !== savedEngineeringSnapshot;
  const optDirty = currentOptimizationSnapshot !== savedOptimizationSnapshot;

  // Derive unique models from demands
  const uniqueModels = useMemo(() => {
    return Array.from(new Set(demands.map(d => d.model))).sort();
  }, [demands]);

  const handleOptimize = async (manualFixedPlans?: Record<string, FixedLengthPlan>) => {
    if (demands.length === 0) {
      toast.error("请输入下料数据");
      return;
    }
    
    cancelRef.current = false;
    setIsOptimizing(true);
    setProgress(0);
    setActiveTab("results");
    sessionStorage.removeItem(`resultsScrollY_current`);
    
    // Clear AI state for fresh analysis on next completion
    setAiMessages([]);
    setAiLatestSuggestion(null);

    const baseFixedPlans = manualFixedPlans || fixedPlans;
    const currentFixedPlans = { ...baseFixedPlans };
    
    uniqueModels.forEach(model => {
      if (!currentFixedPlans[model] || !currentFixedPlans[model].lengths || currentFixedPlans[model].lengths.every(l => l <= 0)) {
        currentFixedPlans[model] = { model, lengths: [6000, 0, 0, 0, 0, 0] };
      }
    });

    try {
      const response = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demands, stocks, fixedPlans: currentFixedPlans, settings, purchases })
      });
      
      const { taskId } = await response.json();
      setActiveTaskId(taskId);
      
      // Polling
      const poll = async () => {
        if (cancelRef.current) return;
        try {
          const res = await fetch(`/api/status/${taskId}`);
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          const task = await res.json();
          
          if (cancelRef.current) return;
          
          setProgress(task.progress || 0);
          
          if (task.status === 'completed') {
            setResults(task.result);
            if (task.result.adjustedFixedPlans) {
              setFixedPlans(task.result.adjustedFixedPlans);
            }
            setIsOptimizing(false);
            setActiveTaskId(null);
            toast.success("优化计算完成", {
              duration: Infinity,
              closeButton: true,
              description: "套裁结果已生成，可查看下料明细与汇总统计"
            });
          } else if (task.status === 'error') {
            setIsOptimizing(false);
            setActiveTaskId(null);
            if (task.error !== 'Optimization cancelled by user') {
              toast.error(`优化失败: ${task.error}`, {
                duration: Infinity,
                closeButton: true,
                description: "请检查下料尺寸、库存或定尺方案设置后重试"
              });
            }
          } else {
            // Processing or pending, keep polling
            setTimeout(poll, 800);
          }
        } catch (pollError) {
          if (cancelRef.current) return;
          console.error("Polling error:", pollError);
          // Retry a few times or stop after catastrophic failure
          setTimeout(poll, 2000); 
        }
      };
      
      poll();
    } catch (error) {
      setIsOptimizing(false);
      toast.error("无法连接到服务器", {
        duration: Infinity,
        closeButton: true,
        description: "网络连接异常或服务未响应，请稍后重试"
      });
    }
  };

  const handleStopOptimize = async () => {
    cancelRef.current = true;
    const taskIdToCancel = activeTaskId;
    setActiveTaskId(null);
    setIsOptimizing(false);
    setProgress(0);
    toast.info("已停止优化计算");

    if (taskIdToCancel) {
      try {
        await fetch(`/api/cancel/${taskIdToCancel}`, { method: 'POST' });
      } catch (e) {
        console.error("Cancel optimization error:", e);
      }
    }
  };

  const handleClearPlans = () => {
    if (confirm("确定要定尺方案恢复初始状态吗？")) {
      const defaultPlans: Record<string, FixedLengthPlan> = {};
      uniqueModels.forEach(model => {
        defaultPlans[model] = { model, lengths: [6000, 0, 0, 0, 0, 0] };
      });
      setFixedPlans(defaultPlans);
      toast.success("所有定尺方案已恢复为初始默认状态");
    }
  };

  const handleApplyAISuggestionsV2 = (
    newFixedPlans: Record<string, FixedLengthPlan> | null, 
    newSettings: Partial<Settings> | null
  ) => {
    let finalFixedPlans = { ...fixedPlans };
    let finalSettings = settings;

    if (newFixedPlans) {
      Object.entries(newFixedPlans).forEach(([model, plan]) => {
        // Do not overwrite if the existing plan for this model is pinned
        if (!finalFixedPlans[model]?.isPinned) {
          finalFixedPlans[model] = {
            ...(finalFixedPlans[model] || { model }),
            lengths: plan.lengths
          };
        }
      });
      setFixedPlans(finalFixedPlans);
    }

    if (newSettings) {
      finalSettings = {
        ...settings,
        ...newSettings,
        // Ensure nesting is preserved
        ai: settings.ai 
      };
      setSettings(finalSettings);
    }

    const changes = [];
    if (newFixedPlans) changes.push("定尺方案");
    if (newSettings) changes.push("切割参数");

    toast.info(`已应用 AI 建议的${changes.join('和')}，正在重新优化...`);
    
    // Trigger optimization with new data
    handleOptimize(finalFixedPlans);
  };

  const handleExport = () => {
    if (!results) {
      toast.error("没有可导出的结果");
      return;
    }

    let csvContent = "型材名称,型号,颜色,支数,定尺(米),利用率\n";
    results.summaries.forEach(s => {
      const matchPurchase = purchases.find(pur => pur.model === s.model && pur.color === s.color) || purchases.find(pur => pur.model === s.model);
      const profileName = matchPurchase?.profileName || "";
      const lenStr = typeof s.originalLength === 'number' ? (s.originalLength / 1000).toFixed(2) : s.originalLength;
      csvContent += `${profileName},${s.model},${s.color},${s.totalQuantity},${lenStr},${s.efficiency.toFixed(2)}%\n`;
    });

    csvContent += "\n下料清单\n";
    csvContent += "型材名称,型号,颜色,支数,定尺(米),类型,切割详情,料头(mm)\n";
    results.summaries.forEach(s => {
      const matchPurchase = purchases.find(pur => pur.model === s.model && pur.color === s.color) || purchases.find(pur => pur.model === s.model);
      const profileName = matchPurchase?.profileName || "";
      s.patterns.forEach(p => {
        const cuts = p.cuts.map(c => `${c.length}x${c.count}`).join(';');
        csvContent += `${profileName},${s.model},${s.color},${p.count},${(p.originalLength / 1000).toFixed(2)},${p.isFixed ? '定尺' : '库存'},"${cuts}",${p.waste}\n`;
      });
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `优化方案_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("方案已导出");
  };

  const updateFixedPlan = (model: string, plan: FixedLengthPlan) => {
    // Ensure at least one length is 6000 if it's a new plan
    const updatedPlan = {
      ...plan,
      lengths: plan.lengths.every(l => l === 0) ? [6000, 0, 0, 0, 0, 0] : plan.lengths
    };
    setFixedPlans(prev => ({
      ...prev,
      [model]: updatedPlan
    }));
  };

  const handleToggleAllLock = (lock: boolean) => {
    const updatedPlans = { ...fixedPlans };
    uniqueModels.forEach(model => {
      if (!updatedPlans[model]) {
        updatedPlans[model] = { model, lengths: [6000, 0, 0, 0, 0, 0] };
      }
      updatedPlans[model] = { ...updatedPlans[model], isPinned: lock };
    });
    setFixedPlans(updatedPlans);
    toast.success(lock ? "所有定尺方案已锁定" : "所有定尺方案已解锁");
  };

  const handleSaveToPlanManager = () => {
    if (!results) return;
    const defaultName = settings.printInfo?.orderNo || `套裁单_${new Date().toISOString().split('T')[0]}_${new Date().getHours()}-${new Date().getMinutes()}`;
    setSavePlanName(defaultName);
    setSavePlanDialogOpen(true);
  };

  const [duplicateConfirmSaveOpen, setDuplicateConfirmSaveOpen] = useState(false);

  const confirmSavePlan = () => {
    const name = savePlanName.trim();
    if (!results || !name) {
      toast.error("请输入有效的套裁单名称");
      return;
    }
    
    if (savedPlans.some(p => p.name === name)) {
      setDuplicateConfirmSaveOpen(true);
      return;
    }
    
    executeSavePlan(name);
  };

  const executeSavePlan = (name: string) => {
    const existingIdx = savedPlans.findIndex(p => p.name === name);
    if (existingIdx !== -1) {
      // 撤销原套裁单的所有记录
      handleDeletePlan(savedPlans[existingIdx].id, true);
      
      const newPlan: SavedPlan = {
         id: Math.random().toString(36).substr(2, 9),
         name: name,
         createdAt: new Date().toISOString(),
         results: results!,
         settingsSnapshot: settings
      };
      setSavedPlans(prev => [newPlan, ...prev]);
      toast.success("套裁单已被覆盖，且原同名套裁单的取料和销料记录已一并撤销");
    } else {
      const newPlan: SavedPlan = {
         id: Math.random().toString(36).substr(2, 9),
         name: name,
         createdAt: new Date().toISOString(),
         results: results!,
         settingsSnapshot: settings
      };
      setSavedPlans(prev => [newPlan, ...prev]);
      toast.success("已保存到套裁单管理！");
    }
    
    setSavePlanDialogOpen(false);
    setDuplicateConfirmSaveOpen(false);
  };

  const [pendingSalePlanIds, setPendingSalePlanIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [importPendingFile, setImportPendingFile] = useState<File | null>(null);
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [confirmNewProjectOpen, setConfirmNewProjectOpen] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState<string>("");
  const [currentOptimizationName, setCurrentOptimizationName] = useState<string>("");
  const [currentProjectHandle, setCurrentProjectHandle] = useState<any>(null);
  const [currentOptimizationHandle, setCurrentOptimizationHandle] = useState<any>(null);
  const [historyFolderOpen, setHistoryFolderOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  const loadHistoryList = async () => {
    try {
      const storageKey = mainMode === 'engineering' ? 'wire-optimizer-engineering-history' : 'wire-optimizer-optimization-history';
      let history = await get(storageKey) || [];
      
      // Migrate old localStorage data if needed
      let oldHistoryData = null;
      try {
        oldHistoryData = localStorage.getItem(storageKey);
      } catch (e) {}
      if (oldHistoryData && history.length === 0) {
        try {
          const parsed = JSON.parse(oldHistoryData);
          history = parsed.map((item: any) => ({ ...item, handle: null }));
          await set(storageKey, history);
        } catch (e) {}
      }

      const unique = [];
      const seen = new Set();
      for (const item of history) {
        if (!seen.has(item.name)) {
          unique.push(item);
          seen.add(item.name);
        }
      }
      setHistoryList(unique.slice(0, 10));
    } catch(e) {
      console.error("Failed to load history list:", e);
    }
  };

  const saveToHistory = async (filename: string, projectData: any, oldName: string, fileHandle: any = null) => {
    try {
      const storageKey = mainMode === 'engineering' ? 'wire-optimizer-engineering-history' : 'wire-optimizer-optimization-history';
      let history = await get(storageKey) || [];
      
      let targetId = Date.now().toString();
      if (oldName) {
        const existingIndex = history.findIndex((item: any) => 
          item.name === oldName || 
          item.name.replace(/\.[^/.]+$/, "") === oldName
        );
        if (existingIndex !== -1) {
          targetId = history[existingIndex].id;
        }
      } else {
        const existingIndex = history.findIndex((item: any) => item.name === filename);
        if (existingIndex !== -1) {
          targetId = history[existingIndex].id;
        }
      }

      const newRecord = {
        id: targetId,
        name: filename,
        data: fileHandle ? null : projectData, // Do not store payload if we have real file handle
        handle: fileHandle,
        timestamp: new Date().toISOString()
      };
      
      history = history.filter((item: any) => {
        const isMatchNew = item.name === filename;
        const isMatchOld = oldName ? (
          item.name === oldName || 
          item.name.replace(/\.[^/.]+$/, "") === oldName
        ) : false;
        return !isMatchNew && !isMatchOld;
      });
      
      const newHistory = [newRecord, ...history].slice(0, 10); // Keep last 10
      await set(storageKey, newHistory);
      setHistoryList(newHistory);
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  };

  const executeExport = async (forceName?: string, isSaveAs = false): Promise<boolean> => {
    let exportSettings = undefined;
    if (mainMode !== 'engineering') {
      const { ai, printInfo, ...restSettings } = settings as any;
      exportSettings = restSettings;
    }
    
    const projectData = mainMode === 'engineering' ? {
      version: '1.0',
      timestamp: new Date().toISOString(),
      purchases,
      profileSales,
      profileSalesColumns,
      savedPlans,
      printInfo: settings.printInfo
    } : {
      version: '1.0',
      timestamp: new Date().toISOString(),
      demands,
      stocks,
      fixedPlans,
      settings: exportSettings,
      results
    };
    
    const defaultSuggestedName = mainMode === 'engineering' 
      ? (currentProjectName ? `${currentProjectName}.wce` : `工程项目_${new Date().toISOString().split('T')[0]}.wce`)
      : (settings.printInfo?.orderNo ? `套裁单(${settings.printInfo.orderNo}).json` : (currentOptimizationName ? `${currentOptimizationName}.json` : `优化项目_${new Date().toISOString().split('T')[0]}.json`));

    const suggestedName = forceName || defaultSuggestedName;

    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    
      const fallbackDownload = (filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
      saveToHistory(filename, projectData, mainMode === 'engineering' ? filename.replace(/\.[^/.]+$/, "") : currentOptimizationName);
      if (mainMode === 'engineering') {
        setCurrentProjectName(filename.replace(/\.[^/.]+$/, ""));
        setSavedEngineeringSnapshot(currentEngineeringSnapshot);
      } else {
        setCurrentOptimizationName(filename.replace(/\.[^/.]+$/, ""));
        setSavedOptimizationSnapshot(currentOptimizationSnapshot);
      }
      toast.success(mainMode === 'engineering' ? "工程数据已保存导出！" : "数据已保存导出！");
      return true;
    };

    let result = false;
    if ('showSaveFilePicker' in window && window.self === window.top) {
      try {
        let handle = mainMode === 'engineering' ? currentProjectHandle : currentOptimizationHandle;
        let shouldShowPicker = !handle || isSaveAs;
        
        if (handle && !isSaveAs) {
          try {
            if ((await handle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
              const permission = await handle.requestPermission({ mode: 'readwrite' });
              if (permission !== 'granted') {
                shouldShowPicker = true;
              }
            }
          } catch(e) {
            shouldShowPicker = true;
          }
        }
        
        if (shouldShowPicker) {
          handle = await (window as any).showSaveFilePicker({
            id: mainMode === 'engineering' ? 'engineering-project' : 'optimization-project',
            suggestedName,
            types: [{
              description: mainMode === 'engineering' ? '工程文件 (.wce)' : '优化文件 (.json)',
              accept: { 'application/json': mainMode === 'engineering' ? ['.wce'] : ['.json'] }
            }]
          });
        }
        
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        saveToHistory(handle.name, projectData, mainMode === 'engineering' ? handle.name.replace(/\.[^/.]+$/, "") : currentOptimizationName, handle);
        if (mainMode === 'engineering') {
          setCurrentProjectName(handle.name.replace(/\.[^/.]+$/, ""));
          setCurrentProjectHandle(handle);
          setSavedEngineeringSnapshot(currentEngineeringSnapshot);
        } else {
          setCurrentOptimizationName(handle.name.replace(/\.[^/.]+$/, ""));
          setCurrentOptimizationHandle(handle);
          setSavedOptimizationSnapshot(currentOptimizationSnapshot);
        }
        toast.success(mainMode === 'engineering' ? "工程数据已保存导出！" : "数据已保存导出！");
        result = true;
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          result = fallbackDownload(suggestedName);
        } else {
          result = false;
        }
      }
    } else {
      result = fallbackDownload(suggestedName);
    }
    setConfirmExportOpen(false);
    return result;
  };

  const handleExportProject = () => {
    const defaultName = mainMode === 'engineering' 
      ? (currentProjectName ? `${currentProjectName}.wce` : `工程项目_${new Date().toISOString().split('T')[0]}.wce`)
      : (settings.printInfo?.orderNo ? `套裁单(${settings.printInfo.orderNo}).json` : (currentOptimizationName ? `${currentOptimizationName}.json` : `优化项目_${new Date().toISOString().split('T')[0]}.json`));

    if ('showSaveFilePicker' in window && window.self === window.top) {
      executeExport(defaultName); // Skip confirm dialog if using native save picker
    } else {
      setExportFileName(defaultName);
      setConfirmExportOpen(true);
    }
  };

  const handleSaveAsProject = () => {
    const defaultName = mainMode === 'engineering' 
      ? (currentProjectName ? `${currentProjectName}_副本.wce` : `工程项目_${new Date().toISOString().split('T')[0]}.wce`)
      : (settings.printInfo?.orderNo ? `套裁单(${settings.printInfo.orderNo})_副本.json` : (currentOptimizationName ? `${currentOptimizationName}_副本.json` : `优化项目_${new Date().toISOString().split('T')[0]}.json`));

    if ('showSaveFilePicker' in window && window.self === window.top) {
      executeExport(defaultName, true); // Force Save As
    } else {
      setExportFileName(defaultName);
      setConfirmExportOpen(true);
    }
  };

  const applyImportedData = (data: any) => {
    if (mainMode === 'engineering') {
       if (data.purchases) setPurchases(data.purchases);
       if (data.profileSales) setProfileSales(data.profileSales);
       if (data.profileSalesColumns) setProfileSalesColumns(data.profileSalesColumns);
       if (data.savedPlans) setSavedPlans(data.savedPlans);
       if (data.printInfo) setSettings(prev => ({ ...prev, printInfo: data.printInfo }));
       
       const newSnapshot = JSON.stringify({
          purchases: data.purchases || purchases,
          profileSales: data.profileSales || profileSales,
          profileSalesColumns: data.profileSalesColumns || profileSalesColumns,
          savedPlans: data.savedPlans || savedPlans,
          printInfo: data.printInfo || settings.printInfo
       });
       setSavedEngineeringSnapshot(newSnapshot);
       toast.success("工程数据导入成功！");
    } else {
       if (data.demands) setDemands(data.demands);
       if (data.stocks) setStocks(data.stocks);
       if (data.fixedPlans) setFixedPlans(data.fixedPlans);
       const newSettings = data.settings ? { ...data.settings, printInfo: settings.printInfo, ai: settings.ai } : settings;
       if (data.settings) {
          setSettings(newSettings);
       }
       if (data.results !== undefined) setResults(data.results);
       
       const newSnapshot = JSON.stringify({
          demands: data.demands || demands,
          stocks: data.stocks || stocks,
          fixedPlans: data.fixedPlans || fixedPlans,
          settings: newSettings,
          results: data.results !== undefined ? data.results : results
       });
       setSavedOptimizationSnapshot(newSnapshot);
       toast.success("套裁数据导入成功！");
    }
  };

  const executeImport = () => {
    if (!importPendingFile) return;
    const fileName = importPendingFile.name;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        applyImportedData(data);
        if (mainMode === 'engineering') {
          setCurrentProjectName(fileName.replace(/\.[^/.]+$/, ""));
        } else {
          setCurrentOptimizationName(fileName.replace(/\.[^/.]+$/, ""));
        }
      } catch (err) {
        toast.error("文件解析失败！");
      }
      setConfirmImportOpen(false);
      setImportPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(importPendingFile);
  };

  const handleImportProjectMain = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    if (e && e.target && e.target.files) {
      const file = e.target.files[0];
      if (!file) return;
      setImportPendingFile(file);
      setConfirmImportOpen(true);
      return;
    }
    
    loadHistoryList();
    setHistoryFolderOpen(true);
  };

  const createNewProject = async () => {
    setConfirmNewProjectOpen(true);
  };

  const clearProjectData = () => {
    if (mainMode === 'engineering') {
      setPurchases([]);
      setProfileSales([]);
      setProfileSalesColumns([]);
      setSavedPlans([]);
      setCurrentProjectName("");
      setCurrentProjectHandle(null);
      setSavedEngineeringSnapshot(JSON.stringify({ purchases: [], profileSales: [], profileSalesColumns: [], savedPlans: [], printInfo: settings.printInfo }));
    } else {
      setDemands([]);
      setStocks([]);
      setFixedPlans({});
      setResults(null);
      setSavedOptimizationSnapshot(JSON.stringify({ demands: [], stocks: [], fixedPlans: {}, settings, results: null }));
      setCurrentOptimizationName("");
      setCurrentOptimizationHandle(null);
    }
    toast.success(mainMode === 'engineering' ? "已创建新工程" : "已创建新套裁");
  };

  const handleCreateNewDirectly = () => {
    setConfirmNewProjectOpen(false);
    clearProjectData();
  };

  const handleCreateNewWithSave = async () => {
    const success = await executeExport();
    if (success) {
      clearProjectData();
      setConfirmNewProjectOpen(false);
    }
  };

  const handleHistoryItemClick = async (item: any) => {
    try {
      if (item.handle) {
        const handle = item.handle;
        if ((await handle.queryPermission({ mode: 'read' })) !== 'granted') {
          const permission = await handle.requestPermission({ mode: 'read' });
          if (permission !== 'granted') {
            toast.error("拒绝访问文件。");
            return;
          }
        }
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        applyImportedData(data);
        if (mainMode === 'engineering') {
          setCurrentProjectName(item.name.replace(/\.[^/.]+$/, ""));
          setCurrentProjectHandle(handle);
        } else {
          setCurrentOptimizationName(item.name.replace(/\.[^/.]+$/, ""));
          setCurrentOptimizationHandle(handle);
        }
        toast.success("已加载最新的本地文件内容");
      } else if (item.data) {
        applyImportedData(item.data);
        if (mainMode === 'engineering') {
          setCurrentProjectName(item.name.replace(/\.[^/.]+$/, ""));
        } else {
          setCurrentOptimizationName(item.name.replace(/\.[^/.]+$/, ""));
        }
        toast.success("已加载缓存的工程数据");
      }
      setHistoryFolderOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("读取文件失败，文件可能已被移动或删除。");
    }
  };

  const importFromLocalFile = async (startInHandle?: any) => {
    if ('showOpenFilePicker' in window && window.self === window.top) {
      try {
        const options: any = {
          types: [{
            description: mainMode === 'engineering' ? '工程文件 (.wce)' : '优化文件 (.json)',
            accept: { 'application/json': mainMode === 'engineering' ? ['.wce', '.json'] : ['.json'] }
          }]
        };
        if (startInHandle) {
          options.startIn = startInHandle;
        }
        
        const [handle] = await (window as any).showOpenFilePicker(options);
        const file = await handle.getFile();
        const text = await file.text();
        const data = JSON.parse(text);
        
        applyImportedData(data);
        if (mainMode === 'engineering') {
          setCurrentProjectName(handle.name.replace(/\.[^/.]+$/, ""));
          setCurrentProjectHandle(handle);
          saveToHistory(handle.name, data, "", handle);
        } else {
          setCurrentOptimizationName(handle.name.replace(/\.[^/.]+$/, ""));
          setCurrentOptimizationHandle(handle);
          saveToHistory(handle.name, data, "", handle);
        }
        setHistoryFolderOpen(false);
        toast.success("本地文件导入成功！");
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          toast.error("文件导入失败");
        }
      }
    } else {
      setHistoryFolderOpen(false);
      if (fileInputRef.current) fileInputRef.current.click();
    }
  };

  const handleDeletePlan = (planId: string, revokeRelated: boolean) => {
    const plan = savedPlans.find(p => p.id === planId);
    if (!plan) return;
    
    if (revokeRelated) {
       // Revoke sales column
       const columnMatch = profileSalesColumns.find(c => c.name === plan.name);
       if (columnMatch) {
         setProfileSalesColumns(prev => prev.filter(c => c.id !== columnMatch.id));
         setProfileSales(prev => prev.map(item => {
           const newOrders = { ...item.orders };
           delete newOrders[columnMatch.id];
           return { ...item, orders: newOrders };
         }));
       }
       
       // Revoke material fetch (purchases)
       setPurchases(prev => prev.filter(pur => 
         !pur.remarks.includes(`来自<${plan.name}>`) && 
         pur.orderNumber !== `料头(${plan.name})`
       ));
    }
    
    setSavedPlans(prev => prev.filter(p => p.id !== planId));
  };

  const handleRenamePlan = (planId: string, newName: string) => {
    const plan = savedPlans.find(p => p.id === planId);
    if (!plan) return;
    const oldName = plan.name;
    
    setSavedPlans(prev => {
      const filtered = prev.filter(p => p.id === planId || p.name !== newName);
      return filtered.map(p => p.id === planId ? { ...p, name: newName } : p);
    });
    setProfileSalesColumns(prev => prev.map(c => c.name === oldName ? { ...c, name: newName } : c));
    setPurchases(prev => prev.map(pur => {
      let updated = { ...pur };
      let changed = false;
      if (pur.orderNumber === `料头(${oldName})` || pur.orderNumber === '料头利用') {
        updated.orderNumber = `料头(${newName})`;
        changed = true;
      }
      if (pur.remarks && pur.remarks.includes(`来自<${oldName}>导入`)) {
        updated.remarks = pur.remarks.replace(`来自<${oldName}>导入`, `来自<${newName}>导入`);
        changed = true;
      }
      return changed ? updated : pur;
    }));
  };

  const handleSaleFromPlan = (planId: string) => {
    setPendingSalePlanIds([planId]);
    setMainMode('engineering');
    setActiveTab("sales");
  };

  const handleBatchSaleFromPlans = (planIds: string[]) => {
    setPendingSalePlanIds(planIds);
    setMainMode('engineering');
    setActiveTab("sales");
  };

  const handleUtilizeOffcuts = (planId: string) => {
    const plan = savedPlans.find(p => p.id === planId);
    if (!plan) return;
    const offcuts: PurchaseItem[] = [];
    const minLen = settings.usableOffcutLength || 1000;
    
    plan.results.summaries.forEach(s => {
      s.patterns.forEach(p => {
        if (p.waste >= minLen) {
           const purchaseMatch = purchases.find(pur => pur.model === s.model);
           const saleMatch = profileSales.find(sale => sale.model === s.model);
           
           let finalLength = p.waste;
           if (finalLength < 100) finalLength = Math.floor(finalLength * 100) / 100;
           else finalLength = Math.floor(finalLength / 10) * 10;
           
           offcuts.push({
             id: Math.random().toString(36).substring(2, 9),
             model: s.model,
             profileName: purchaseMatch?.profileName || saleMatch?.profileName || s.model,
             linearDensity: purchaseMatch?.linearDensity || 0,
             length: finalLength,
             quantity: p.count,
             color: s.color,
             orderNumber: `料头(${plan.name})`,
             remarks: `来自<${plan.name}>导入`
           });
        }
      });
    });
    
    if (offcuts.length === 0) {
       toast.info(`该套裁单没有找到大于等于 ${minLen}mm 的可利用料头`);
       return;
    }
    
    const alreadyImported = purchases.some(pur => 
      pur.remarks.includes(`来自<${plan.name}>`) || 
      pur.orderNumber === `料头(${plan.name})`
    );
    if (alreadyImported) {
       if (!confirm("已经从此套裁单导入过料头，是否重复导入？")) {
         return;
       }
    }
    
    setPurchases(prev => [...prev, ...offcuts]);
    toast.success(`成功导入 ${offcuts.length} 条可利用料头数据到采购单管理`);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans selection:bg-orange-100 selection:text-orange-900">
      
      <Dialog open={historyFolderOpen} onOpenChange={setHistoryFolderOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mainMode === 'engineering' ? '本地工程历史记录' : '本地套裁历史记录'}</DialogTitle>
            <DialogDescription>
              {mainMode === 'engineering' ? '选择本地缓存的工程继续工作，或从本地文件导入新工程。' : '选择本地缓存的套裁继续工作，或从本地文件导入新的优化结果。'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
            {historyList.length > 0 ? (
              <div className="grid gap-2 mt-4">
                {historyList.map(item => (
                  <Button 
                    key={item.id} 
                    variant="outline" 
                    className="justify-start text-left h-auto py-3 px-4 flex flex-col items-start gap-1 relative w-full group"
                    onClick={() => handleHistoryItemClick(item)}
                  >
                    <div className="font-semibold flex items-center justify-between w-full gap-2">
                      <span className="truncate">{item.name}</span>
                      {item.handle && (
                        <div 
                          className="text-black/40 hover:text-orange-600 p-1 flex-shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            importFromLocalFile(item.handle);
                          }}
                        >
                          <FolderOpen className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-black/40">保存时间: {new Date(item.timestamp).toLocaleString()}</div>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-sm text-black/50 py-8 text-center bg-black/5 rounded-lg">没有找到本地历史记录</div>
            )}
          </div>
          <DialogFooter className="flex items-center gap-2 mt-4">
             <Button variant="outline" className="flex-1" onClick={() => setHistoryFolderOpen(false)}>取消</Button>
             <Button className="flex-1 bg-orange-600 hover:bg-orange-700" onClick={() => importFromLocalFile()}>
               从本地文件导入
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认导入{mainMode === 'engineering' ? '工程项目' : '优化项目'}数据</DialogTitle>
            <DialogDescription>
              您即将导入 <strong className="text-orange-600">{mainMode === 'engineering' ? '工程项目(包含采购单、销料库、套裁汇总等)' : '优化项目(包含计算参数、源数据等)'}</strong>。
              <br/><br/>
              这会<strong className="text-red-500">覆盖并清空</strong>当前相关的所有数据，是否继续？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmImportOpen(false); setImportPendingFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }}>取消</Button>
            <Button onClick={executeImport} className="bg-orange-600">确认导入</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmExportOpen} onOpenChange={setConfirmExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认保存{mainMode === 'engineering' ? '工程项目' : '优化项目'}数据</DialogTitle>
            <DialogDescription>
              您即将把当前 <strong className="text-orange-600">{mainMode === 'engineering' ? '工程项目' : '优化项目'}</strong> 的数据导出保存到本地文件。
              <br/><br/>
              包含：{mainMode === 'engineering' ? '采购单、销料库、套裁汇总等' : '下料清单、原材料库、计算参数等数据'}。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Label>保存文件名格式</Label>
            <Input
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              placeholder="请输入文件名"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeExport(exportFileName);
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmExportOpen(false)}>取消</Button>
            <Button onClick={() => executeExport(exportFileName)} className="bg-orange-600 hover:bg-orange-700 text-white">确认保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmNewProjectOpen} onOpenChange={setConfirmNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>保存并新建{mainMode === 'engineering' ? '工程' : '套裁'}</DialogTitle>
            <DialogDescription>
              建议您在清空当前数据并新建前，先将当前 <strong className="text-orange-600">{mainMode === 'engineering' ? '工程数据' : '套裁数据'}</strong> 保存为本地文件。
              <br/><br/>
              操作后，当前所有表格及缓存将被<strong className="text-red-500">直接清空</strong>。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmNewProjectOpen(false)}>取消</Button>
            <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleCreateNewDirectly}>直接清空</Button>
            <Button onClick={handleCreateNewWithSave} className="bg-orange-600 hover:bg-orange-700 text-white">保存并清空</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-black/5 bg-white/80 backdrop-blur-md no-print">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white shadow-lg shadow-orange-200">
              <Scissors className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center">
                型材优化销料管理系统
                {currentProjectName && (
                  <span className="relative ml-3 mr-2 text-sm font-normal text-black/60 bg-black/5 px-2 py-1 rounded align-middle flex items-center gap-1">
                    <FolderOpen className="h-3 w-3" />{currentProjectName}
                    {currentEngineeringSnapshot === savedEngineeringSnapshot && (
                      <Check className="h-4 w-4 text-green-500 absolute -bottom-1.5 -right-1.5 bg-[#F5F5F4] rounded-full p-[1px] shadow-sm" strokeWidth={4} />
                    )}
                  </span>
                )}
                {currentOptimizationName && (
                  <span className="relative ml-1 text-sm font-normal text-orange-700 bg-orange-100 px-2 py-1 rounded align-middle flex items-center gap-1">
                    <FileText className="h-3 w-3" />{currentOptimizationName}
                    {currentOptimizationSnapshot === savedOptimizationSnapshot && (
                      <Check className="h-4 w-4 text-green-500 absolute -bottom-1.5 -right-1.5 bg-[#F5F5F4] rounded-full p-[1px] shadow-sm" strokeWidth={4} />
                    )}
                  </span>
                )}
              </h1>
              <p className="text-xs text-black/40 font-medium uppercase tracking-wider mt-0.5">Wire Cutting Optimizer v1.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 mr-2 no-print">
              <input type="file" accept=".json,.wce" ref={fileInputRef} className="hidden" onChange={handleImportProjectMain} />
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2 text-black/60 hidden md:flex" 
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              >
                <ArrowUp className="h-4 w-4" />
                快速到顶
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-black/60" onClick={createNewProject}>
                <Plus className="h-4 w-4" />
                {mainMode === 'engineering' ? '新建工程' : '新建套裁'}
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-black/60" onClick={() => handleImportProjectMain()}>
                <Upload className="h-4 w-4" />
                {mainMode === 'engineering' ? '导入工程' : '导入套裁'}
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-black/60" onClick={handleExportProject}>
                <Save className="h-4 w-4" />
                {mainMode === 'engineering' ? '保存工程' : '保存套裁'}
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-black/60" onClick={handleSaveAsProject}>
                <Save className="h-4 w-4" />
                另存为
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button  
                size="sm" 
                disabled={isOptimizing}
                className={cn(
                  "text-white shadow-lg gap-2",
                  isOptimizing 
                    ? "bg-orange-600/50 cursor-not-allowed" 
                    : "bg-orange-600 hover:bg-orange-700 shadow-orange-200"
                )}
                onClick={() => {
                  setMainMode('optimization');
                  setActiveTab('demand');
                  handleOptimize();
                }}
              >
                {isOptimizing ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    优化中 ({progress}%)
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    开始优化
                  </>
                )}
              </Button>
              {isOptimizing && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="shadow-lg gap-2"
                  onClick={handleStopOptimize}
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  停止优化
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-8 px-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <div className="sticky top-16 z-40 bg-[#F5F5F4]/90 backdrop-blur-md pt-4 pb-2 -mx-4 px-4 border-b border-black/5 no-print flex flex-col gap-4">
            <div id="mode-switcher" className="bg-black/5 p-1 rounded-xl inline-flex w-fit mx-auto sm:mx-0 flex-wrap sm:flex-nowrap">
              <button 
                 className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all", mainMode === 'engineering' ? "bg-white text-orange-600 shadow-sm" : "text-black/60 hover:text-black")}
                 onClick={() => {
                   setMainMode('engineering');
                 }}
              >
                工程项目 (列表&销料)
              </button>
              <button 
                 className={cn("px-6 py-2 rounded-lg text-sm font-bold transition-all", mainMode === 'optimization' ? "bg-white text-orange-600 shadow-sm" : "text-black/60 hover:text-black")}
                 onClick={() => {
                   setMainMode('optimization');
                 }}
              >
                优化项目 (计算排料)
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-x-auto custom-scrollbar">
              <TabsList id="optimization-tabs-list" className="bg-white border border-black/5 p-1 h-12 shadow-sm shrink-0">
              {mainMode === 'engineering' ? (
                <>
                  <TabsTrigger value="project-settings" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <SettingsIcon className="h-4 w-4" />
                    工程设置
                  </TabsTrigger>
                  <TabsTrigger value="purchase" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <ClipboardList className="h-4 w-4" />
                    采购单管理
                  </TabsTrigger>
                  <TabsTrigger value="sales" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <ClipboardList className="h-4 w-4" />
                    型材销料表
                  </TabsTrigger>
                  <TabsTrigger value="plan-management" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <FolderOpen className="h-4 w-4" />
                    套裁单管理
                  </TabsTrigger>
                </>
              ) : (
                <>
                  <TabsTrigger value="demand" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <Scissors className="h-4 w-4" />
                    下料清单
                  </TabsTrigger>
                  <TabsTrigger id="fixed-length-tab" value="fixed" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <Ruler className="h-4 w-4" />
                    定尺方案
                  </TabsTrigger>
                  <TabsTrigger value="stock" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <Package className="h-4 w-4" />
                    原材料库
                  </TabsTrigger>
                  <TabsTrigger value="settings" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <SettingsIcon className="h-4 w-4" />
                    参数设置
                  </TabsTrigger>
                  <TabsTrigger id="results-tab-trigger" value="results" className="gap-2 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700">
                    <BarChart3 className="h-4 w-4" />
                    优化结果
                  </TabsTrigger>
                  {settings.ai?.enabled && (
                    <TabsTrigger id="ai-advisor-tab-trigger" value="ai-report" className="gap-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700">
                      <Sparkles className="h-4 w-4" />
                      AI 智能分析
                    </TabsTrigger>
                  )}
                </>
              )}
            </TabsList>

            {activeTab === 'results' && results && (
              <div className="flex items-center gap-4 text-sm font-medium">
                <div className="flex flex-col">
                  <span className="text-black/40 text-[10px] uppercase tracking-wider">平均利用率</span>
                  <span className="text-orange-600 font-bold text-lg">{results.averageEfficiency.toFixed(1)}%</span>
                </div>
                <div className="w-px h-8 bg-black/10 flex-shrink-0" />
                <div className="flex flex-col">
                  <span className="text-black/40 text-[10px] uppercase tracking-wider">总废料</span>
                  <span className="font-bold text-lg">{(results.totalWaste / 1000).toFixed(2)} m</span>
                </div>
                <div className="w-px h-8 bg-black/10 flex-shrink-0" />
                <Button 
                  onClick={handleSaveToPlanManager} 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50"
                  title="将此次优化结果保存到套裁单管理列表中"
                >
                  <Save className="h-4 w-4" />
                  归档管理
                </Button>
              </div>
            )}
            </div>
          </div>

          <div className="print-flatten">
            <TabsContent value="project-settings" keepMounted className="mt-0">
              <ProjectSettings settings={settings} setSettings={setSettings} purchases={purchases} />
            </TabsContent>

            <TabsContent value="purchase" keepMounted className="mt-0">
              <PurchaseManagement data={purchases} setData={setPurchases} />
            </TabsContent>

            <TabsContent value="sales" keepMounted className="mt-0">
              <ProfileSalesTable 
                data={profileSales} 
                setData={setProfileSales} 
                stocks={stocks} 
                purchases={purchases}
                columns={profileSalesColumns} 
                setColumns={setProfileSalesColumns} 
                savedPlans={savedPlans}
                pendingSalePlanIds={pendingSalePlanIds}
                onClearPendingSales={() => setPendingSalePlanIds([])}
                settings={settings}
                setSettings={setSettings}
              />
            </TabsContent>

            <TabsContent value="plan-management" keepMounted className="mt-0">
              <PlanManagement 
                savedPlans={savedPlans} 
                setSavedPlans={setSavedPlans} 
                columns={profileSalesColumns} 
                salesData={profileSales}
                purchases={purchases}
                onSaleFromPlan={handleSaleFromPlan} 
                onBatchSaleFromPlans={handleBatchSaleFromPlans}
                onUtilizeOffcuts={handleUtilizeOffcuts}
                onDeletePlan={handleDeletePlan}
                onRenamePlan={handleRenamePlan}
                settings={settings}
                isActive={activeTab === 'plan-management'}
              />
            </TabsContent>

            <TabsContent value="demand" keepMounted className="mt-0">
              <DemandTable data={demands} setData={setDemands} purchases={purchases} />
            </TabsContent>

            <TabsContent value="fixed" keepMounted className="mt-0">
              <FixedLengthTable 
                models={uniqueModels} 
                plans={fixedPlans} 
                onUpdatePlan={updateFixedPlan}
                onClearPlans={handleClearPlans}
                onToggleAllLock={handleToggleAllLock}
                settings={settings}
                results={results}
                stocks={stocks}
              />
            </TabsContent>

            <TabsContent value="stock" keepMounted className="mt-0">
              <StockTable data={stocks} setData={setStocks} salesData={profileSales} purchases={purchases} settings={settings} />
            </TabsContent>

            <TabsContent value="settings" keepMounted className="mt-0">
              <SettingsPanel settings={settings} setSettings={setSettings} purchases={purchases} />
            </TabsContent>

            <TabsContent value="results" keepMounted className="mt-0">
              <ResultsView 
                summary={results} 
                settings={settings} 
                setSettings={setSettings}
                isOptimizing={isOptimizing}
                progress={progress}
                purchases={purchases}
                isActive={activeTab === 'results'}
              />
            </TabsContent>

            <TabsContent value="ai-report" keepMounted className="mt-0">
              <AIAdvisor 
                demands={demands} 
                stocks={stocks} 
                profileSales={profileSales}
                profileSalesColumns={profileSalesColumns}
                purchases={purchases}
                summary={results} 
                isOptimizing={isOptimizing}
                messages={aiMessages}
                setMessages={setAiMessages}
                latestSuggestion={aiLatestSuggestion}
                setLatestSuggestion={setAiLatestSuggestion}
                aiSettings={{
                  ...settings.ai, 
                  modulusEnabled: settings.modulusEnabled, 
                  modulusValue: settings.modulusValue || 100 
                }}
                currentSettings={{
                  kerf: settings.kerf,
                  trim: settings.trim,
                  algorithm: settings.algorithm as 'FFD' | 'CG',
                  prioritizeStock: settings.prioritizeStock
                }}
                fixedPlans={fixedPlans}
                onApplySuggestions={handleApplyAISuggestionsV2}
              />
            </TabsContent>
          </div>
        </Tabs>
      </main>

      <Toaster position="top-center" richColors closeButton />

      <Dialog open={duplicateConfirmSaveOpen} onOpenChange={setDuplicateConfirmSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>覆盖同名套裁单</DialogTitle>
            <DialogDescription>
              已存在名为 <strong className="text-orange-600">"{savePlanName}"</strong> 的套裁单。继续保存将导致旧数据被覆盖，是否确定？
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateConfirmSaveOpen(false)}>取消</Button>
            <Button onClick={() => executeSavePlan(savePlanName.trim())} className="bg-red-600 text-white hover:bg-red-700">确定覆盖</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={savePlanDialogOpen} onOpenChange={setSavePlanDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>保存套裁单</DialogTitle>
            <DialogDescription>
              请输入套裁单的名称，以便在套裁单管理中查找。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              value={savePlanName}
              onChange={(e) => setSavePlanName(e.target.value)}
              placeholder="例如：万科一期_20240320"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSavePlan();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSavePlanDialogOpen(false)}>取消</Button>
            <Button onClick={confirmSavePlan} className="bg-black text-white hover:bg-black/90">保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
