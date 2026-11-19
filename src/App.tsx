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

  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  const [importPendingFile, setImportPendingFile] = useState<File | null>(null);
  const [importPendingData, setImportPendingData] = useState<any>(null);
  const [importPendingFileName, setImportPendingFileName] = useState<string>("");
  const [importPendingHandle, setImportPendingHandle] = useState<any>(null);
  const [confirmExportOpen, setConfirmExportOpen] = useState(false);
  const [exportFileName, setExportFileName] = useState("");
  const [isSaveAsExport, setIsSaveAsExport] = useState(false);
  const [confirmNewProjectOpen, setConfirmNewProjectOpen] = useState(false);
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

  const saveToHistory = async (filename: string, projectData: any, oldName: string, fileHandle: any = null) => {
    try {
      const storageKey = mainMode === 'engineering' ? 'wire-optimizer-engineering-history' : 'wire-optimizer-optimization-history';
      const rawHistory = await get(storageKey);
      let history = Array.isArray(rawHistory) ? rawHistory : [];
      
      let targetId = Date.now().toString();
      let preservedHandle = fileHandle;
      if (oldName) {
        const existingIndex = history.findIndex((item: any) => 
          item.name === oldName || 
          item.name.replace(/\.[^/.]+$/, "") === oldName
        );
        if (existingIndex !== -1) {
          targetId = history[existingIndex].id;
          if (!preservedHandle && history[existingIndex].name === filename && history[existingIndex].handle) {
            preservedHandle = history[existingIndex].handle;
          }
        }
      } else {
        const existingIndex = history.findIndex((item: any) => item.name === filename);
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
        const isMatchNew = item.name === filename;
        const isMatchOld = oldName ? (
          item.name === oldName || 
          item.name.replace(/\.[^/.]+$/, "") === oldName
        ) : false;
        return !isMatchNew && !isMatchOld;
      });
      
      const newHistory = [newRecord, ...history].slice(0, 10); // Keep last 10
      try {
        await set(storageKey, newHistory);
        setHistoryList(newHistory);
      } catch (storageErr) {
        // Fallback if IndexedDB quota or handle cloning fails
        try {
          const lightweightRecord = { ...newRecord, data: preservedHandle ? null : projectData };
          const fallbackHistory = [lightweightRecord, ...history].slice(0, 10);
          await set(storageKey, fallbackHistory);
          setHistoryList(fallbackHistory);
        } catch (secondErr) {
          const noHandleRecord = { ...newRecord, handle: null };
          const fallbackHistory = [noHandleRecord, ...history].slice(0, 10);
          await set(storageKey, fallbackHistory);
          setHistoryList(fallbackHistory);
        }
      }
    } catch (e) {
      console.error("Failed to save history:", e);
    }
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

      if (isInIframe) {
        toast.warning("内嵌预览窗口无法直接更新本地文件，已尝试下载副本", {
          description: "请在新标签页独立打开本系统，即可记住文件句柄并直接覆盖原文件"
        });
      } else if (!isSecureContextEnv) {
        toast.info(`已下载文件副本：${safeName}`, {
          description: "当前为非 HTTPS 地址，浏览器限制无法直接覆盖原文件，请到下载目录查看或改用 HTTPS 访问"
        });
      } else {
        toast.info(`已下载文件副本：${safeName}`, {
          description: "当前浏览器不支持本地文件句柄直接覆盖，请到下载目录查看或改用 Chrome / Edge"
        });
      }
      setConfirmExportOpen(false);
      return true;
    } catch (err: any) {
      console.error("Export failed:", err);
      toast.error(`保存文件失败：${err?.message || '数据序列化或下载异常'}`);
      return false;
    }
  };

  const silentSaveWithHandle = async (
    handle: any,
    options?: { skipPermissionCheck?: boolean; silentToast?: boolean }
  ): Promise<{ ok: boolean; reason?: 'permission_denied' | 'not_found' | 'error'; message?: string }> => {
    let writable: any = null;
    try {
      if (!options?.skipPermissionCheck && typeof handle.queryPermission === 'function') {
        let perm = await handle.queryPermission({ mode: 'readwrite' });
        if (perm !== 'granted' && typeof handle.requestPermission === 'function') {
          perm = await handle.requestPermission({ mode: 'readwrite' });
        }
        if (perm !== 'granted') {
          return { ok: false, reason: 'permission_denied', message: '未授予本地文件写入权限' };
        }
      }

      const projectData = buildCurrentProjectData();
      const jsonText = JSON.stringify(projectData, null, 2);

      let lastErr = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          writable = await handle.createWritable({ keepExistingData: false });
          await writable.write(new Blob([jsonText], { type: 'application/json;charset=utf-8' }));
          await writable.close();
          writable = null;
          lastErr = null;
          break;
        } catch (wErr: any) {
          lastErr = wErr;
          if (writable) {
            try { await writable.abort(); } catch (_) {}
            writable = null;
          }
          await new Promise(r => setTimeout(r, 80));
        }
      }
      if (lastErr) throw lastErr;

      const safeName = handle.name || getDefaultFileName(false);
      const oldName = mainMode === 'engineering' ? currentProjectName : currentOptimizationName;
      await saveToHistory(safeName, projectData, oldName, handle);

      if (mainMode === 'engineering') {
        setCurrentProjectName(safeName.replace(/\.[^/.]+$/, ""));
        updateProjectHandle(handle);
        setSavedEngRev(engRev);
      } else {
        setCurrentOptimizationName(safeName.replace(/\.[^/.]+$/, ""));
        updateOptimizationHandle(handle);
        setSavedOptRev(optRev);
      }

      if (!options?.silentToast) {
        toast.success(`已覆写保存原文件【${safeName}】！`);
      }
      return { ok: true };
    } catch (err: any) {
      if (writable) {
        try {
          await writable.abort();
        } catch (_) {}
      }
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
      // 浏览器不支持原生文件系统 API 时，100% 触发直接下载
      await executeExport(suggestedName, isSaveAs, true);
      return 'downloaded';
    }

    const currentHandle = isEng ? projectHandleRef.current : optimizationHandleRef.current;
    let handle: any = null;

    try {
      const pickerOptions: any = {
        suggestedName
      };
      if (isSaveAs && currentHandle && typeof currentHandle.getFile === 'function') {
        pickerOptions.startIn = currentHandle;
      }
      handle = await (window as any).showSaveFilePicker(pickerOptions);
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'cancelled';
      console.warn("showSaveFilePicker 异常，降级直接下载:", e);
      toast.error(`调起保存窗口受限（${e?.message || '请检查权限'}），已为您直接下载副本`);
      await executeExport(suggestedName, isSaveAs, true);
      return 'downloaded';
    }

    if (!handle) return 'cancelled';

    const res = await silentSaveWithHandle(handle, { skipPermissionCheck: true, silentToast: true });
    if (res.ok) {
      setConfirmExportOpen(false);
      toast.success(
        isSaveAs
          ? `已成功另存为【${handle.name}】并关联句柄！后续修改按 Ctrl+S 将直接覆写！`
          : `已成功保存到【${handle.name}】并关联句柄！后续修改按 Ctrl+S 将直接覆写原文件！`
      );
      return 'saved';
    }

    // 若句柄写入失败，自动降级直接下载
    console.warn("句柄写入受限，自动触发直接下载兜底:", res.message);
    toast.error(`写入文件受限：${res.message || '系统限制'}，已为您下载副本`);
    await executeExport(suggestedName, isSaveAs, true);
    return 'downloaded';
  };

  const handleExportProject = async () => {
    const existingHandle = mainMode === 'engineering' ? projectHandleRef.current : optimizationHandleRef.current;
    if (existingHandle) {
      const res = await silentSaveWithHandle(existingHandle);
      if (res.ok) return;

      if (res.reason === 'permission_denied') {
        toast.error("未授予本地文件写入权限，请重新授权或另存为新文件");
        return;
      }

      // 句柄写入受限，调起原生另存为窗口
      toast.warning(`原文件写入受限（${res.message || '未知原因'}），为您调起原生另存为`);
      await pickAndSaveWithNativePicker(false);
      return;
    }

    // 未绑定句柄：调起原生保存框，保存后立即绑定句柄并升级为绿色【本地文件】
    await pickAndSaveWithNativePicker(false);
  };

  const handleSaveAsProject = async () => {
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

    try {
      await saveToHistory(fileName, data, "", pendingHandle || null);
    } catch (e) {
      console.warn("saveToHistory after import failed:", e);
    }
    return true;
  };

  const queueOrExecuteImport = async (file: File, handle: any = null) => {
    // CRITICAL: read and parse the File immediately BEFORE clearing input.value or switching modal state
    const parsed = await parseImportedFileData(file);
    if (!parsed.ok || !parsed.data) {
      return;
    }

    const ok = await applyImportedParsedData(parsed.data, parsed.fileName, handle);
    if (ok) {
      setConfirmImportOpen(false);
      setHistoryFolderOpen(false);
      setImportPendingFile(null);
      setImportPendingData(null);
      setImportPendingFileName("");
      setImportPendingHandle(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (dialogFileInputRef.current) dialogFileInputRef.current.value = '';
      toast.success(
        handle
          ? `已成功导入【${parsed.fileName}】并关联本地文件！后续按 Ctrl+S 即可直接覆写！`
          : `已成功导入【${parsed.fileName}】！点击「保存工程」即可直接关联本地文件！`
      );
    }
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
            toast.success(`已打开本地文件【${item.name}】并关联句柄！后续修改按 Ctrl+S 直接覆写！`);
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
          toast.info("已加载浏览器缓存数据（该历史记录未关联本地文件，如需覆盖原文件请点击「打开工程」重新关联）");
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
    try {
      const pickerOptions: any = {
        multiple: false
      };
      if (startInHandle && typeof startInHandle.getFile === 'function') {
        pickerOptions.startIn = startInHandle;
      }
      handles = await (window as any).showOpenFilePicker(pickerOptions);
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return;
      }
      console.warn("showOpenFilePicker 出现异常:", e);
      toast.error(`调起文件窗口异常：${e?.message || '请检查权限'}`);
      triggerFallbackFileInput();
      return;
    }

    if (handles && handles[0]) {
      try {
        const handle = handles[0];
        const file = await handle.getFile();
        await queueOrExecuteImport(file, handle);
        return;
      } catch (fileErr: any) {
        console.error("Failed to read selected file from handle:", fileErr);
        toast.error(`读取本地文件失败：${fileErr?.message || '请确认文件可读'}`);
        return;
      }
    }
  };

  const handleImportFromLocalFileInDialog = async () => {
    if (canUseNativeFilePicker) {
      await openLocalProjectWithHandle();
      return;
    }
    triggerFallbackFileInput();
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
    <div className="min-h-screen bg-[#F5F5F4] text-[#1A1A1A] font-sans selection:bg-orange-100 selection:text-orange-900">
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
                              <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                仅缓存
                              </span>
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
                 <label className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-md flex items-center justify-center gap-2 font-medium cursor-pointer py-2 px-4 shadow-sm transition-colors text-sm">
                   <Upload className="h-4 w-4" />
                   从本地文件导入
                   <input
                     type="file"
                     accept=".wce,.json,application/json,text/plain,*/*"
                     className="sr-only"
                     onClick={(e) => {
                       (e.target as HTMLInputElement).value = "";
                     }}
                     onChange={async (e) => {
                       const file = e.target.files?.[0];
                       if (!file) return;
                       try {
                         await queueOrExecuteImport(file, null);
                       } finally {
                         e.target.value = "";
                       }
                     }}
                   />
                 </label>
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
                    className="relative ml-3 mr-2 text-sm font-normal text-black/60 bg-black/5 px-2 py-1 rounded align-middle flex items-center gap-1"
                    title={currentProjectHandle ? `已绑定本地文件句柄 (${currentProjectHandle.name})，再次保存将直接覆盖原文件` : '未绑定本地文件句柄（点击「保存工程」即可直接关联）'}
                  >
                    <FolderOpen className="h-3 w-3" />{currentProjectName}
                    {currentProjectHandle && !isEngDirty && (
                      <Check className="h-4 w-4 text-green-500 absolute -bottom-1.5 -right-1.5 bg-[#F5F5F4] rounded-full p-[1px] shadow-sm" strokeWidth={4} />
                    )}
                  </span>
                )}
                {currentOptimizationName && (
                  <span
                    className="relative ml-1 text-sm font-normal text-orange-700 bg-orange-100 px-2 py-1 rounded align-middle flex items-center gap-1"
                    title={currentOptimizationHandle ? `已绑定本地文件句柄 (${currentOptimizationHandle.name})，再次保存将直接覆盖原文件` : '未绑定本地文件句柄（保存将导出下载并更新本地缓存）'}
                  >
                    <FileText className="h-3 w-3" />{currentOptimizationName}
                    {!isOptDirty && (
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
