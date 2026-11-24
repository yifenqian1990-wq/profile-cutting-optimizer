/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
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
  Check,
  ShieldCheck,
  Copy,
  ClipboardPaste,
  AlertTriangle,
  ExternalLink,
  Link2,
  History
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
import { ActivationScreen } from "./components/ActivationScreen";
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
import { Textarea } from "@/components/ui/textarea";

// 客户端诊断日志上报辅助函数
const reportClientLog = (level: 'info' | 'warn' | 'error', type: string, message: string, detail?: any, stack?: string) => {
  try {
    const payload = { level, type, message, detail, stack };
    fetch('/api/client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  } catch (_) {}
};

export default function App() {
  const [isAuthorized, setIsAuthorized] = useState<boolean>(true);
  const handleActivated = useCallback(() => {
    setIsAuthorized(true);
  }, []);

  const [demands, setDemands] = useState<DemandItem[]>([]);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [profileSales, setProfileSales] = useState<ProfileSalesItem[]>([]);
  const [profileSalesColumns, setProfileSalesColumns] = useState<OrderColumn[]>([]);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>([]);
  const [savePlanDialogOpen, setSavePlanDialogOpen] = useState(false);
  const [savePlanName, setSavePlanName] = useState('');

  const [currentProjectName, setCurrentProjectName] = useState<string>("");
  const [currentOptimizationName, setCurrentOptimizationName] = useState<string>("");
  const [currentProjectHandle, setCurrentProjectHandle] = useState<any>(null);
  const [currentOptimizationHandle, setCurrentOptimizationHandle] = useState<any>(null);
  const projectHandleRef = useRef<any>(null);
  const optimizationHandleRef = useRef<any>(null);

  const updateProjectHandle = useCallback((handle: any) => {
    projectHandleRef.current = handle;
    setCurrentProjectHandle(handle);
  }, []);

  const updateOptimizationHandle = useCallback((handle: any) => {
    optimizationHandleRef.current = handle;
    setCurrentOptimizationHandle(handle);
  }, []);

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

  const skipNextPurchaseSyncRef = useRef(false);

  // Automatically sync profileSales based on purchases at root App level with change detection
  React.useEffect(() => {
    if (skipNextPurchaseSyncRef.current) {
      skipNextPurchaseSyncRef.current = false;
      return;
    }

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

  // 全局前端错误捕获与自动上报
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      reportClientLog('error', 'GlobalError', event.message, { filename: event.filename, lineno: event.lineno, colno: event.colno }, event.error?.stack);
    };
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientLog('error', 'UnhandledRejection', typeof reason === 'string' ? reason : reason?.message || 'Promise Rejected', reason, reason?.stack);
    };
    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Lightweight revision tracking instead of expensive JSON.stringify
  const [engRev, setEngRev] = useState(0);
  const [savedEngRev, setSavedEngRev] = useState(0);
  const [optRev, setOptRev] = useState(0);
  const [savedOptRev, setSavedOptRev] = useState(0);

  const isEngDirty = engRev !== savedEngRev;
  const isOptDirty = optRev !== savedOptRev;

  const syncCleanEngRef = useRef(false);
  const syncCleanOptRef = useRef(false);

  // Track engineering changes
  const prevEngDeps = useRef({ purchases, profileSales, profileSalesColumns, savedPlans, printInfo: settings.printInfo });
  React.useEffect(() => {
    if (
      prevEngDeps.current.purchases !== purchases ||
      prevEngDeps.current.profileSales !== profileSales ||
      prevEngDeps.current.profileSalesColumns !== profileSalesColumns ||
      prevEngDeps.current.savedPlans !== savedPlans ||
      prevEngDeps.current.printInfo !== settings.printInfo
    ) {
      prevEngDeps.current = { purchases, profileSales, profileSalesColumns, savedPlans, printInfo: settings.printInfo };
      setEngRev(r => {
        const next = r + 1;
        if (syncCleanEngRef.current) {
          syncCleanEngRef.current = false;
          setSavedEngRev(next);
        }
        return next;
      });
    }
  }, [purchases, profileSales, profileSalesColumns, savedPlans, settings.printInfo]);

  // Track optimization changes
  const prevOptDeps = useRef({ demands, stocks, fixedPlans, settings, results });
  React.useEffect(() => {
    if (
      prevOptDeps.current.demands !== demands ||
      prevOptDeps.current.stocks !== stocks ||
      prevOptDeps.current.fixedPlans !== fixedPlans ||
      prevOptDeps.current.settings !== settings ||
      prevOptDeps.current.results !== results
    ) {
      prevOptDeps.current = { demands, stocks, fixedPlans, settings, results };
      setOptRev(r => {
        const next = r + 1;
        if (syncCleanOptRef.current) {
          syncCleanOptRef.current = false;
          setSavedOptRev(next);
        }
        return next;
      });
    }
  }, [demands, stocks, fixedPlans, settings, results]);

  React.useEffect(() => {
    if (settingsLoaded) {
      setSavedOptRev(optRev);
    }
  }, [settingsLoaded]);

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

  const handleClearPlans = useCallback(() => {
    if (confirm("确定要定尺方案恢复初始状态吗？")) {
      const defaultPlans: Record<string, FixedLengthPlan> = {};
      uniqueModels.forEach(model => {
        defaultPlans[model] = { model, lengths: [6000, 0, 0, 0, 0, 0] };
      });
      setFixedPlans(defaultPlans);
      toast.success("所有定尺方案已恢复为初始默认状态");
    }
  }, [uniqueModels]);

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

  const updateFixedPlan = useCallback((model: string, plan: FixedLengthPlan) => {
    // Ensure at least one length is 6000 if it's a new plan
    const updatedPlan = {
      ...plan,
      lengths: plan.lengths.every(l => l === 0) ? [6000, 0, 0, 0, 0, 0] : plan.lengths
    };
    setFixedPlans(prev => ({
      ...prev,
      [model]: updatedPlan
    }));
  }, []);

  const handleToggleAllLock = useCallback((lock: boolean) => {
    setFixedPlans(prev => {
      const updatedPlans = { ...prev };
      uniqueModels.forEach(model => {
        if (!updatedPlans[model]) {
          updatedPlans[model] = { model, lengths: [6000, 0, 0, 0, 0, 0] };
        }
        updatedPlans[model] = { ...updatedPlans[model], isPinned: lock };
      });
      return updatedPlans;
    });
    toast.success(lock ? "所有定尺方案已锁定" : "所有定尺方案已解锁");
  }, [uniqueModels]);

  const handleClearPendingSales = useCallback(() => {
    setPendingSalePlanIds([]);
  }, []);

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
  const dialogFileInputRef = useRef<HTMLInputElement>(null);
  // 本地文件绑定/救场助手弹窗状态（支持原生选择框 + 免弹窗拖放文件句柄）
  const [bindHelperOpen, setBindHelperOpen] = useState(false);
  const [bindHelperMode, setBindHelperMode] = useState<'bind' | 'save_abort'>('bind');
  const [bindHelperTargetItem, setBindHelperTargetItem] = useState<any>(null);
  const [bindHelperDroppedHandle, setBindHelperDroppedHandle] = useState<any>(null);
  const [bindHelperSuggestedName, setBindHelperSuggestedName] = useState<string>("");
  const [bindHelperDragOver, setBindHelperDragOver] = useState(false);
  const [bindHelperSubmitting, setBindHelperSubmitting] = useState(false);

  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [importPendingFile, setImportPendingFile] = useState<File | null>(null);
  const [importPendingData, setImportPendingData] = useState<any>(null);
  const [importPendingFileName, setImportPendingFileName] = useState<string>("");
  const [importPendingHandle, setImportPendingHandle] = useState<any>(null);
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [isSaveAsExport, setIsSaveAsExport] = useState(false);
  const [confirmNewProjectOpen, setConfirmNewProjectOpen] = useState(false);
  const [reenterOptimizationPlan, setReenterOptimizationPlan] = useState<SavedPlan | null>(null);
  const [historyFolderOpen, setHistoryFolderOpen] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [pasteImportOpen, setPasteImportOpen] = useState(false);
  const [pasteImportText, setPasteImportText] = useState("");

  const isInIframe = (() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();
  const isSecureContextEnv = typeof window !== 'undefined' ? Boolean(window.isSecureContext) : true;
  const canUseNativeFilePicker =
    typeof window !== 'undefined' &&
    !isInIframe &&
    typeof (window as any).showSaveFilePicker === 'function' &&
    typeof (window as any).showOpenFilePicker === 'function';

  const sanitizeFileName = (name: string) => {
    return name
      .replace(/[\x00-\x1f\\/:*?"<>|\r\n]+/g, "_")
      .replace(/^\.+|\.+$/g, "")
      .trim();
  };

  const ensureFileExtension = (name: string, ext: '.wce' | '.json') => {
    let cleaned = sanitizeFileName(name) || (ext === '.wce' ? '工程项目' : '优化项目');
    if (ext === '.json' && cleaned.toLowerCase().endsWith('.wce')) {
      cleaned = cleaned.replace(/\.wce$/i, '.json');
    } else if (ext === '.wce' && cleaned.toLowerCase().endsWith('.json')) {
      cleaned = cleaned.replace(/\.json$/i, '.wce');
    } else if (!cleaned.toLowerCase().endsWith(ext)) {
      cleaned = `${cleaned}${ext}`;
    }
    return cleaned;
  };

  const getDefaultFileName = (isSaveAs = false) => {
    const dateStr = new Date().toISOString().split('T')[0];
    if (mainMode === 'engineering') {
      const base = currentProjectName ? (isSaveAs ? `${currentProjectName}_副本` : currentProjectName) : `工程项目_${dateStr}`;
      return ensureFileExtension(base, '.wce');
    } else {
      const rawBase = currentOptimizationName
        ? (isSaveAs ? `${currentOptimizationName}_副本` : currentOptimizationName)
        : (settings.printInfo?.orderNo
          ? `套裁单(${settings.printInfo.orderNo})${isSaveAs ? '_副本' : ''}`
          : `优化项目_${dateStr}${isSaveAs ? '_副本' : ''}`);
      return ensureFileExtension(rawBase, '.json');
    }
  };

  const loadHistoryList = async () => {
    try {
      const storageKey = mainMode === 'engineering' ? 'wire-optimizer-engineering-history' : 'wire-optimizer-optimization-history';
      const rawHistory = await get(storageKey);
      let history = Array.isArray(rawHistory) ? rawHistory : [];
      
      // Migrate old localStorage data if needed
      let oldHistoryData = null;
      try {
        oldHistoryData = localStorage.getItem(storageKey);
      } catch (e) {}
      if (oldHistoryData && history.length === 0) {
        try {
          const parsed = JSON.parse(oldHistoryData);
          if (Array.isArray(parsed)) {
            history = parsed.map((item: any) => ({ ...item, handle: null }));
            await set(storageKey, history);
          }
        } catch (e) {}
      }

      const unique = [];
      const seen = new Set();
      for (const item of history) {
        if (item && item.name && !seen.has(item.name)) {
          unique.push(item);
          seen.add(item.name);
        }
      }
      setHistoryList(unique.slice(0, 10));
    } catch(e) {
      console.error("Failed to load history list:", e);
    }
  };

  const saveToHistory = async (
    filename: string,
    projectData: any,
    oldName: string,
    fileHandle: any = null,
    targetModeOverride?: 'engineering' | 'optimization'
  ) => {
    try {
      // 智能识别目标模式：避免导入或跨模式保存时，由于 React 状态异步导致存错 storageKey
      const effectiveMode = targetModeOverride || (() => {
        if (!projectData) return mainMode;
        const looksLikeOpt = Array.isArray(projectData.demands) || Array.isArray(projectData.stocks) || projectData.results !== undefined;
        const looksLikeEng = Array.isArray(projectData.purchases) || Array.isArray(projectData.profileSales) || Array.isArray(projectData.savedPlans);
        if (looksLikeOpt && !looksLikeEng) return 'optimization';
        if (looksLikeEng && !looksLikeOpt) return 'engineering';
        return mainMode;
      })();

      const storageKey = effectiveMode === 'engineering'
        ? 'wire-optimizer-engineering-history'
        : 'wire-optimizer-optimization-history';
      const rawHistory = await get(storageKey);
      let history = Array.isArray(rawHistory) ? rawHistory : [];
      
      let targetId = Date.now().toString();
      let preservedHandle = fileHandle;
      const cleanFilename = filename.replace(/\.[^/.]+$/, "");

      if (oldName) {
        const cleanOld = oldName.replace(/\.[^/.]+$/, "");
        const existingIndex = history.findIndex((item: any) => 
          item && (item.name === oldName || item.name.replace(/\.[^/.]+$/, "") === cleanOld)
        );
        if (existingIndex !== -1) {
          targetId = history[existingIndex].id;
          if (!preservedHandle && history[existingIndex].handle) {
            preservedHandle = history[existingIndex].handle;
          }
        }
      } else {
        const existingIndex = history.findIndex((item: any) => 
          item && (item.name === filename || item.name.replace(/\.[^/.]+$/, "") === cleanFilename)
        );
        if (existingIndex !== -1) {
          targetId = history[existingIndex].id;
          if (!preservedHandle && history[existingIndex].handle) {
            preservedHandle = history[existingIndex].handle;
          }
        }
      }

      const newRecord = {
        id: targetId,
        name: filename,
        data: projectData,
        handle: preservedHandle,
        timestamp: new Date().toISOString()
      };
      
      history = history.filter((item: any) => {
        if (!item || !item.name) return false;
        const itemClean = item.name.replace(/\.[^/.]+$/, "");
        const isMatchNew = item.name === filename || itemClean === cleanFilename;
        const isMatchOld = oldName ? (
          item.name === oldName || itemClean === oldName.replace(/\.[^/.]+$/, "")
        ) : false;
        return !isMatchNew && !isMatchOld;
      });
      
      const newHistory = [newRecord, ...history].slice(0, 10);
      try {
        await set(storageKey, newHistory);
        if (effectiveMode === mainMode) {
          setHistoryList(newHistory);
        }
      } catch (storageErr) {
        console.warn("存储完整工程数据超限，启用句柄优先轻量模式存储:", storageErr);
        // 关键安全守护：优先保留物理文件句柄 handle！绝不能因为数据大而丢掉 handle
        try {
          const lightweightRecord = { ...newRecord, data: preservedHandle ? null : projectData };
          const fallbackHistory = [lightweightRecord, ...history].slice(0, 10);
          await set(storageKey, fallbackHistory);
          if (effectiveMode === mainMode) {
            setHistoryList(fallbackHistory);
          }
        } catch (secondErr) {
          console.error("保存历史记录失败:", secondErr);
        }
      }
    } catch (e) {
      console.error("Failed to save history:", e);
    }
  };

  const openBindHelperDialog = (
    mode: 'bind' | 'save_abort',
    targetItem: any = null,
    suggestedName = ""
  ) => {
    setBindHelperMode(mode);
    setBindHelperTargetItem(targetItem);
    setBindHelperSuggestedName(suggestedName || targetItem?.name || getDefaultFileName(false));
    setBindHelperDroppedHandle(null);
    setBindHelperDragOver(false);
    setBindHelperSubmitting(false);
    setBindHelperOpen(true);
  };

  // 将任意有效的 FileSystemFileHandle 写入并绑定（供原生 Picker 与拖放绑定共用）
  const writeAndBindHandleToTarget = async (
    handle: any,
    targetItem: any = null,
    options?: { skipPermissionCheck?: boolean }
  ): Promise<boolean> => {
    if (!handle) return false;
    const toastId = toast.loading(`正在向本地文件写入并绑定句柄：${handle.name}...`);
    try {
      if (!targetItem) {
        const res = await silentSaveWithHandle(handle, {
          skipPermissionCheck: options?.skipPermissionCheck,
          silentToast: true
        });
        toast.dismiss(toastId);
        if (res.ok) {
          toast.success(`文件句柄绑定成功：${handle.name}（以后保存将直接原地更新）`);
          reportClientLog('info', 'BindHandle', `成功完成本地句柄绑定与写入: ${handle.name}`);
          await loadHistoryList();
          return true;
        }
        reportClientLog('warn', 'BindHandle', `句柄写入未成功: ${res.message}`);
        if (res.reason !== 'permission_denied') {
          alert(`【绑定受限】未能向该文件写入数据：\n${res.message || '请检查该文件是否被其他程序占用'}`);
        }
        return false;
      }

      // 升级缓存历史项：直接向选中/拖入句柄写入该历史项数据
      const isEng = (targetItem.data && (Array.isArray(targetItem.data.purchases) || Array.isArray(targetItem.data.savedPlans)))
        || String(targetItem.name || '').endsWith('.wce');

      if (!options?.skipPermissionCheck && typeof handle.queryPermission === 'function') {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
          perm = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
          toast.dismiss(toastId);
          alert("未获得对该本地文件的写入授权（请在浏览器顶部弹出的确认框中点击“允许/保存更改”）");
          return false;
        }
      }

      const dataToWrite = targetItem.data || buildCurrentProjectData();
      const jsonText = JSON.stringify(dataToWrite, null, 2);
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      const writable = await withSaveTimeout(handle.createWritable({ keepExistingData: false }), '打开文件写入流', 8000);
      await withSaveTimeout(writable.write(blob), '写入文件', 15000);
      await withSaveTimeout(writable.close(), '提交文件保存', 15000);

      await saveToHistory(handle.name, dataToWrite, targetItem.name, handle, isEng ? 'engineering' : 'optimization');

      const currentName = isEng ? currentProjectName : currentOptimizationName;
      if (
        currentName &&
        (currentName === String(targetItem.name || '').replace(/\.[^/.]+$/, "")
          || currentName === handle.name.replace(/\.[^/.]+$/, ""))
      ) {
        if (isEng) {
          updateProjectHandle(handle);
          setCurrentProjectName(handle.name.replace(/\.[^/.]+$/, ""));
          setSavedEngRev(engRev);
        } else {
          updateOptimizationHandle(handle);
          setCurrentOptimizationName(handle.name.replace(/\.[^/.]+$/, ""));
          setSavedOptRev(optRev);
        }
      }

      await loadHistoryList();
      toast.dismiss(toastId);
      toast.success(`文件句柄提交成功！历史记录已升级为本地文件：${handle.name}`);
      reportClientLog('info', 'BindCached', `成功升级历史记录为本地文件: ${handle.name}`);
      return true;
    } catch (err: any) {
      toast.dismiss(toastId);
      reportClientLog('error', 'BindHandle', `写入过程异常: ${err?.message}`, null, err?.stack);
      alert(`写入本地文件失败：\n${err?.message}`);
      return false;
    }
  };

  // 直接通过 showOpenFilePicker 选择并绑定已有文件（必须保持在点击事件同步调用链顶部）
  const pickExistingFileDirectly = async (targetItem: any = null, openHelperOnAbort = true) => {
    if (!canUseNativeFilePicker) {
      alert("当前浏览器环境未开放文件句柄权限（请确保在 Chrome/Edge 中且使用 https:// 独立标签页访问）");
      return false;
    }

    const startTime = Date.now();
    let handles: any[] | null = null;
    try {
      // 极简配置，不加 MIME/扩展名限制，直接调起原生选择框
      handles = await (window as any).showOpenFilePicker({ multiple: false });
    } catch (e: any) {
      const elapsed = Date.now() - startTime;
      const errName = e?.name || '';
      const errMsg = e?.message || '';
      if (errName === 'AbortError') {
        reportClientLog(
          'warn',
          targetItem ? 'BindCached' : 'BindHandle',
          `showOpenFilePicker 返回 AbortError (耗时 ${elapsed}ms, visibility=${document.visibilityState}, win=${window.innerWidth}x${window.innerHeight})`
        );
        if (openHelperOnAbort) {
          openBindHelperDialog('bind', targetItem, targetItem?.name || getDefaultFileName(false));
        }
        return false;
      }
      reportClientLog('error', 'BindHandle', `showOpenFilePicker 异常: ${errMsg}`, null, e?.stack);
      alert(`【调起文件窗口异常】\n类型: ${errName}\n原因: ${errMsg}`);
      return false;
    }

    if (!handles || !handles[0]) return false;
    const ok = await writeAndBindHandleToTarget(handles[0], targetItem);
    if (ok) setBindHelperOpen(false);
    return ok;
  };

  const bindCachedItemToLocalFile = async (item: any) => {
    reportClientLog('info', 'BindCached', `用户触发对缓存项绑定文件: ${item.name}`);
    await pickExistingFileDirectly(item, true);
  };

  const deleteHistoryItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const storageKey = mainMode === 'engineering' ? 'wire-optimizer-engineering-history' : 'wire-optimizer-optimization-history';
      const rawHistory = await get(storageKey);
      const history = Array.isArray(rawHistory) ? rawHistory : [];
      const updated = history.filter((item: any) => item && item.id !== itemId);
      await set(storageKey, updated);
      setHistoryList(updated.slice(0, 10));
      toast.success("已删除该本地缓存记录");
    } catch (err) {
      toast.error("删除缓存记录失败");
    }
  };

  const buildCurrentProjectData = () => {
    let exportSettings = undefined;
    if (mainMode !== 'engineering') {
      const { ai, printInfo, ...restSettings } = settings as any;
      exportSettings = restSettings;
    }

    return mainMode === 'engineering' ? {
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
  };

  const copyProjectDataToClipboard = async () => {
    const projectData = buildCurrentProjectData();
    const jsonText = JSON.stringify(projectData, null, 2);
    const ext = mainMode === 'engineering' ? '.wce' : '.json';
    const safeName = ensureFileExtension(exportFileName || getDefaultFileName(isSaveAsExport), ext);
    const oldNameForHistory = isSaveAsExport ? "" : (mainMode === 'engineering' ? currentProjectName : currentOptimizationName);

    let copied = false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(jsonText);
        copied = true;
      }
    } catch (e) {
      copied = false;
    }

    if (!copied) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = jsonText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e) {
        copied = false;
      }
    }

    if (copied) {
      await saveToHistory(safeName, projectData, oldNameForHistory, null);
      toast.success("保存成功");
      if (mainMode === 'engineering') {
        setCurrentProjectName(safeName.replace(/\.[^/.]+$/, ""));
        if (isSaveAsExport) updateProjectHandle(null);
        setSavedEngRev(engRev);
      } else {
        setCurrentOptimizationName(safeName.replace(/\.[^/.]+$/, ""));
        if (isSaveAsExport) updateOptimizationHandle(null);
        setSavedOptRev(optRev);
      }
      toast.success(`已复制完整 JSON 数据到剪贴板，可新建文本文件并保存为 ${safeName}`);
      setConfirmExportOpen(false);
    } else {
      toast.error("浏览器限制了剪贴板访问，请在新标签页独立打开后再试");
    }
  };

  const handlePasteImportSubmit = async () => {
    const trimmed = pasteImportText.trim();
    if (!trimmed) {
      toast.error("请先粘贴导出的 JSON 数据内容");
      return;
    }
    try {
      const data = JSON.parse(trimmed);
      if (validateAndApplyImportedData(data)) {
        const defaultName = getDefaultFileName(false);
        if (mainMode === 'engineering') {
          setCurrentProjectName(defaultName.replace(/\.[^/.]+$/, ""));
          updateProjectHandle(null);
        } else {
          setCurrentOptimizationName(defaultName.replace(/\.[^/.]+$/, ""));
          updateOptimizationHandle(null);
        }
        await saveToHistory(defaultName, data, "", null);
        setPasteImportText("");
        setPasteImportOpen(false);
        setHistoryFolderOpen(false);
      }
    } catch (err) {
      toast.error("解析失败，请确认粘贴的是完整的 JSON 数据！");
    }
  };

  const triggerBrowserDownload = (content: string, filename: string, ext?: '.wce' | '.json'): boolean => {
    try {
      const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return true;
    } catch (err) {
      console.error("Browser download failed:", err);
      return false;
    }
  };

  const executeExport = async (forceName?: string, isSaveAs = false, alsoDownloadToBrowser = true): Promise<boolean> => {
    try {
      const projectData = buildCurrentProjectData();
      const jsonText = JSON.stringify(projectData, null, 2);
      const ext = mainMode === 'engineering' ? '.wce' : '.json';
      const safeName = ensureFileExtension(forceName || getDefaultFileName(isSaveAs), ext);
      const oldNameForHistory = isSaveAs ? "" : (mainMode === 'engineering' ? currentProjectName : currentOptimizationName);

      const downloadTriggered = triggerBrowserDownload(jsonText, safeName, ext);
      if (!downloadTriggered) {
        toast.error("触发浏览器下载失败，请使用「复制 JSON 数据」备份或在新标签页打开");
        return false;
      }

      await saveToHistory(safeName, projectData, oldNameForHistory, null);
      if (mainMode === 'engineering') {
        setCurrentProjectName(safeName.replace(/\.[^/.]+$/, ""));
        if (isSaveAs) updateProjectHandle(null);
        setSavedEngRev(engRev);
      } else {
        setCurrentOptimizationName(safeName.replace(/\.[^/.]+$/, ""));
        if (isSaveAs) updateOptimizationHandle(null);
        setSavedOptRev(optRev);
      }

      setConfirmExportOpen(false);
      toast.success(`文件已下载：${safeName}`, {
        description: '请在浏览器下载目录中查看文件；普通导入的原文件不会被自动覆盖。'
      });
      return true;
    } catch (err: any) {
      console.error("Export failed:", err);
      toast.error(`保存文件失败：${err?.message || '数据序列化或下载异常'}`);
      return false;
    }
  };

  const withSaveTimeout = async <T,>(operation: Promise<T>, label: string, timeoutMs = 12000): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<T>((resolve, reject) => {
        timer = setTimeout(() => {
          const timeoutError: any = new Error(`${label}超时，请改用下载副本`);
          timeoutError.name = 'TimeoutError';
          reject(timeoutError);
        }, timeoutMs);
        operation.then(resolve, reject);
      });
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const silentSaveWithHandle = async (
    handle: any,
    options?: { skipPermissionCheck?: boolean; silentToast?: boolean }
  ): Promise<{ ok: boolean; reason?: 'permission_denied' | 'not_found' | 'error'; message?: string }> => {
    let writable: any = null;
    reportClientLog('info', 'SilentSave', `开始写入本地文件句柄: ${handle?.name || '未知文件'}`);
    try {
      if (!options?.skipPermissionCheck && typeof handle.queryPermission === 'function') {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
          perm = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
          reportClientLog('warn', 'SilentSave', `未获得本地文件写入权限: ${handle?.name}`);
          alert(`【保存受限】未获得本地文件写入权限（${handle?.name || '未知文件'}），请在浏览器地址栏下方弹出的授权提示中允许编辑文件。`);
          return { ok: false, reason: 'permission_denied', message: '未授予本地文件写入权限' };
        }
      }

      const projectData = buildCurrentProjectData();
      const jsonText = JSON.stringify(projectData, null, 2);
      const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
      reportClientLog('info', 'SilentSave', `数据序列化完成，准备写入流，体积: ${blob.size} 字节`);

      try {
        writable = await withSaveTimeout(handle.createWritable({ keepExistingData: false }), '打开文件写入流', 8000);
      } catch (cwErr: any) {
        reportClientLog('error', 'SilentSave', `createWritable 失败: ${cwErr?.message}`, null, cwErr?.stack);
        alert(`【保存失败诊断】打开文件流失败：\n类型: ${cwErr?.name}\n原因: ${cwErr?.message}\n请检查目标文件是否被其他软件占用或保存位置权限受限！`);
        throw cwErr;
      }

      try {
        await withSaveTimeout(writable.write(blob), '写入文件', 15000);
      } catch (wErr: any) {
        reportClientLog('error', 'SilentSave', `writable.write 失败: ${wErr?.message}`, null, wErr?.stack);
        alert(`【保存失败诊断】写入文件数据失败：\n类型: ${wErr?.name}\n原因: ${wErr?.message}`);
        throw wErr;
      }

      try {
        await withSaveTimeout(writable.close(), '提交文件保存', 15000);
        writable = null;
      } catch (clErr: any) {
        reportClientLog('error', 'SilentSave', `writable.close 失败: ${clErr?.message}`, null, clErr?.stack);
        alert(`【保存失败诊断】提交保存失败：\n类型: ${clErr?.name}\n原因: ${clErr?.message}`);
        throw clErr;
      }

      reportClientLog('info', 'SilentSave', `物理文件写入磁盘成功: ${handle?.name}`);

      // 本地物理文件已保存成功！立即更新当前工程状态与版本号
      const safeName = handle.name || getDefaultFileName(false);
      const oldName = mainMode === 'engineering' ? currentProjectName : currentOptimizationName;

      if (mainMode === 'engineering') {
        setCurrentProjectName(safeName.replace(/\.[^/.]+$/, ""));
        updateProjectHandle(handle);
        setSavedEngRev(engRev);
      } else {
        setCurrentOptimizationName(safeName.replace(/\.[^/.]+$/, ""));
        updateOptimizationHandle(handle);
        setSavedOptRev(optRev);
      }

      // 等待历史记录写入 IndexedDB，确保随后刷新历史列表能立即看到绿色“本地文件”标识
      try {
        await saveToHistory(safeName, projectData, oldName, handle);
        reportClientLog('info', 'SilentSave', `历史记录更新成功: ${safeName}`);
      } catch (histErr: any) {
        reportClientLog('warn', 'SilentSave', `历史记录更新失败（不影响本地文件已保存）: ${histErr?.message}`);
      }

      return { ok: true };
    } catch (err: any) {
      if (writable) {
        try {
          await writable.abort();
        } catch (_) {}
      }
      reportClientLog('error', 'SilentSave', `写入本地文件异常终止: ${err?.message}`, null, err?.stack);
      console.error("Silent save to handle failed:", err);
      if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
        return { ok: false, reason: 'permission_denied', message: err?.message || '文件写入权限被拒绝' };
      }
      if (err?.name === 'NotFoundError') {
        return { ok: false, reason: 'not_found', message: '原本地文件不存在或已被移动' };
      }
      return { ok: false, reason: 'error', message: err?.message || '写入本地文件失败' };
    }
  };

  const pickAndSaveWithNativePicker = async (
    isSaveAs: boolean,
    customSuggestedName?: string
  ): Promise<'saved' | 'cancelled' | 'failed' | 'downloaded'> => {
    const isEng = mainMode === 'engineering';
    const ext = isEng ? '.wce' : '.json';
    const suggestedName = customSuggestedName
      ? ensureFileExtension(customSuggestedName, ext)
      : getDefaultFileName(isSaveAs);

    if (!canUseNativeFilePicker) {
      toast.info("当前浏览器环境未开放本地文件句柄权限，为您直接下载文件副本");
      await executeExport(suggestedName, isSaveAs, true);
      return 'downloaded';
    }

    let handle: any = null;
    const pickerStartTime = Date.now();

    try {
      // 必须保持最纯净的同步调用链直接调起，严禁在调起前插入异步网络请求避免消耗用户手势！
      const pickerOptions: any = {
        suggestedName,
        types: [
          {
            description: isEng ? '工程项目文件 (*.wce)' : '套裁优化文件 (*.json)',
            accept: isEng
              ? { 'application/json': ['.wce'], 'application/octet-stream': ['.wce'] }
              : { 'application/json': ['.json'] }
          }
        ],
        excludeAcceptAllOption: false
      };
      handle = await (window as any).showSaveFilePicker(pickerOptions);
    } catch (e: any) {
      const elapsed = Date.now() - pickerStartTime;
      const errName = e?.name || '';
      const errMsg = e?.message || '';
      reportClientLog(
        'warn',
        'PickAndSave',
        `showSaveFilePicker 结果: ${errName} - ${errMsg} (耗时 ${elapsed}ms, visibility=${document.visibilityState}, win=${window.innerWidth}x${window.innerHeight})`
      );

      if (errName === 'AbortError') {
        // 打开救场/拖放绑定助手弹窗（不丢失用户手势，提供改名另存、下载副本、拖放绑定）
        openBindHelperDialog('save_abort', null, suggestedName);
        return 'cancelled';
      }

      console.warn("showSaveFilePicker 异常，降级直接下载:", e);
      toast.warning(`调起原生保存受限（${errMsg || errName}），为您直接下载副本`);
      await executeExport(suggestedName, isSaveAs, true);
      return 'downloaded';
    }

    if (!handle) return 'cancelled';

    reportClientLog('info', 'PickAndSave', `用户已确认文件保存位置: ${handle.name}，开始写入...`);
    const toastId = toast.loading(`正在写入本地文件：${handle.name}...`);

    try {
      const res = await silentSaveWithHandle(handle, { skipPermissionCheck: true, silentToast: true });
      toast.dismiss(toastId);

      if (res.ok) {
        setConfirmExportOpen(false);
        setBindHelperOpen(false);
        toast.success(`保存成功，已绑定本地文件：${handle.name}`);
        reportClientLog('info', 'PickAndSave', `保存并绑定成功: ${handle.name}`);
        // 立即刷新历史记录列表，确保弹窗中同步显示为绿色“本地文件”
        await loadHistoryList();
        return 'saved';
      }

      reportClientLog('warn', 'PickAndSave', `句柄写入未成功: ${res.message}，改用普通下载`);
      alert(`【本地文件写入受限诊断】
原因: ${res.message || '未知异常'}

系统已自动为您下载一份更新副本`);
      toast.warning(`本地文件写入受限，已为您下载副本：${suggestedName}`);
      await executeExport(suggestedName, isSaveAs, true);
      return 'downloaded';
    } catch (unexpectedErr: any) {
      toast.dismiss(toastId);
      reportClientLog('error', 'PickAndSave', `写入阶段意外异常: ${unexpectedErr?.message}`, null, unexpectedErr?.stack);
      alert(`【系统异常诊断】
错误类型: ${unexpectedErr?.name}
错误原因: ${unexpectedErr?.message}`);
      throw unexpectedErr;
    }
  };

  const handleExportProject = async () => {
    const existingHandle = mainMode === 'engineering' ? projectHandleRef.current : optimizationHandleRef.current;
    if (existingHandle) {
      const res = await silentSaveWithHandle(existingHandle, { silentToast: true });
      if (res.ok) {
        toast.success("保存成功");
        return;
      }

      if (res.reason === 'permission_denied') {
        const fallbackName = getDefaultFileName(false);
        toast.warning("原文件写入权限被浏览器拒绝，已改为下载更新副本");
        await executeExport(fallbackName, false, true);
        return;
      }

      // 句柄写入受限，调起原生另存为窗口
      toast.warning(`原文件写入受限（${res.message || '未知原因'}），为您调起原生另存为`);
      await pickAndSaveWithNativePicker(false);
      return;
    }

    // 关键修复：未绑定句柄（新建工程、仅缓存项恢复、或普通文件导入），首次保存调起原生保存窗口以获取本地文件句柄
    const cachedName = mainMode === 'engineering'
      ? currentProjectName
      : currentOptimizationName;
    const cachedExt = mainMode === 'engineering' ? '.wce' : '.json';
    await pickAndSaveWithNativePicker(
      false,
      cachedName ? ensureFileExtension(cachedName, cachedExt) : undefined
    );
  };

  const handleSaveAsProject = async () => {
    // 关键修复：另存为必须调起原生选择器，以创建新文件并绑定新句柄
    await pickAndSaveWithNativePicker(true);
  };

  useEffect(() => {
    const handleGlobalSaveShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        handleExportProject();
      }
    };
    window.addEventListener('keydown', handleGlobalSaveShortcut);
    return () => window.removeEventListener('keydown', handleGlobalSaveShortcut);
  }, [handleExportProject]);

  const validateAndApplyImportedData = (data: any, silentToast = false): boolean => {
    if (!data || typeof data !== 'object') {
      toast.error("文件内容无效，无法识别为有效的项目数据");
      return false;
    }

    const looksLikeEngineering =
      Array.isArray(data.purchases) ||
      Array.isArray(data.profileSales) ||
      Array.isArray(data.profileSalesColumns) ||
      Array.isArray(data.savedPlans) ||
      (data.printInfo !== undefined && data.demands === undefined);
    const looksLikeOptimization =
      Array.isArray(data.demands) ||
      Array.isArray(data.stocks) ||
      (data.fixedPlans !== undefined && typeof data.fixedPlans === 'object') ||
      data.results !== undefined;

    if (!looksLikeEngineering && !looksLikeOptimization) {
      toast.error("文件中未包含有效的工程数据或套裁数据！");
      return false;
    }

    // Automatically switch mode if user imported an engineering file while in optimization mode or vice-versa
    const targetMode: 'engineering' | 'optimization' =
      mainMode === 'engineering'
        ? (!looksLikeEngineering && looksLikeOptimization ? 'optimization' : 'engineering')
        : (!looksLikeOptimization && looksLikeEngineering ? 'engineering' : 'optimization');

    if (targetMode !== mainMode) {
      setMainMode(targetMode);
    }

    if (targetMode === 'engineering') {
       syncCleanEngRef.current = true;
       const importedPurchases = Array.isArray(data.purchases) ? data.purchases : [];
       const importedProfileSales = Array.isArray(data.profileSales) ? data.profileSales : [];
       const importedSavedPlans = Array.isArray(data.savedPlans) ? data.savedPlans : [];
       if (importedProfileSales.length > 0) {
         skipNextPurchaseSyncRef.current = true;
       }
       setPurchases(importedPurchases);
       setProfileSales(importedProfileSales);
       setProfileSalesColumns(Array.isArray(data.profileSalesColumns) ? data.profileSalesColumns : []);
       setSavedPlans(importedSavedPlans);
       if (data.printInfo) setSettings(prev => ({ ...prev, printInfo: { ...prev.printInfo, ...data.printInfo } }));
       
       if (importedPurchases.length > 0) {
         setActiveEngTab('purchase');
       } else if (importedProfileSales.length > 0) {
         setActiveEngTab('sales');
       } else if (importedSavedPlans.length > 0) {
         setActiveEngTab('plan-management');
       }

       setEngRev(0);
       setSavedEngRev(0);
       if (!silentToast) toast.success("工程数据导入成功！");
       return true;
    } else {
       syncCleanOptRef.current = true;
       const importedDemands = Array.isArray(data.demands) ? data.demands : [];
       const importedStocks = Array.isArray(data.stocks) ? data.stocks : [];
       const importedResults = data.results !== undefined ? data.results : null;
       setDemands(importedDemands);
       setStocks(importedStocks);
       setFixedPlans(data.fixedPlans && typeof data.fixedPlans === 'object' ? data.fixedPlans : {});
       if (data.settings && typeof data.settings === 'object') {
         setSettings(prev => ({
           ...prev,
           ...data.settings,
           printInfo: prev.printInfo,
           ai: prev.ai
         }));
       }
       setResults(importedResults);

       if (importedResults) {
         setActiveOptTab('results');
       } else if (importedDemands.length > 0) {
         setActiveOptTab('demand');
       }
       
       setOptRev(0);
       setSavedOptRev(0);
       if (!silentToast) toast.success("套裁数据导入成功！");
       return true;
    }
  };

  const readFileAsText = async (file: File): Promise<string> => {
    if (typeof file.text === 'function') {
      try {
        return await file.text();
      } catch (_) {}
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error || new Error('读取文件失败'));
      reader.readAsText(file);
    });
  };

  const parseImportedFileData = async (fileToRead: File): Promise<{ ok: boolean; data?: any; fileName: string }> => {
    const fileName = fileToRead.name || getDefaultFileName(false);
    try {
      const rawText = await readFileAsText(fileToRead);
      const cleanText = rawText.replace(/^\uFEFF/, '').trim();
      if (!cleanText) {
        toast.error("所选文件内容为空，无法导入！");
        return { ok: false, fileName };
      }
      const data = JSON.parse(cleanText);
      if (!data || typeof data !== 'object') {
        toast.error("文件内容无效，无法识别为有效的项目数据");
        return { ok: false, fileName };
      }
      return { ok: true, data, fileName };
    } catch (err: any) {
      console.error("Failed to read or parse imported file:", err);
      toast.error(`文件读取或解析失败：${err?.message || '请确认文件为有效的 JSON / WCE 格式'}`);
      return { ok: false, fileName };
    }
  };

  const applyImportedParsedData = async (
    data: any,
    fileName: string,
    pendingHandle: any = null
  ): Promise<boolean> => {
    const looksLikeEngineering =
      Array.isArray(data.purchases) ||
      Array.isArray(data.profileSales) ||
      Array.isArray(data.profileSalesColumns) ||
      Array.isArray(data.savedPlans) ||
      (data.printInfo !== undefined && data.demands === undefined);
    const looksLikeOptimization =
      Array.isArray(data.demands) ||
      Array.isArray(data.stocks) ||
      (data.fixedPlans !== undefined && typeof data.fixedPlans === 'object') ||
      data.results !== undefined;

    const targetMode: 'engineering' | 'optimization' =
      mainMode === 'engineering'
        ? (!looksLikeEngineering && looksLikeOptimization ? 'optimization' : 'engineering')
        : (!looksLikeOptimization && looksLikeEngineering ? 'engineering' : 'optimization');

    if (!validateAndApplyImportedData(data)) {
      return false;
    }

    if (targetMode === 'engineering') {
      setCurrentProjectName(fileName.replace(/\.[^/.]+$/, ""));
      updateProjectHandle(pendingHandle || null);
    } else {
      setCurrentOptimizationName(fileName.replace(/\.[^/.]+$/, ""));
      updateOptimizationHandle(pendingHandle || null);
    }

    // 关键修复：导入时将文件句柄完整绑定到当前工程及历史记录，并立即刷新历史记录列表
    try {
      await saveToHistory(fileName, data, "", pendingHandle || null, targetMode);
      await loadHistoryList();
    } catch (e) {
      console.warn("saveToHistory after import failed:", e);
    }
    return true;
  };

  const queueOrExecuteImport = async (file: File, handle: any = null) => {
    // CRITICAL: read and parse the File immediately BEFORE clearing input.value or switching modal state
    const parsed = await parseImportedFileData(file);
    if (!parsed.ok || !parsed.data) {
      return false;
    }

    const ok = await applyImportedParsedData(parsed.data, parsed.fileName, handle);
    if (ok) {
      toast.success(handle ? `已导入本地文件：${parsed.fileName}` : `已导入文件：${parsed.fileName}`);
      setConfirmImportOpen(false);
      setHistoryFolderOpen(false);
      setImportPendingFile(null);
      setImportPendingData(null);
      setImportPendingFileName("");
      setImportPendingHandle(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (dialogFileInputRef.current) dialogFileInputRef.current.value = '';
    }
    return ok;
  };

  const executeImport = async () => {
    if (!importPendingData && !importPendingFile) return;
    const pendingHandle = importPendingHandle;
    try {
      if (importPendingData) {
        await applyImportedParsedData(
          importPendingData,
          importPendingFileName || importPendingFile?.name || getDefaultFileName(false),
          pendingHandle
        );
      } else if (importPendingFile) {
        const parsed = await parseImportedFileData(importPendingFile);
        if (parsed.ok && parsed.data) {
          await applyImportedParsedData(parsed.data, parsed.fileName, pendingHandle);
        }
      }
    } finally {
      setConfirmImportOpen(false);
      setHistoryFolderOpen(false);
      setImportPendingFile(null);
      setImportPendingData(null);
      setImportPendingFileName("");
      setImportPendingHandle(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (dialogFileInputRef.current) dialogFileInputRef.current.value = '';
    }
  };

  const triggerFallbackFileInput = () => {
    const targetInput = historyFolderOpen && dialogFileInputRef.current
      ? dialogFileInputRef.current
      : fileInputRef.current;
    if (targetInput) {
      targetInput.value = '';
      targetInput.click();
    }
  };

  const handleImportProjectMain = async (e?: React.ChangeEvent<HTMLInputElement>) => {
    if (e && e.target && e.target.files) {
      const inputEl = e.target;
      const file = inputEl.files?.[0];
      if (!file) return;
      try {
        await queueOrExecuteImport(file, null);
      } finally {
        inputEl.value = '';
      }
      return;
    }
    
    // 点击顶部【导入工程】，严格按原设计先弹出工程历史记录弹窗！
    setConfirmImportOpen(false);
    setPasteImportOpen(false);
    await loadHistoryList();
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
      updateProjectHandle(null);
      setEngRev(0);
      setSavedEngRev(0);
    } else {
      setDemands([]);
      setStocks([]);
      setFixedPlans({});
      setResults(null);
      setOptRev(0);
      setSavedOptRev(0);
      setCurrentOptimizationName("");
      updateOptimizationHandle(null);
    }
    toast.success(mainMode === 'engineering' ? "已创建新工程" : "已创建新套裁");
  };

  const handleCreateNewDirectly = () => {
    setConfirmNewProjectOpen(false);
    clearProjectData();
  };

  const handleCreateNewWithSave = async () => {
    const existingHandle = mainMode === 'engineering' ? projectHandleRef.current : optimizationHandleRef.current;
    if (existingHandle) {
      const res = await silentSaveWithHandle(existingHandle);
      if (res.ok) {
        clearProjectData();
        setConfirmNewProjectOpen(false);
        return;
      }
    }

    if (canUseNativeFilePicker) {
      const status = await pickAndSaveWithNativePicker(false);
      if (status === 'saved' || status === 'downloaded') {
        clearProjectData();
        setConfirmNewProjectOpen(false);
        return;
      }
      if (status === 'cancelled') {
        return;
      }
    }

    const success = await executeExport(undefined, false);
    if (success) {
      clearProjectData();
      setConfirmNewProjectOpen(false);
    }
  };

  const handleHistoryItemClick = async (item: any) => {
    const applyCachedDataFallback = () => {
      if (!item.data) return false;
      if (validateAndApplyImportedData(item.data, true)) {
        if (mainMode === 'engineering') {
          setCurrentProjectName(item.name.replace(/\.[^/.]+$/, ""));
          updateProjectHandle(null);
        } else {
          setCurrentOptimizationName(item.name.replace(/\.[^/.]+$/, ""));
          updateOptimizationHandle(null);
        }
        return true;
      }
      return false;
    };

    try {
      if (item.handle) {
        try {
          const handle = item.handle;
          let hasAccess = false;
          if (typeof handle.queryPermission === 'function') {
            const rwPerm = await handle.queryPermission({ mode: 'readwrite' });
            if (rwPerm === 'granted') {
              hasAccess = true;
            } else if (typeof handle.requestPermission === 'function') {
              const reqRw = await handle.requestPermission({ mode: 'readwrite' });
              if (reqRw === 'granted') {
                hasAccess = true;
              } else {
                const readPerm = await handle.queryPermission({ mode: 'read' });
                if (readPerm === 'granted') {
                  hasAccess = true;
                } else {
                  const reqRead = await handle.requestPermission({ mode: 'read' });
                  hasAccess = reqRead === 'granted';
                }
              }
            }
          } else {
            hasAccess = true;
          }

          if (!hasAccess) {
            if (applyCachedDataFallback()) {
              toast.info("未授予原文件访问权限，已加载本地缓存副本");
              setHistoryFolderOpen(false);
              return;
            }
            toast.error("拒绝访问文件。");
            return;
          }

          const file = await handle.getFile();
          const text = (await readFileAsText(file)).replace(/^\uFEFF/, '').trim();
          const data = JSON.parse(text);
          if (validateAndApplyImportedData(data)) {
            if (mainMode === 'engineering') {
              setCurrentProjectName(item.name.replace(/\.[^/.]+$/, ""));
              updateProjectHandle(handle);
              setSavedEngRev(engRev);
            } else {
              setCurrentOptimizationName(item.name.replace(/\.[^/.]+$/, ""));
              updateOptimizationHandle(handle);
              setSavedOptRev(optRev);
            }
            setHistoryFolderOpen(false);
          }
          return;
        } catch (handleErr) {
          if (applyCachedDataFallback()) {
            toast.info("原本地文件不可访问，已加载本地缓存数据");
            setHistoryFolderOpen(false);
            return;
          }
          throw handleErr;
        }
      } else if (item.data) {
        if (applyCachedDataFallback()) {
          setHistoryFolderOpen(false);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("读取文件失败，文件可能已被移动或删除。");
    }
  };

  const openLocalProjectWithHandle = async (startInHandle?: any) => {
    if (!canUseNativeFilePicker) {
      toast.info("当前环境不支持原生文件句柄，已为您调起标准导入通道");
      triggerFallbackFileInput();
      return;
    }

    let handles: any[] | null = null;
    const openStartTime = Date.now();
    try {
      // 不给原生选择器设置 MIME/扩展名过滤。
      // Android Chrome 对自定义 .wce 扩展名配合 application/json 的过滤兼容性不一致，
      // 选中文件后再按 JSON 内容识别工程或套裁类型。
      const pickerOptions: any = { multiple: false };
      if (startInHandle && typeof startInHandle.getFile === 'function') {
        pickerOptions.startIn = startInHandle;
      }
      handles = await (window as any).showOpenFilePicker(pickerOptions);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        const elapsed = Date.now() - openStartTime;
        reportClientLog(
          'warn',
          'ImportOpen',
          `showOpenFilePicker 返回 AbortError (耗时 ${elapsed}ms, visibility=${document.visibilityState}, win=${window.innerWidth}x${window.innerHeight})`
        );
        if (elapsed >= 1500) {
          toast.info("未获取到文件", {
            description: "如已选文件点确认却无反应，通常是窗口被遮挡被 Chrome 拦截，可直接把本地文件拖进此弹窗导入（带句柄）或用标准导入：",
            action: {
              label: "标准导入",
              onClick: () => triggerFallbackFileInput()
            },
            duration: 10000
          });
        }
        return;
      }
      console.warn("showOpenFilePicker 出现异常:", e);
      toast.error(`调起文件窗口异常：${e?.message || '请检查权限'}`);
      triggerFallbackFileInput();
      return;
    }

    if (handles && handles[0]) {
      const handle = handles[0];
      try {
        // 这里只读取并绑定句柄，不在选择器返回后立即申请 readwrite。
        // Chrome 可能已结束用户手势，此时申请写权限会被拦截；保存按钮中再申请写权限。
        const file = await withSaveTimeout(handle.getFile(), '读取导入文件');
        const imported = await queueOrExecuteImport(file, handle);
        if (!imported) {
          toast.warning('原生导入未完成，已切换为标准文件导入');
          triggerFallbackFileInput();
        }
        return;
      } catch (fileErr: any) {
        console.error("Failed to read selected file from handle:", fileErr);
        toast.warning(`原生句柄读取失败，已切换为标准文件导入：${fileErr?.message || '请确认文件可读'}`);
        triggerFallbackFileInput();
        return;
      }
    }
  };

  const handleImportFromLocalFileInDialog = async () => {
    // 优先使用原生文件选择器，保留 FileSystemFileHandle，后续保存可直接覆盖原文件。
    // 仅在浏览器不支持原生 API 或调用失败时，才降级到普通 input 导入。
    await openLocalProjectWithHandle();
  };
  const importFromLocalFile = openLocalProjectWithHandle;

  const handleDeletePlan = useCallback((planId: string, revokeRelated: boolean) => {
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
  }, [savedPlans, profileSalesColumns]);

  const handleRenamePlan = useCallback((planId: string, newName: string) => {
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
  }, [savedPlans]);

  const applySavedPlanToOptimization = (plan: SavedPlan) => {
    setResults(plan.results);
    if (plan.settingsSnapshot && typeof plan.settingsSnapshot === 'object') {
      setSettings(prev => ({ ...prev, ...plan.settingsSnapshot, ai: prev.ai }));
    }
    setMainMode('optimization');
    setActiveOptTab('results');
    setCurrentOptimizationName(plan.name);
    updateOptimizationHandle(null);
    setSavedOptRev(0);
    setReenterOptimizationPlan(null);
    toast.success(`已重新进入优化项目：${plan.name}`);
  };
  const handleRequestReenterOptimization = useCallback((plan: SavedPlan) => {
    setReenterOptimizationPlan(plan);
  }, []);
  const handleSaveCurrentAndReenter = async () => {
    const plan = reenterOptimizationPlan;
    if (!plan) return;
    const existingHandle = optimizationHandleRef.current;
    if (existingHandle) {
      const res = await silentSaveWithHandle(existingHandle);
      if (res.ok) {
        applySavedPlanToOptimization(plan);
        return;
      }
    }
    const status = await pickAndSaveWithNativePicker(false);
    if (status === 'saved' || status === 'downloaded') {
      applySavedPlanToOptimization(plan);
    }
  };
  const handleOverwriteAndReenter = () => {
    if (reenterOptimizationPlan) {
      applySavedPlanToOptimization(reenterOptimizationPlan);
    }
  };
  const handleSaleFromPlan = useCallback((planId: string) => {
    setPendingSalePlanIds([planId]);
    setMainMode('engineering');
    setActiveTab("sales");
  }, []);

  const handleBatchSaleFromPlans = useCallback((planIds: string[]) => {
    setPendingSalePlanIds(planIds);
    setMainMode('engineering');
    setActiveTab("sales");
  }, []);

  const handleUtilizeOffcuts = useCallback((planId: string) => {
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
  }, [savedPlans, settings.usableOffcutLength, purchases, profileSales]);

  if (!isAuthorized) {
    return (
      <>
        <ActivationScreen onActivated={handleActivated} />
        <Toaster position="top-center" richColors closeButton />
      </>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans selection:bg-orange-100 selection:text-orange-900"
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
        }
      }}
      onDrop={async (e) => {
        if (bindHelperOpen || historyFolderOpen) return;
        const firstItem = e.dataTransfer?.items?.[0] as any;
        const droppedFile = e.dataTransfer?.files?.[0];
        if (!firstItem && !droppedFile) return;
        e.preventDefault();
        const handlePromise =
          firstItem && typeof firstItem.getAsFileSystemHandle === 'function'
            ? firstItem.getAsFileSystemHandle().catch(() => null)
            : null;
        if (handlePromise) {
          const handle = await handlePromise;
          if (handle && handle.kind === 'file') {
            try {
              const file = await handle.getFile();
              await queueOrExecuteImport(file, handle);
              return;
            } catch (_) {}
          }
        }
        if (droppedFile) {
          await queueOrExecuteImport(droppedFile, null);
        }
      }}
    >
      <input
        type="file"
        ref={fileInputRef}
        className="sr-only"
        onChange={handleImportProjectMain}
      />
      
      <Dialog open={historyFolderOpen} onOpenChange={(open) => {
        setHistoryFolderOpen(open);
        if (!open) {
          setPasteImportOpen(false);
          setConfirmImportOpen(false);
          setImportPendingFile(null);
          setImportPendingData(null);
          setImportPendingFileName("");
          setImportPendingHandle(null);
        }
      }}>
        <DialogContent
          className="max-w-md"
          onDragOver={(e) => {
            e.preventDefault();
          }}
          onDrop={async (e) => {
            e.preventDefault();
            const firstItem = e.dataTransfer?.items?.[0] as any;
            const droppedFile = e.dataTransfer?.files?.[0];
            // Call getAsFileSystemHandle synchronously before any await
            const handlePromise =
              firstItem && typeof firstItem.getAsFileSystemHandle === 'function'
                ? firstItem.getAsFileSystemHandle().catch(() => null)
                : null;
            if (handlePromise) {
              const handle = await handlePromise;
              if (handle && handle.kind === 'file') {
                try {
                  const file = await handle.getFile();
                  await queueOrExecuteImport(file, handle);
                  return;
                } catch (_) {}
              }
            }
            if (droppedFile) {
              await queueOrExecuteImport(droppedFile, null);
            }
          }}
        >
          <input
            id="dialog-project-file-input"
            type="file"
            ref={dialogFileInputRef}
            className="sr-only"
            onChange={handleImportProjectMain}
          />
          {confirmImportOpen ? (
            <>
              <DialogHeader>
                <DialogTitle>确认导入{mainMode === 'engineering' ? '工程项目' : '优化项目'}数据</DialogTitle>
                <DialogDescription>
                  已解析文件 <strong className="text-orange-600">{importPendingFileName || importPendingFile?.name || ''}</strong>。
                  <br/><br/>
                  导入会<strong className="text-red-500">覆盖并清空</strong>当前已有的表格数据，是否继续？
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setConfirmImportOpen(false);
                    setImportPendingFile(null);
                    setImportPendingData(null);
                    setImportPendingFileName("");
                    setImportPendingHandle(null);
                  }}
                >
                  返回
                </Button>
                <Button onClick={executeImport} className="bg-orange-600 hover:bg-orange-700 text-white">
                  确认覆盖导入
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{mainMode === 'engineering' ? '本地工程历史记录' : '本地套裁历史记录'}</DialogTitle>
                <DialogDescription>
                  {mainMode === 'engineering' ? '选择本地缓存的工程继续工作，或从本地文件导入新工程（支持拖拽文件到此处）。' : '选择本地缓存的套裁继续工作，或从本地文件导入新的优化结果（支持拖拽文件到此处）。'}
                </DialogDescription>
              </DialogHeader>
              {isInIframe && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  <span>当前在预览内嵌窗口中运行，若本地文件弹窗受限，可直接把文件拖入本窗口，或使用「粘贴 JSON 导入」。</span>
                </div>
              )}
              {pasteImportOpen ? (
                <div className="space-y-3 py-2">
                  <Label className="text-xs text-black/60">粘贴之前复制或导出的 JSON 内容</Label>
                  <Textarea
                    value={pasteImportText}
                    onChange={(e) => setPasteImportText(e.target.value)}
                    placeholder='请粘贴以 { 开头的完整 JSON 数据...'
                    className="min-h-[180px] font-mono text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPasteImportOpen(false)}>返回列表</Button>
                    <Button size="sm" className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handlePasteImportSubmit}>确认粘贴导入</Button>
                  </div>
                </div>
              ) : (
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
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {item.handle && canUseNativeFilePicker && (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="text-black/40 hover:text-orange-600 p-1 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    importFromLocalFile(item.handle);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      importFromLocalFile(item.handle);
                                    }
                                  }}
                                  title="从该文件所在位置导入其他文件"
                                >
                                  <FolderOpen className="h-4 w-4" />
                                </span>
                              )}
                              <span
                                role="button"
                                tabIndex={0}
                                className="text-black/30 hover:text-red-600 p-1 cursor-pointer"
                                onClick={(e) => deleteHistoryItem(item.id, e)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    deleteHistoryItem(item.id, e as any);
                                  }
                                }}
                                title="删除该条缓存记录"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between w-full gap-2 text-xs text-black/40">
                            <span>保存时间: {new Date(item.timestamp).toLocaleString()}</span>
                            {item.handle ? (
                              <span className="text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                本地文件
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  仅缓存
                                </span>
                                {canUseNativeFilePicker && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    className="text-[10px] text-orange-600 hover:text-orange-700 hover:underline cursor-pointer flex items-center gap-0.5"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void bindCachedItemToLocalFile(item);
                                    }}
                                    title="将该缓存升级绑定为本地物理文件"
                                  >
                                    [绑定文件]
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-black/50 py-8 text-center bg-black/5 rounded-lg">没有找到本地历史记录</div>
                  )}
                </div>
              )}
              <DialogFooter className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4">
                 <Button variant="outline" onClick={() => setHistoryFolderOpen(false)}>取消</Button>
                 <Button variant="outline" className="gap-1.5" onClick={() => setPasteImportOpen(prev => !prev)}>
                   <ClipboardPaste className="h-4 w-4" />
                   {pasteImportOpen ? '查看缓存' : '粘贴 JSON'}
                 </Button>
                 <Button
                   className="flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-2"
                   onClick={handleImportFromLocalFileInDialog}
                 >
                   <Upload className="h-4 w-4" />
                   从本地文件导入
                 </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmExportOpen} onOpenChange={setConfirmExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isSaveAsExport ? '另存为' : '确认保存'}{mainMode === 'engineering' ? '工程项目' : '优化项目'}数据</DialogTitle>
            <DialogDescription>
              您即将把当前 <strong className="text-orange-600">{mainMode === 'engineering' ? '工程项目' : '优化项目'}</strong> 的数据导出保存到本地文件。
              <br/><br/>
              包含：{mainMode === 'engineering' ? '采购单、销料库、套裁汇总等' : '下料清单、原材料库、计算参数等数据'}。
            </DialogDescription>
          </DialogHeader>
          {isInIframe ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1.5">
                <p>当前位于内嵌预览窗口，浏览器安全策略禁止获取本地文件句柄，无法直接更新原本地文件（下载也可能被预览容器拦截）。</p>
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-amber-900 underline underline-offset-2 hover:text-orange-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  在新标签页独立打开（支持缓存文件句柄与直接保存更新原文件）
                </a>
              </div>
            </div>
          ) : !canUseNativeFilePicker && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                {!isSecureContextEnv
                  ? '当前为非 HTTPS 连接，浏览器限制无法获取文件句柄（无法原地更新原文件），点击保存将下载新文件副本到下载目录。请使用 HTTPS 或 localhost 访问以支持直接覆盖保存。'
                  : '当前浏览器不支持本地文件句柄写入（无法原地更新原文件），点击保存将下载新文件副本到下载目录。建议使用 Chrome 或 Edge 浏览器。'}
              </span>
            </div>
          )}
          <div className="grid gap-4 py-2">
            <Label>保存文件名格式</Label>
            <Input
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
              placeholder="请输入文件名"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') executeExport(exportFileName, isSaveAsExport);
              }}
            />
          </div>
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setConfirmExportOpen(false)}>取消</Button>
            <Button variant="outline" className="gap-1.5" onClick={copyProjectDataToClipboard}>
              <Copy className="h-4 w-4" />
              复制 JSON 数据
            </Button>
            <Button onClick={() => executeExport(exportFileName, isSaveAsExport)} className="bg-orange-600 hover:bg-orange-700 text-white">下载文件副本</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bindHelperOpen}
        onOpenChange={(open) => {
          setBindHelperOpen(open);
          if (!open) {
            setBindHelperDroppedHandle(null);
            setBindHelperTargetItem(null);
            setBindHelperDragOver(false);
            setBindHelperSubmitting(false);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-orange-600" />
              {bindHelperMode === 'save_abort' ? '保存窗口被浏览器中断 — 替代方案' : '绑定本地文件句柄'}
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed text-black/70">
              Windows 版 Chrome 若弹出文件框较大且遮住了网页，或保存时覆盖同名文件，浏览器安全策略会自动取消并返回失败（<code className="bg-black/5 px-1 rounded">AbortError</code>）。
              <br />
              您可以<strong>先把浏览器最大化 / 把系统保存框拖小一点重试</strong>，或使用下方<strong>免弹窗拖放区</strong>直接把本地文件拖进来完成句柄绑定：
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {bindHelperTargetItem && (
              <div className="rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-900">
                当前待绑定缓存记录：<strong className="font-semibold">{bindHelperTargetItem.name}</strong>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBindHelperDragOver(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setBindHelperDragOver(false);
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setBindHelperDragOver(false);
                const firstItem = e.dataTransfer?.items?.[0] as any;
                if (!firstItem || typeof firstItem.getAsFileSystemHandle !== 'function') {
                  toast.error("当前浏览器不支持拖放获取文件句柄，请使用最新版 Chrome 或 Edge");
                  return;
                }
                try {
                  const handle = await firstItem.getAsFileSystemHandle();
                  if (!handle || handle.kind !== 'file') {
                    toast.error("请拖入单个文件，不要拖入文件夹");
                    return;
                  }
                  setBindHelperDroppedHandle(handle);
                  reportClientLog('info', 'BindHelper', `拖放捕获文件句柄成功: ${handle.name}`);
                  toast.success(`已捕获文件：${handle.name}，请点击下方「确认授权写入并绑定」`);
                } catch (err: any) {
                  reportClientLog('warn', 'BindHelper', `拖放获取句柄异常: ${err?.message}`);
                  toast.error(`读取拖入文件失败：${err?.message || '请重试'}`);
                }
              }}
              className={cn(
                "rounded-xl border-2 border-dashed p-5 text-center transition-colors",
                bindHelperDroppedHandle
                  ? "border-emerald-400 bg-emerald-50/70"
                  : bindHelperDragOver
                    ? "border-orange-500 bg-orange-50"
                    : "border-black/20 bg-black/[0.02] hover:border-orange-400"
              )}
            >
              {bindHelperDroppedHandle ? (
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                    <Check className="h-4 w-4 text-emerald-600" />
                    已识别本地文件：{bindHelperDroppedHandle.name}
                  </div>
                  <p className="text-xs text-emerald-700/90">
                    点击下方按钮后，浏览器顶部若弹出「允许编辑文件」，请点允许，数据将直接覆盖写入该文件并永久绑定句柄。
                  </p>
                  <div className="pt-1 flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      disabled={bindHelperSubmitting}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                      onClick={async () => {
                        if (!bindHelperDroppedHandle) return;
                        setBindHelperSubmitting(true);
                        try {
                          const ok = await writeAndBindHandleToTarget(
                            bindHelperDroppedHandle,
                            bindHelperTargetItem
                          );
                          if (ok) {
                            setBindHelperOpen(false);
                          }
                        } finally {
                          setBindHelperSubmitting(false);
                        }
                      }}
                    >
                      <Check className="h-4 w-4" />
                      {bindHelperSubmitting ? '正在写入绑定...' : '确认授权写入并绑定'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setBindHelperDroppedHandle(null)}
                    >
                      重选
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-7 w-7 mx-auto text-orange-500/80" />
                  <p className="text-sm font-medium text-black/80">
                    将电脑里的 <code className="bg-black/5 px-1 rounded">.json</code> / <code className="bg-black/5 px-1 rounded">.wce</code> 文件直接拖到这里
                  </p>
                  <p className="text-xs text-black/50">
                    完全绕过系统文件弹窗限制。如果本地还没有文件，可先点下方「下载副本」，再把刚下载的文件拖进此框即可绑定！
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row flex-wrap gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setBindHelperOpen(false)}>
              关闭
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                const name = bindHelperSuggestedName || getDefaultFileName(false);
                if (bindHelperTargetItem?.data) {
                  const ok = triggerBrowserDownload(
                    JSON.stringify(bindHelperTargetItem.data, null, 2),
                    name
                  );
                  if (ok) {
                    toast.success(`已下载：${name}，直接从浏览器下载栏或文件夹拖入上方虚线框即可绑定！`);
                  }
                } else {
                  void executeExport(name, false, true);
                }
              }}
            >
              <Download className="h-3.5 w-3.5" />
              下载副本到电脑
            </Button>
            {bindHelperMode === 'save_abort' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={() => {
                  const base = (bindHelperSuggestedName || getDefaultFileName(false)).replace(/\.(json|wce)$/i, '');
                  const ext = mainMode === 'engineering' ? '.wce' : '.json';
                  const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '');
                  void pickAndSaveWithNativePicker(true, `${base}_${stamp}${ext}`);
                }}
              >
                <Save className="h-3.5 w-3.5" />
                换新文件名另存
              </Button>
            )}
            <Button
              size="sm"
              className="bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
              onClick={() => {
                if (bindHelperMode === 'save_abort') {
                  void pickAndSaveWithNativePicker(false, bindHelperSuggestedName);
                } else {
                  void pickExistingFileDirectly(bindHelperTargetItem, false);
                }
              }}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {bindHelperMode === 'save_abort' ? '再试一次另存为' : '用系统窗口选择'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reenterOptimizationPlan)} onOpenChange={(open) => !open && setReenterOptimizationPlan(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>重新进入优化项目</DialogTitle>
            <DialogDescription>
              即将加载套裁单 <strong className="text-orange-600">“{reenterOptimizationPlan?.name}”</strong> 的计算结果，
              这会替换当前优化项目页面中的结果和计算参数。
              {isOptDirty && <><br /><br /><strong className="text-red-600">当前优化项目有未保存修改。</strong> 如需保留，请先保存后再进入。</>}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setReenterOptimizationPlan(null)}>取消</Button>
            <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleOverwriteAndReenter}>直接覆盖进入</Button>
            <Button onClick={handleSaveCurrentAndReenter} className="bg-orange-600 hover:bg-orange-700 text-white">保存当前并进入</Button>
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
                  <span
                    className="relative ml-3 mr-2 text-sm font-normal text-black/60 bg-black/5 px-2 py-1 rounded align-middle flex items-center gap-1.5"
                    title={currentProjectHandle ? `已绑定本地文件句柄 (${currentProjectHandle.name})，再次保存将直接覆盖原文件` : '当前工程文件未绑定本地文件句柄'}
                  >
                    <FolderOpen className="h-3.5 w-3.5 text-black/60" />
                    <span>{currentProjectName}</span>
                    {currentProjectHandle && !isEngDirty && (
                      <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} title="已保存" />
                    )}
                  </span>
                )}
                {currentOptimizationName && (
                  <span
                    className="relative ml-1 text-sm font-normal text-orange-700 bg-orange-100 px-2 py-1 rounded align-middle flex items-center gap-1.5"
                    title={currentOptimizationHandle ? `已绑定本地文件句柄 (${currentOptimizationHandle.name})，再次保存将直接覆盖原文件` : '当前套裁文件未绑定本地文件句柄'}
                  >
                    <FileText className="h-3.5 w-3.5 text-orange-700" />
                    <span>{currentOptimizationName}</span>
                    {currentOptimizationHandle && !isOptDirty && (
                      <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} title="已保存" />
                    )}
                  </span>
                )}
              </h1>
              <p className="text-xs text-black/40 font-medium uppercase tracking-wider mt-0.5">Wire Cutting Optimizer v1.0</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 mr-2 no-print">
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
            <TabsContent value="project-settings" className="mt-0">
              <ProjectSettings settings={settings} setSettings={setSettings} purchases={purchases} />
            </TabsContent>

            <TabsContent value="purchase" className="mt-0">
              <PurchaseManagement data={purchases} setData={setPurchases} />
            </TabsContent>

            <TabsContent value="sales" className="mt-0">
              <ProfileSalesTable 
                data={profileSales} 
                setData={setProfileSales} 
                stocks={stocks} 
                purchases={purchases}
                columns={profileSalesColumns} 
                setColumns={setProfileSalesColumns} 
                savedPlans={savedPlans}
                pendingSalePlanIds={pendingSalePlanIds}
                onClearPendingSales={handleClearPendingSales}
                settings={settings}
                setSettings={setSettings}
              />
            </TabsContent>

            <TabsContent value="plan-management" className="mt-0">
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
                onReenterOptimization={handleRequestReenterOptimization}
                settings={settings}
                isActive={activeTab === 'plan-management'}
              />
            </TabsContent>

            <TabsContent value="demand" className="mt-0">
              <DemandTable data={demands} setData={setDemands} purchases={purchases} />
            </TabsContent>

            <TabsContent value="fixed" className="mt-0">
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

            <TabsContent value="stock" className="mt-0">
              <StockTable data={stocks} setData={setStocks} salesData={profileSales} purchases={purchases} settings={settings} />
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <SettingsPanel settings={settings} setSettings={setSettings} purchases={purchases} />
            </TabsContent>

            <TabsContent value="results" className="mt-0">
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

            {settings.ai?.enabled && (
              <TabsContent value="ai-report" className="mt-0">
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
            )}
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
