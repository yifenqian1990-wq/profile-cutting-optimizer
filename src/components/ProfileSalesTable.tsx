import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Trash2, 
  ClipboardPaste,
  FileDown,
  PackageCheck
} from "lucide-react";
import { ProfileSalesItem, StockItem, OrderColumn, SavedPlan, PurchaseItem, Settings } from "../lib/optimizer";
import { exportToExcel } from '../lib/exportUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn, useTableState } from "@/lib/utils";
import { toast } from "sonner";
import { ProfileSalesHeaderCell } from "./profile-sales/ProfileSalesHeaderCell";
import { ProfileSalesRow } from "./profile-sales/ProfileSalesRow";
import { ProfileSalesDialogs } from "./profile-sales/ProfileSalesDialogs";

const toMm = (len: number | string) => {
  const n = parseFloat(String(len)) || 0;
  return n < 100 ? Math.round(n * 1000) : Math.round(n);
};

const getMaterialKey = (model: string, color: string, length: number | string) => {
  return `${String(model || '').trim().toLowerCase()}|${String(color || '').trim().toLowerCase()}|${toMm(length)}`;
};

interface ProfileSalesTableProps {
  data: ProfileSalesItem[];
  setData: React.Dispatch<React.SetStateAction<ProfileSalesItem[]>>;
  stocks: StockItem[];
  purchases: PurchaseItem[];
  columns: OrderColumn[];
  setColumns: React.Dispatch<React.SetStateAction<OrderColumn[]>>;
  savedPlans: SavedPlan[];
  pendingSalePlanIds?: string[];
  onClearPendingSales?: () => void;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
}

type SortConfig = {
  key: keyof ProfileSalesItem | string;
  direction: 'asc' | 'desc';
} | null;

export function ProfileSalesTable({ 
  data, 
  setData, 
  columns, 
  setColumns, 
  savedPlans, 
  pendingSalePlanIds, 
  onClearPendingSales, 
}: ProfileSalesTableProps) {
  const [sortConfig, setSortConfig] = useTableState<SortConfig>('profileSales_sort', { key: 'model', direction: 'asc' });
  const [filters, setFilters] = useTableState<Record<string, string>>('profileSales_filters', {});
  const [onlyShowSoldCols, setOnlyShowSoldCols] = useTableState<Record<string, boolean>>('profileSales_onlyShowSold', {});
  const [onlyShowShortage, setOnlyShowShortage] = useTableState<boolean>('profileSales_onlyShowShortage', false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmClear, setConfirmClear] = useState(false);

  // Dialogs for order column actions
  const [renameColId, setRenameColId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [remarkColId, setRemarkColId] = useState<string | null>(null);
  const [remarkValue, setRemarkValue] = useState("");
  const [importOrderColId, setImportOrderColId] = useState<string | null>(null);
  const [importSelectedPlanId, setImportSelectedPlanId] = useState<string>('');
  const [colToDelete, setColToDelete] = useState<string | null>(null);
  const [addOrderDialogOpen, setAddOrderDialogOpen] = useState(false);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  
  const [mismatchData, setMismatchData] = useState<{ planId: string, colId?: string, unmatchedCount: number, matchedCount: number } | null>(null);
  const processedPendingIdsRef = useRef<Set<string>>(new Set());

  const [importQueue, setImportQueue] = useState<{ planId: string, targetColId?: string }[]>([]);
  const [isBatch, setIsBatch] = useState(true);
  const [globalOrderPriority, setGlobalOrderPriority] = useState<string[]>([]);

  // Calculates totals per order column
  const colTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    columns.forEach(col => { totals[col.id] = 0; });
    data.forEach(item => {
      columns.forEach(col => {
        totals[col.id] += (item.orders?.[col.id] || 0);
      });
    });
    return totals;
  }, [data, columns]);

  const { totalQuantity, usedQuantity, needReplenishQuantity } = useMemo(() => {
    let t = 0;
    let u = 0;
    let nr = 0;
    data.forEach(item => {
       const qty = item.quantity;
       let used = 0;
       columns.forEach(col => {
          used += (item.orders?.[col.id] || 0);
       });
       t += qty;
       u += used;
       if (qty - used < 0) {
          nr += Math.abs(qty - used);
       }
    });
    return { totalQuantity: t, usedQuantity: u, needReplenishQuantity: nr };
  }, [data, columns]);

  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    index: 55,
    selection: 40,
    profileName: 140,
    model: 200,    
    length: 100,
    quantity: 80,
    color: 80,   
    remaining: 80, 
    actions: 60,
    orderNumber: 100
  });

  const resizingRef = useRef<{ key: string, startX: number, startWidth: number } | null>(null);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);

  const totalCalculatedWidth = useMemo(() => {
    let sum = 0;
    sum += columnWidths.index || 55;
    sum += columnWidths.profileName || 140;
    sum += columnWidths.model || 200;
    sum += columnWidths.length || 100;
    sum += columnWidths.color || 80;
    if (isBatch) {
      sum += columnWidths.orderNumber || 100;
    }
    sum += columnWidths.quantity || 80;
    sum += columnWidths.remaining || 80;
    
    columns.forEach(col => {
      sum += columnWidths[col.id] || 100;
    });
    
    return sum;
  }, [columnWidths, columns, isBatch]);

  const stickyLefts = useMemo(() => {
    const lefts: Record<string, number> = {};
    let currentLeft = 0;
    
    lefts.index = currentLeft;
    currentLeft += columnWidths.index || 55;
    
    lefts.profileName = currentLeft;
    currentLeft += columnWidths.profileName || 140;
    
    lefts.model = currentLeft;
    currentLeft += columnWidths.model || 200;
    
    lefts.length = currentLeft;
    currentLeft += columnWidths.length || 100;
    
    lefts.color = currentLeft;
    currentLeft += columnWidths.color || 80;
    
    if (isBatch) {
      lefts.orderNumber = currentLeft;
      currentLeft += columnWidths.orderNumber || 100;
    }
    
    lefts.quantity = currentLeft;
    currentLeft += columnWidths.quantity || 80;
    
    lefts.remaining = currentLeft;
    currentLeft += columnWidths.remaining || 80;
    
    return lefts;
  }, [columnWidths, isBatch]);

  // Precompute mismatches for columns once
  const columnMismatches = useMemo(() => {
    const map: Record<string, { unmatchedTypes: number; unmatchedTotalQty: number }> = {};
    if (columns.length === 0 || savedPlans.length === 0) return map;

    const dataKeys = new Set(data.flatMap(item => {
      const trimmed = String(item.model).trim();
      const keys = [`${trimmed}|${item.color}|${item.length}`];
      if (item.length < 100) keys.push(`${trimmed}|${item.color}|${item.length * 1000}`);
      return keys;
    }));

    columns.forEach(orderCol => {
      const plan = savedPlans.find(p => p.name === orderCol.name);
      if (!plan) return;
      let unmatchedTypes = 0;
      let unmatchedTotalQty = 0;
      plan.results.summaries.forEach(s => {
        s.patterns.forEach(p => {
          let rawLength = parseFloat(String(p.originalLength));
          if (rawLength < 100) rawLength = Math.floor(rawLength * 100) / 100;
          else rawLength = Math.floor(rawLength / 10) * 10;
          const normalizedRawLength = rawLength < 100 ? rawLength * 1000 : rawLength;
          const key1 = `${String(s.model).trim()}|${s.color}|${rawLength}`;
          const key2 = `${String(s.model).trim()}|${s.color}|${normalizedRawLength}`;
          if (!dataKeys.has(key1) && !dataKeys.has(key2)) {
            unmatchedTypes++;
            unmatchedTotalQty += p.count;
          }
        });
      });
      map[orderCol.id] = { unmatchedTypes, unmatchedTotalQty };
    });

    return map;
  }, [data, columns, savedPlans]);

  const processedData = useMemo(() => {
    let result = [...data];
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      result = result.filter(item => {
        if (key === 'remaining') {
           const remainder = item.quantity - columns.reduce((s, col) => s + (item.orders?.[col.id] || 0), 0);
           return String(remainder).includes(value);
        }
        if (key.startsWith('col_')) {
           const colId = key.replace('col_', '');
           return String(item.orders?.[colId] || 0).includes(value);
        }
        return String((item as any)[key]).toLowerCase().includes(value.toLowerCase());
      });
    });

    // Apply "only show sold" filters
    Object.entries(onlyShowSoldCols).forEach(([colId, active]) => {
      if (active) {
        result = result.filter(item => (item.orders?.[colId] || 0) > 0);
      }
    });

    if (!isBatch) {
      const aggregatedMap = new Map<string, ProfileSalesItem>();
      result.forEach(item => {
         const baseKey = `${item.profileName || ''}|${item.model}|${item.color}|${item.length}`;
         if (!aggregatedMap.has(baseKey)) {
            aggregatedMap.set(baseKey, {
               ...item,
               id: baseKey,
               orders: { ...item.orders }
            });
         } else {
            const existing = aggregatedMap.get(baseKey)!;
            existing.quantity += item.quantity;
            Object.entries(item.orders || {}).forEach(([colId, val]) => {
               existing.orders[colId] = (existing.orders[colId] || 0) + val;
            });
         }
      });
      result = Array.from(aggregatedMap.values());
    }

    // Apply "only show shortage" filter
    if (onlyShowShortage) {
      result = result.filter(item => {
        const remainder = item.quantity - columns.reduce((s, col) => s + (item.orders?.[col.id] || 0), 0);
        return remainder < 0;
      });
    }

    if (sortConfig) {
      result.sort((a: any, b: any) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];
        
        if (sortConfig.key === 'remaining') {
           aVal = a.quantity - columns.reduce((s, col) => s + (a.orders?.[col.id] || 0), 0);
           bVal = b.quantity - columns.reduce((s, col) => s + (b.orders?.[col.id] || 0), 0);
        } else if (sortConfig.key.startsWith('col_')) {
           const colId = sortConfig.key.replace('col_', '');
           aVal = a.orders?.[colId] || 0;
           bVal = b.orders?.[colId] || 0;
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, columns, filters, sortConfig, isBatch, onlyShowSoldCols, onlyShowShortage]);

  const handleTopScroll = useCallback(() => {
    if (bottomScrollRef.current && topScrollRef.current) {
      if (bottomScrollRef.current.scrollLeft !== topScrollRef.current.scrollLeft) {
        bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
      }
    }
  }, []);

  const handleBottomScroll = useCallback(() => {
    if (topScrollRef.current && bottomScrollRef.current) {
      if (topScrollRef.current.scrollLeft !== bottomScrollRef.current.scrollLeft) {
        topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { key, startX, startWidth } = resizingRef.current;
    const delta = e.pageX - startX;
    requestAnimationFrame(() => {
      setColumnWidths(prev => ({
        ...prev,
        [key]: Math.max(50, startWidth + delta)
      }));
    });
  }, []);

  const stopResizing = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
  }, [handleMouseMove]);

  const startResizing = useCallback((key: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = {
      key,
      startX: e.pageX,
      startWidth: columnWidths[key] || 100
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
  }, [columnWidths, handleMouseMove, stopResizing]);

  const handleSort = useCallback((key: string, direction: 'asc' | 'desc' | null) => {
    if (direction === null) setSortConfig(null);
    else setSortConfig({ key, direction });
  }, [setSortConfig]);

  const handleFilter = useCallback((key: string, val: string) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  }, [setFilters]);

  const handleToggleOnlyShowSold = useCallback((colId: string) => {
    setOnlyShowSoldCols(prev => ({
      ...prev,
      [colId]: !prev[colId]
    }));
  }, [setOnlyShowSoldCols]);

  const handleToggleOnlyShowShortage = useCallback(() => {
    setOnlyShowShortage(prev => !prev);
  }, [setOnlyShowShortage]);

  const updateOrderValue = useCallback((id: string, colId: string, value: number) => {
    setData(prev => {
      if (isBatch) {
         return prev.map(item => item.id === id ? { ...item, orders: { ...(item.orders || {}), [colId]: value } } : item);
      } else {
         const baseKey = id;
         const targets = prev.filter(item => `${item.profileName || ''}|${item.model}|${item.color}|${item.length}` === baseKey);
         if (targets.length === 0) return prev;
         
         const sortedTargets = [...targets].sort((a, b) => (a.orderNumber || '').localeCompare(b.orderNumber || ''));
         let remaining = value;
         
         const newPrev = [...prev];
         sortedTargets.forEach(targetItem => {
            const index = newPrev.findIndex(p => p.id === targetItem.id);
            if (index === -1) return;
            
            const usedInOtherCols = Object.entries(targetItem.orders || {}).reduce((s, [cId, v]) => s + (cId !== colId ? v : 0), 0);
            const available = Math.max(0, targetItem.quantity - usedInOtherCols);
            
            const itemToUpdate = { ...newPrev[index], orders: { ...newPrev[index].orders } };
            if (remaining > 0) {
               const toTake = Math.min(available, remaining);
               itemToUpdate.orders[colId] = toTake;
               remaining -= toTake;
            } else {
               itemToUpdate.orders[colId] = 0;
            }
            newPrev[index] = itemToUpdate;
         });
         
         if (remaining > 0 && sortedTargets.length > 0) {
            const firstIdx = newPrev.findIndex(p => p.id === sortedTargets[0].id);
            if (firstIdx !== -1) {
               newPrev[firstIdx].orders[colId] = (newPrev[firstIdx].orders[colId] || 0) + remaining;
            }
         }
         return newPrev;
      }
    });
  }, [isBatch, setData]);

  const addColumn = useCallback(() => {
    const newId = 'o' + Math.random().toString(36).substr(2, 5);
    setColumns(prev => [...prev, { id: newId, name: `新单号` }]);
    setColumnWidths(prev => ({ ...prev, [newId]: 100 }));
  }, [setColumns]);

  const removeColumn = useCallback((colId: string) => {
    setColumns(cols => cols.filter(c => c.id !== colId));
    setData(prev => prev.map(item => {
      const updatedOrders = { ...item.orders };
      delete updatedOrders[colId];
      return { ...item, orders: updatedOrders };
    }));
    setColToDelete(null);
  }, [setColumns, setData]);

  const renameColumn = useCallback((colId: string, newName: string) => {
    if (!newName.trim()) return;
    setColumns(cols => cols.map(c => c.id === colId ? { ...c, name: newName } : c));
  }, [setColumns]);

  const updateColumnRemark = useCallback((colId: string, remark: string) => {
    setColumns(cols => cols.map(c => c.id === colId ? { ...c, remark } : c));
  }, [setColumns]);

  const [sortPriorityDialogData, setSortPriorityDialogData] = useState<{ 
    type?: 'import' | 'refresh' | 'digest';
    planId?: string; 
    colId?: string; 
    priority: string[]; 
    checked: string[];
    title?: string;
    description?: string;
    confirmText?: string;
  } | null>(null);

  const getAvailableOrders = useCallback(() => {
    if (data.length === 0) return [];
    const orders = new Set<string>();
    data.forEach(d => {
      orders.add(d.orderNumber || '');
    });
    return Array.from(orders).sort((a, b) => {
      if (!a) return 1;
      if (!b) return -1;
      return a.localeCompare(b);
    });
  }, [data]);

  const executeRefreshMatch = useCallback((priority: string[] = [], checked: string[] = []) => {
    if (priority.length > 0) {
      setGlobalOrderPriority(priority);
    }

    setData(prevData => {
      // Clone data with fresh copy of orders
      const updatedData: ProfileSalesItem[] = prevData.map(item => ({
        ...item,
        orders: { ...(item.orders || {}) }
      }));

      // Find which columns correspond to saved plans
      const planColumns = columns.filter(col => savedPlans.some(p => p.name === col.name));
      if (planColumns.length === 0) {
        return updatedData;
      }

      // Reset orders for all planColumns before sequential re-allocation
      updatedData.forEach(item => {
        planColumns.forEach(col => {
          item.orders[col.id] = 0;
        });
      });

      // Match sequentially according to the order of columns ("按添加的单号顺序依次重新匹配")
      columns.forEach(col => {
        const plan = savedPlans.find(p => p.name === col.name);
        if (!plan) return; // Non-plan columns keep their existing values

        // Aggregate required quantities from the plan by normalized key
        const planDemands = new Map<string, number>();
        plan.results.summaries.forEach(s => {
          s.patterns.forEach(p => {
            const key = getMaterialKey(s.model, s.color, p.originalLength);
            planDemands.set(key, (planDemands.get(key) || 0) + p.count);
          });
        });

        // For each required material in this plan
        planDemands.forEach((totalUsage, demandKey) => {
          // Find all rows in updatedData that match this model|color|normLen
          const allMatchingItems = updatedData.filter(d => {
            return getMaterialKey(d.model, d.color, d.length) === demandKey;
          });

          if (allMatchingItems.length === 0) return;

          // Only items checked in the priority dialog participate
          const checkedMatchingItems = checked.length > 0 
            ? allMatchingItems.filter(item => checked.includes(item.orderNumber || ''))
            : allMatchingItems;

          // Sort matching items according to priority order
          checkedMatchingItems.sort((a, b) => {
            const idxA = priority.indexOf(a.orderNumber || '');
            const idxB = priority.indexOf(b.orderNumber || '');
            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return (a.orderNumber || '').localeCompare(b.orderNumber || '');
          });

          let remainingUsage = totalUsage;

          // Deduct from available quantity in order of matching items
          checkedMatchingItems.forEach(item => {
            // Already used in other columns (including previously processed columns!)
            const usedInOtherCols = columns
              .filter(c => c.id !== col.id)
              .reduce((sum, c) => sum + (item.orders?.[c.id] || 0), 0);
            const available = Math.max(0, item.quantity - usedInOtherCols);

            if (remainingUsage > 0) {
              const toLog = Math.min(available, remainingUsage);
              item.orders[col.id] = toLog;
              remainingUsage -= toLog;
            } else {
              item.orders[col.id] = 0;
            }
          });

          // If available stock was insufficient, record shortage on the first matching item
          if (remainingUsage > 0) {
            if (checkedMatchingItems.length > 0) {
              checkedMatchingItems[0].orders[col.id] = (checkedMatchingItems[0].orders[col.id] || 0) + remainingUsage;
            } else if (allMatchingItems.length > 0) {
              allMatchingItems[0].orders[col.id] = (allMatchingItems[0].orders[col.id] || 0) + remainingUsage;
            }
          }
        });
      });

      return updatedData;
    });

    toast.success("已按采购单销料顺序与单号添加顺序依次重新匹配销料");
  }, [columns, savedPlans, setData]);

  const handleOpenRefreshMatchDialog = useCallback(() => {
    const availOrders = getAvailableOrders();
    if (availOrders.length === 0) {
      executeRefreshMatch([], []);
      return;
    }
    const activePriority = globalOrderPriority.length > 0 
      ? Array.from(new Set([...globalOrderPriority, ...availOrders])) 
      : [...availOrders];

    setSortPriorityDialogData({
      type: 'refresh',
      priority: activePriority,
      checked: [...activePriority],
      title: "选择并排序采购单销料顺序",
      description: "支持复选、排序、置顶和置尾。勾选的采购单号参与销料，排列越靠上扣减优先级越高。将按添加单号顺序依次重新匹配。",
      confirmText: "确认重新匹配"
    });
  }, [getAvailableOrders, globalOrderPriority, executeRefreshMatch]);

  const executeDigestReplenishments = useCallback((priority: string[] = [], checked: string[] = []) => {
    if (priority.length > 0) {
      setGlobalOrderPriority(priority);
    }

    let totalDigested = 0;

    setData(prevData => {
      const updatedData: ProfileSalesItem[] = prevData.map(item => ({
        ...item,
        orders: { ...(item.orders || {}) }
      }));

      const getRemainder = (item: ProfileSalesItem) => {
        const used = columns.reduce((sum, col) => sum + (item.orders?.[col.id] || 0), 0);
        return item.quantity - used;
      };

      // Part A: Digest shortages on rows where remainder < 0 (余料为负数的缺料)
      updatedData.forEach(shortageItem => {
        let remainder = getRemainder(shortageItem);
        if (remainder >= 0) return;

        let neededShortage = Math.abs(remainder);
        const shortageKey = getMaterialKey(shortageItem.model, shortageItem.color, shortageItem.length);

        // Find candidate donor items in the table with remainder > 0
        const donorItems = updatedData.filter(donor => {
          if (donor.id === shortageItem.id) return false;
          if (checked.length > 0 && !checked.includes(donor.orderNumber || '')) return false;
          return getMaterialKey(donor.model, donor.color, donor.length) === shortageKey && getRemainder(donor) > 0;
        });

        // Sort donor items by priority or orderNumber
        donorItems.sort((a, b) => {
          const idxA = priority.indexOf(a.orderNumber || '');
          const idxB = priority.indexOf(b.orderNumber || '');
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return (a.orderNumber || '').localeCompare(b.orderNumber || '');
        });

        // For each donor row, transfer sales from shortageItem to donor
        for (const donor of donorItems) {
          if (neededShortage <= 0) break;

          let donorSurplus = getRemainder(donor);
          if (donorSurplus <= 0) continue;

          // Find columns on shortageItem that have orders > 0, transfer from latest columns first
          for (let i = columns.length - 1; i >= 0; i--) {
            if (neededShortage <= 0 || donorSurplus <= 0) break;
            const colId = columns[i].id;
            const currentShortageOrder = shortageItem.orders?.[colId] || 0;
            if (currentShortageOrder <= 0) continue;

            const shiftAmount = Math.min(neededShortage, currentShortageOrder, donorSurplus);
            if (shiftAmount > 0) {
              shortageItem.orders[colId] = currentShortageOrder - shiftAmount;
              donor.orders[colId] = (donor.orders?.[colId] || 0) + shiftAmount;
              neededShortage -= shiftAmount;
              donorSurplus -= shiftAmount;
              totalDigested += shiftAmount;
            }
          }
        }
      });

      // Part B: Check for plan columns that have unallocated required quantities
      columns.forEach(col => {
        const plan = savedPlans.find(p => p.name === col.name);
        if (!plan) return;

        const planDemands = new Map<string, number>();
        plan.results.summaries.forEach(s => {
          s.patterns.forEach(p => {
            const key = getMaterialKey(s.model, s.color, p.originalLength);
            planDemands.set(key, (planDemands.get(key) || 0) + p.count);
          });
        });

        planDemands.forEach((requiredTotal, demandKey) => {
          const matchingItems = updatedData.filter(d => getMaterialKey(d.model, d.color, d.length) === demandKey);
          const currentAllocated = matchingItems.reduce((sum, d) => sum + (d.orders?.[col.id] || 0), 0);

          let unallocated = requiredTotal - currentAllocated;
          if (unallocated > 0) {
            const surplusItems = matchingItems.filter(d => {
              if (checked.length > 0 && !checked.includes(d.orderNumber || '')) return false;
              return getRemainder(d) > 0;
            });
            surplusItems.sort((a, b) => {
              const idxA = priority.indexOf(a.orderNumber || '');
              const idxB = priority.indexOf(b.orderNumber || '');
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return (a.orderNumber || '').localeCompare(b.orderNumber || '');
            });

            for (const item of surplusItems) {
              if (unallocated <= 0) break;
              const surplus = getRemainder(item);
              if (surplus <= 0) continue;
              const take = Math.min(surplus, unallocated);
              item.orders[col.id] = (item.orders?.[col.id] || 0) + take;
              unallocated -= take;
              totalDigested += take;
            }
          }
        });
      });

      return updatedData;
    });

    if (totalDigested > 0) {
      toast.success(`消化补料成功：已按采购单销料顺序消化了 ${totalDigested} 件补料！`);
    } else {
      let remainingShortage = 0;
      data.forEach(item => {
        const used = columns.reduce((sum, col) => sum + (item.orders?.[col.id] || 0), 0);
        if (item.quantity - used < 0) {
          remainingShortage += Math.abs(item.quantity - used);
        }
      });
      if (remainingShortage > 0) {
        toast.warning(`仍有 ${remainingShortage} 件缺少补料，但选中的采购单中暂无同规格剩余余料可供消化。`);
      } else {
        toast.info("当前没有需要消化的补料（表中余料均无负数缺料）。");
      }
    }
  }, [columns, data, savedPlans, setData]);

  const handleOpenDigestDialog = useCallback(() => {
    const availOrders = getAvailableOrders();
    if (availOrders.length === 0) {
      executeDigestReplenishments([], []);
      return;
    }
    const activePriority = globalOrderPriority.length > 0 
      ? Array.from(new Set([...globalOrderPriority, ...availOrders])) 
      : [...availOrders];

    setSortPriorityDialogData({
      type: 'digest',
      priority: activePriority,
      checked: [...activePriority],
      title: "选择并排序采购单销料顺序",
      description: "支持复选、排序、置顶和置尾。勾选的采购单号参与销料，系统将优先从排列靠上的采购单剩余余料中扣减以消化缺料。",
      confirmText: "确认消化补料"
    });
  }, [getAvailableOrders, globalOrderPriority, executeDigestReplenishments]);

  const handleImportPlanUsage = useCallback(() => {
    if (!importOrderColId || !importSelectedPlanId) return;
    setImportQueue(prev => [...prev, { planId: importSelectedPlanId, targetColId: importOrderColId }]);
    setImportOrderColId(null);
    setImportSelectedPlanId('');
  }, [importOrderColId, importSelectedPlanId]);

  useEffect(() => {
    if (!pendingSalePlanIds || pendingSalePlanIds.length === 0) {
      processedPendingIdsRef.current.clear();
      return;
    }
    
    const unprocessedIds = pendingSalePlanIds.filter(id => !processedPendingIdsRef.current.has(id));
    if (unprocessedIds.length === 0) return;
      
    unprocessedIds.forEach(id => processedPendingIdsRef.current.add(id));

    setImportQueue(prev => [
      ...prev,
      ...unprocessedIds.map(id => ({ planId: id, targetColId: undefined }))
    ]);
    
    onClearPendingSales?.();
  }, [pendingSalePlanIds, onClearPendingSales]);

  const processImportTask = useCallback((planId: string, targetColId?: string) => {
    const plan = savedPlans.find(p => p.id === planId);
    if (!plan) {
      setImportQueue(q => q.slice(1));
      return;
    }

    const usages = new Map<string, number>();
    plan.results.summaries.forEach(s => {
      s.patterns.forEach(p => {
        let rawLength = parseFloat(String(p.originalLength));
        if (rawLength < 100) rawLength = Math.floor(rawLength * 100) / 100;
        else rawLength = Math.floor(rawLength / 10) * 10;
        const normalizedRawLength = rawLength < 100 ? rawLength * 1000 : rawLength;
        const key1 = `${String(s.model).trim()}|${s.color}|${rawLength}`;
        const key2 = `${String(s.model).trim()}|${s.color}|${normalizedRawLength}`;
        usages.set(key1, (usages.get(key1) || 0) + p.count);
        if (key1 !== key2) usages.set(key2, (usages.get(key2) || 0) + p.count);
      });
    });

    let matchedCount = 0;
    let unmatchedCount = 0;
    const dataKeys = new Set(data.flatMap(item => {
      const trimmed = String(item.model).trim();
      const keys = [`${trimmed}|${item.color}|${item.length}`];
      if (item.length < 100) keys.push(`${trimmed}|${item.color}|${item.length * 1000}`);
      return keys;
    }));

    Array.from(usages.keys()).forEach(key => {
      if (dataKeys.has(key)) matchedCount++;
      else unmatchedCount++;
    });

    if (unmatchedCount > 0) {
      setMismatchData({ planId, colId: targetColId, matchedCount, unmatchedCount });
      return;
    }

    const availOrders = getAvailableOrders();
    const activePriority = globalOrderPriority.length > 0 
      ? Array.from(new Set([...globalOrderPriority, ...availOrders])) 
      : [...availOrders];

    setSortPriorityDialogData({ 
      type: 'import',
      planId, 
      colId: targetColId, 
      priority: activePriority, 
      checked: [...activePriority],
      title: "选择并排序采购单销料顺序",
      description: "支持复选、排序、置顶和置尾。勾选的单号参与销料，排列越靠上扣减优先级越高。",
      confirmText: "确认导入"
    });
  }, [data, getAvailableOrders, globalOrderPriority, savedPlans]);

  const executeImportUsage = useCallback((planId: string, targetColId?: string, priority: string[] = [], checked: string[] = []) => {
    const plan = savedPlans.find(p => p.id === planId);
    if (!plan) return;

    setGlobalOrderPriority(priority);

    const usages = new Map<string, number>();
    plan.results.summaries.forEach(s => {
      s.patterns.forEach(p => {
        let rawLength = parseFloat(String(p.originalLength));
        if (rawLength < 100) rawLength = Math.floor(rawLength * 100) / 100;
        else rawLength = Math.floor(rawLength / 10) * 10;
        const normalizedRawLength = rawLength < 100 ? rawLength * 1000 : rawLength;
        const key = `${String(s.model).trim()}|${s.color}|${rawLength}`;
        const keyNorm = `${String(s.model).trim()}|${s.color}|${normalizedRawLength}`;
        usages.set(key, (usages.get(key) || 0) + p.count);
        if (key !== keyNorm) usages.set(keyNorm, (usages.get(keyNorm) || 0) + p.count);
      });
    });

    let finalColId = targetColId;
    if (!finalColId) {
      finalColId = 'o' + Math.random().toString(36).substr(2, 5);
      setColumns(cols => [...cols, { id: finalColId!, name: plan.name }]);
      setColumnWidths(prev => ({ ...prev, [finalColId!]: 100 }));
    }

    setData(prev => {
      const updatedData = [...prev];
      
      Array.from(usages.entries()).forEach(([key, totalUsage]) => {
         const allMatchingItems = updatedData.filter(d => {
            const dTrimmed = String(d.model).trim();
            const dKey1 = `${dTrimmed}|${d.color}|${d.length}`;
            const dKey2 = d.length < 100 ? `${dTrimmed}|${d.color}|${d.length * 1000}` : dKey1;
            return dKey1 === key || dKey2 === key;
         });

         allMatchingItems.forEach(item => {
           if (item.orders) {
             const newOrders = { ...item.orders };
             delete newOrders[finalColId!];
             item.orders = newOrders;
           } else {
             item.orders = {};
           }
           item.orders[finalColId!] = 0;
         });

         const checkedMatchingItems = allMatchingItems.filter(item => 
           checked.includes(item.orderNumber || '')
         );
         
         if (checkedMatchingItems.length === 0) return;
         
         checkedMatchingItems.sort((a, b) => {
           const idxA = priority.indexOf(a.orderNumber || '');
           const idxB = priority.indexOf(b.orderNumber || '');
           if (idxA !== -1 && idxB !== -1) return idxA - idxB;
           if (idxA !== -1) return -1;
           if (idxB !== -1) return 1;
           return 0;
         });
         
         let remainingUsage = totalUsage;
         
         checkedMatchingItems.forEach(item => {
           const usedInOtherCols = columns.filter(c => c.id !== finalColId).reduce((sum, c) => sum + (item.orders?.[c.id] || 0), 0);
           const available = Math.max(0, item.quantity - usedInOtherCols);
           
           if (remainingUsage > 0) {
              const toLog = Math.min(available, remainingUsage);
              item.orders[finalColId!] = toLog;
              remainingUsage -= toLog;
           } else {
              item.orders[finalColId!] = 0;
           }
         });
         
         if (remainingUsage > 0 && checkedMatchingItems.length > 0) {
            checkedMatchingItems[0].orders[finalColId!] = (checkedMatchingItems[0].orders[finalColId!] || 0) + remainingUsage;
         }
      });
      return updatedData;
    });

    if (targetColId) {
      setColumns(cols => cols.map(c => c.id === finalColId ? { ...c, name: plan.name } : c));
    }

    toast.success(`已成功导入套裁单 "${plan.name}" 的用量！`);
    setMismatchData(null);
  }, [columns, savedPlans, setColumns, setData]);

  useEffect(() => {
    if (importQueue.length > 0 && !mismatchData && !sortPriorityDialogData) {
      processImportTask(importQueue[0].planId, importQueue[0].targetColId);
    }
  }, [importQueue, mismatchData, sortPriorityDialogData, processImportTask]);

  const handleMismatchConfirm = useCallback(() => {
     if (mismatchData) {
        const availOrders = getAvailableOrders();
        const activePriority = globalOrderPriority.length > 0 
          ? Array.from(new Set([...globalOrderPriority, ...availOrders])) 
          : [...availOrders];
        setSortPriorityDialogData({ 
          type: 'import',
          planId: mismatchData.planId, 
          colId: mismatchData.colId, 
          priority: activePriority, 
          checked: [...activePriority],
          title: "选择并排序采购单销料顺序",
          description: "支持复选、排序、置顶和置尾。勾选的单号参与销料，排列越靠上扣减优先级越高。",
          confirmText: "确认导入"
        });
        setMismatchData(null);
     }
  }, [getAvailableOrders, globalOrderPriority, mismatchData]);
  
  const handleMismatchCancel = useCallback(() => {
     setMismatchData(null);
     setImportQueue(q => q.slice(1));
  }, []);

  const handlePriorityCancel = useCallback((cancelAll = false) => {
     const currentType = sortPriorityDialogData?.type;
     setSortPriorityDialogData(null);
     if (currentType === 'import' || !currentType) {
       if (cancelAll) {
         setImportQueue([]);
       } else {
         setImportQueue(q => q.slice(1));
       }
     }
  }, [sortPriorityDialogData]);

  const handleReimport = useCallback((colId: string, planName: string) => {
    const plan = savedPlans.find(p => p.name === planName);
    if (!plan) {
      toast.error(`未找到名称为 "${planName}" 的相关套裁单`);
      return;
    }
    setImportQueue(prev => [...prev, { planId: plan.id, targetColId: colId }]);
  }, [savedPlans]);

  const handleExportCSV = useCallback(() => {
    const cols = [
      { header: '型材名称', getValue: (item: ProfileSalesItem) => item.profileName || '' },
      { header: '型号', getValue: (item: ProfileSalesItem) => item.model || '' },
      { header: '长度(mm)', getValue: (item: ProfileSalesItem) => item.length || '' },
      { header: '颜色', getValue: (item: ProfileSalesItem) => item.color || '' },
      { header: '采购单号', getValue: (item: ProfileSalesItem) => item.orderNumber || '' },
      { header: '数量(总)', getValue: (item: ProfileSalesItem) => item.quantity || 0 },
      { 
        header: '余量', 
        getValue: (item: ProfileSalesItem) => item.quantity - columns.reduce((sum, col) => sum + (item.orders?.[col.id] || 0), 0) 
      },
      ...columns.map(c => ({
        header: c.name,
        getValue: (item: ProfileSalesItem) => item.orders?.[c.id] || 0
      }))
    ];

    exportToExcel({
      filename: `型材销料表_${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: '型材销料表',
      columns: cols,
      data: processedData,
      includeIndex: true,
    });
  }, [columns, processedData]);

  const handleDragStart = useCallback((e: React.DragEvent, colId: string) => {
    setDraggedColumnId(colId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetColId: string) => {
    e.preventDefault();
    if (draggedColumnId && draggedColumnId !== targetColId) {
      setColumns(prev => {
        const fromIndex = prev.findIndex(c => c.id === draggedColumnId);
        const toIndex = prev.findIndex(c => c.id === targetColId);
        if (fromIndex === -1 || toIndex === -1) return prev;
        const newCols = [...prev];
        const [draggedItem] = newCols.splice(fromIndex, 1);
        newCols.splice(toIndex, 0, draggedItem);
        return newCols;
      });
    }
    setDraggedColumnId(null);
  }, [draggedColumnId, setColumns]);

  const handleOpenRename = useCallback((colId: string, currentName: string) => {
    setRenameColId(colId);
    setRenameValue(currentName);
  }, []);

  const handleOpenRemark = useCallback((colId: string, currentRemark: string) => {
    setRemarkColId(colId);
    setRemarkValue(currentRemark);
  }, []);

  const handleOpenImportOther = useCallback((colId: string) => {
    setImportOrderColId(colId);
  }, []);

  const handleOpenDelete = useCallback((colId: string) => {
    setColToDelete(colId);
  }, []);

  const handleAddFromPlan = useCallback((planId: string) => {
    setImportQueue(prev => [...prev, { planId }]);
  }, []);

  const handlePriorityConfirm = useCallback((
    planId?: string, 
    colId?: string, 
    priority: string[] = [], 
    checked: string[] = [],
    type?: 'import' | 'refresh' | 'digest'
  ) => {
    if (type === 'refresh') {
      executeRefreshMatch(priority, checked);
    } else if (type === 'digest') {
      executeDigestReplenishments(priority, checked);
    } else {
      if (planId) {
        executeImportUsage(planId, colId, priority, checked);
      }
      setImportQueue(q => q.slice(1));
    }
  }, [executeRefreshMatch, executeDigestReplenishments, executeImportUsage]);

  return (
    <Card className="border-black/5 shadow-sm">
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0 pb-4">
        <div className="flex items-center gap-6">
          <div>
            <CardTitle className="text-lg font-bold">型材销料表</CardTitle>
            <CardDescription>根据采购单自动汇总，直接核算单号销料情况</CardDescription>
          </div>
          
          <div className="hidden sm:flex items-center gap-4 text-sm font-medium bg-black/5 px-4 py-2 rounded-lg">
            <div className="flex flex-col">
              <span className="text-black/50 text-[10px] uppercase">总数量</span>
              <span className="text-lg">{totalQuantity}</span>
            </div>
            <div className="w-px h-6 bg-black/10" />
            <div className="flex flex-col">
              <span className="text-black/50 text-[10px] uppercase">已销数量</span>
              <span className="text-green-600 text-lg">{usedQuantity}</span>
            </div>
            <div className="w-px h-6 bg-black/10" />
            <div className="flex flex-col">
              <span className="text-black/50 text-[10px] uppercase">需要补料数量</span>
              <span className={cn("text-lg", needReplenishQuantity > 0 ? "text-red-600 font-bold" : "text-black")} title={needReplenishQuantity > 0 ? "余料为负数产生需补料" : ""}>
                {needReplenishQuantity}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {selectedIds.size > 0 && (
            <div className="flex gap-2 mr-2 animate-in fade-in zoom-in-95">
              <Button size="sm" variant="outline" className="text-red-600 border-red-100 hover:bg-red-50" onClick={() => {
                setData(prev => prev.map(item => 
                  selectedIds.has(item.id) ? { ...item, orders: {} } : item
                ));
                setSelectedIds(new Set());
                toast.success("已清空选中项的销料数据");
              }}>
                <Trash2 className="h-4 w-4 mr-1" /> 清空选中 ({selectedIds.size})
              </Button>
            </div>
          )}
          {confirmClear ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-right-2 mr-2">
              <span className="text-sm font-medium text-red-600 mr-2">确定清空所有单号销料数据?</span>
              <Button variant="default" size="sm" className="bg-red-600 text-white hover:bg-red-700 h-8" onClick={() => { 
                setData(prev => prev.map(item => ({ ...item, orders: {} }))); 
                setColumns([]); 
                setConfirmClear(false); 
                toast.success("已清空单号销料数据");
              }}>确认</Button>
              <Button variant="ghost" size="sm" className="h-8" onClick={() => setConfirmClear(false)}>取消</Button>
            </div>
          ) : (
            <Button variant="ghost" size="sm" className="text-black/40 hover:text-red-600 gap-1" onClick={() => setConfirmClear(true)}>
              <Trash2 className="h-4 w-4" /> 清空销料数据
            </Button>
          )}

          <div className="flex bg-black/[0.03] p-1 rounded-lg mr-2 border border-black/5">
            <button 
               className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", !isBatch ? "bg-white shadow-sm" : "text-black/60 hover:text-black")}
               onClick={() => setIsBatch(false)}
            >
               集中显示
            </button>
            <button 
               className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", isBatch ? "bg-white shadow-sm" : "text-black/60 hover:text-black")}
               onClick={() => setIsBatch(true)}
            >
               分批显示
            </button>
          </div>

          <Button onClick={handleOpenRefreshMatchDialog} size="sm" variant="outline" className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50 px-4">
            <ClipboardPaste className="h-4 w-4" /> 刷新匹配销料
          </Button>

          <Button onClick={handleOpenDigestDialog} size="sm" variant="outline" className="gap-2 border-emerald-300 text-emerald-700 hover:bg-emerald-50 px-4" title="设置采购单销料顺序并在表中自动消化负数缺料与补料">
            <PackageCheck className="h-4 w-4" /> 消化补料
          </Button>

          <Button onClick={() => setAddOrderDialogOpen(true)} size="sm" variant="outline" className="gap-2 border-orange-200 text-orange-700 hover:bg-orange-50 px-4">
            <Plus className="h-4 w-4" /> 增加销料单号
          </Button>

          <Button onClick={handleExportCSV} size="sm" variant="outline" className="gap-2 border-black/10 hover:bg-black/5 px-4 ml-auto">
            <FileDown className="h-4 w-4" /> 导出 CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0 text-[13px]">
        {/* 上横向滚动条 */}
        <div 
          ref={topScrollRef} 
          className="overflow-x-auto w-full pb-1 mb-1 no-print hidden sm:block custom-scrollbar" 
          onScroll={handleTopScroll}
        >
          <div style={{ width: totalCalculatedWidth, height: '1px' }} />
        </div>
        
        <div 
          ref={bottomScrollRef}
          className="rounded-md border border-black/5 w-full overflow-x-auto max-h-[650px] overflow-y-auto custom-scrollbar"
          onScroll={handleBottomScroll}
        >
          <table style={{ width: totalCalculatedWidth, minWidth: totalCalculatedWidth }} className="w-full caption-bottom text-sm select-none table-fixed">
            <thead className="[&_tr]:border-b bg-black/[0.03] border-b border-black/5">
              <tr>
                <ProfileSalesHeaderCell 
                  label="序号" 
                  columnKey="index" 
                  widthKey="index" 
                  width={columnWidths.index || 55}
                  isSticky={stickyLefts.index !== undefined}
                  stickyLeft={stickyLefts.index}
                  sortConfig={sortConfig}
                  onSort={handleSort}
                  onFilter={handleFilter}
                  onStartResizing={startResizing}
                />
                <ProfileSalesHeaderCell 
                  label="型材名称" 
                  columnKey="profileName" 
                  widthKey="profileName" 
                  width={columnWidths.profileName || 140}
                  isSticky={stickyLefts.profileName !== undefined}
                  stickyLeft={stickyLefts.profileName}
                  sortConfig={sortConfig}
                  filterValue={filters.profileName}
                  onSort={handleSort}
                  onFilter={handleFilter}
                  onStartResizing={startResizing}
                />
                <ProfileSalesHeaderCell 
                  label="型号" 
                  columnKey="model" 
                  widthKey="model" 
                  width={columnWidths.model || 200}
                  isSticky={stickyLefts.model !== undefined}
                  stickyLeft={stickyLefts.model}
                  sortConfig={sortConfig}
                  filterValue={filters.model}
                  onSort={handleSort}
                  onFilter={handleFilter}
                  onStartResizing={startResizing}
                />
                <ProfileSalesHeaderCell 
                  label="长度 (mm)" 
                  columnKey="length" 
                  widthKey="length" 
                  width={columnWidths.length || 100}
                  isSticky={stickyLefts.length !== undefined}
                  stickyLeft={stickyLefts.length}
                  sortConfig={sortConfig}
                  filterValue={filters.length}
                  onSort={handleSort}
                  onFilter={handleFilter}
                  onStartResizing={startResizing}
                />
                <ProfileSalesHeaderCell 
                  label="颜色" 
                  columnKey="color" 
                  widthKey="color" 
                  width={columnWidths.color || 80}
                  isSticky={stickyLefts.color !== undefined}
                  stickyLeft={stickyLefts.color}
                  sortConfig={sortConfig}
                  filterValue={filters.color}
                  onSort={handleSort}
                  onFilter={handleFilter}
                  onStartResizing={startResizing}
                />
                {isBatch && (
                  <ProfileSalesHeaderCell 
                    label="采购单号" 
                    columnKey="orderNumber" 
                    widthKey="orderNumber" 
                    width={columnWidths.orderNumber || 100}
                    isSticky={stickyLefts.orderNumber !== undefined}
                    stickyLeft={stickyLefts.orderNumber}
                    sortConfig={sortConfig}
                    filterValue={filters.orderNumber}
                    onSort={handleSort}
                    onFilter={handleFilter}
                    onStartResizing={startResizing}
                  />
                )}
                <ProfileSalesHeaderCell 
                  label="数量 (总)" 
                  columnKey="quantity" 
                  widthKey="quantity" 
                  width={columnWidths.quantity || 80}
                  isSticky={stickyLefts.quantity !== undefined}
                  stickyLeft={stickyLefts.quantity}
                  sortConfig={sortConfig}
                  filterValue={filters.quantity}
                  onSort={handleSort}
                  onFilter={handleFilter}
                  onStartResizing={startResizing}
                />
                <ProfileSalesHeaderCell 
                  label="余量" 
                  columnKey="remaining" 
                  widthKey="remaining" 
                  width={columnWidths.remaining || 80}
                  isSticky={stickyLefts.remaining !== undefined}
                  stickyLeft={stickyLefts.remaining}
                  sortConfig={sortConfig}
                  filterValue={filters.remaining}
                  onlyShowShortage={onlyShowShortage}
                  onSort={handleSort}
                  onFilter={handleFilter}
                  onToggleOnlyShowShortage={handleToggleOnlyShowShortage}
                  onStartResizing={startResizing}
                />
                
                {/* Dynamically render order columns */}
                {columns.map((col) => {
                  const mismatch = columnMismatches[col.id];
                  return (
                    <ProfileSalesHeaderCell 
                      key={col.id} 
                      label={col.name} 
                      columnKey={`col_${col.id}`} 
                      widthKey={col.id} 
                      width={columnWidths[col.id] || 100}
                      isSticky={false}
                      orderCol={col}
                      isDraggableCol={true}
                      sortConfig={sortConfig}
                      filterValue={filters[`col_${col.id}`]}
                      onlyShowSold={onlyShowSoldCols[col.id]}
                      unmatchedTypes={mismatch?.unmatchedTypes || 0}
                      unmatchedTotalQty={mismatch?.unmatchedTotalQty || 0}
                      colTotal={colTotals[col.id] || 0}
                      onSort={handleSort}
                      onFilter={handleFilter}
                      onToggleOnlyShowSold={handleToggleOnlyShowSold}
                      onStartResizing={startResizing}
                      onDragStart={handleDragStart}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      onOpenRename={handleOpenRename}
                      onOpenRemark={handleOpenRemark}
                      onReimport={handleReimport}
                      onOpenImportOther={handleOpenImportOther}
                      onOpenDelete={handleOpenDelete}
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {processedData.length === 0 ? (
                <tr>
                  <td colSpan={7 + (isBatch ? 1 : 0) + columns.length} className="h-32 text-center text-black/30 italic">
                    暂无销料数据
                  </td>
                </tr>
              ) : (
                processedData.map((item, idx) => (
                  <ProfileSalesRow 
                    key={item.id}
                    item={item}
                    idx={idx}
                    columns={columns}
                    columnWidths={columnWidths}
                    stickyLefts={stickyLefts}
                    isBatch={isBatch}
                    onUpdateOrderValue={updateOrderValue}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>

      <ProfileSalesDialogs 
        renameColId={renameColId}
        setRenameColId={setRenameColId}
        renameValue={renameValue}
        setRenameValue={setRenameValue}
        onRenameConfirm={renameColumn}

        importOrderColId={importOrderColId}
        setImportOrderColId={setImportOrderColId}
        importSelectedPlanId={importSelectedPlanId}
        setImportSelectedPlanId={setImportSelectedPlanId}
        savedPlans={savedPlans}
        onImportPlanUsage={handleImportPlanUsage}

        colToDelete={colToDelete}
        setColToDelete={setColToDelete}
        onDeleteConfirm={removeColumn}

        mismatchData={mismatchData}
        setMismatchData={setMismatchData}
        onMismatchConfirm={handleMismatchConfirm}
        onMismatchCancel={handleMismatchCancel}

        addOrderDialogOpen={addOrderDialogOpen}
        setAddOrderDialogOpen={setAddOrderDialogOpen}
        onAddEmptyColumn={addColumn}
        onAddFromPlan={handleAddFromPlan}

        sortPriorityDialogData={sortPriorityDialogData}
        setSortPriorityDialogData={setSortPriorityDialogData}
        onPriorityConfirm={handlePriorityConfirm}
        onPriorityCancel={handlePriorityCancel}
        importQueueLength={importQueue.length}

        remarkColId={remarkColId}
        setRemarkColId={setRemarkColId}
        remarkValue={remarkValue}
        setRemarkValue={setRemarkValue}
        onRemarkConfirm={updateColumnRemark}
      />
    </Card>
  );
}
