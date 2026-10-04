
import GLPK from 'glpk.js/node';

export interface DemandItem {
  id: string;
  model: string;
  length: number;
  quantity: number;
  color: string;
  remarks: string;
  orderNumber?: string;
}

export interface StockItem {
  id: string;
  model: string;
  length: number;
  quantity: number;
  color: string;
  remarks: string;
  orderNumber?: string;
}

export interface PurchaseItem {
  id: string;
  profileName?: string;
  model: string;
  length: number;
  quantity: number;
  linearDensity?: number;
  color: string;
  orderNumber: string;
  remarks: string;
}

export interface ProfileSalesItem {
  id: string;
  profileName?: string;
  model: string;
  length: number;
  quantity: number;
  color: string;
  orderNumber?: string;
  orders?: Record<string, number>;
  order1?: number;
  order2?: number;
  order3?: number;
}

export interface OrderColumn {
  id: string;
  name: string;
  remark?: string;
}

export interface SavedPlan {
  id: string;
  name: string;
  createdAt: string;
  results: OptimizationSummary;
  settingsSnapshot: Settings;
}

export interface FixedLengthPlan {
  model: string;
  trim?: number;
  lengths: number[];
  isPinned?: boolean;
}

export type AlgorithmType = 'FFD' | 'CG';

export type AIProvider = 'Gemini' | 'OpenAI' | 'Custom';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  apiKeys?: string[]; // Multiple keys for rotation
  activeKeyIndex?: number;
  baseUrl: string;
  model: string;
  modulusEnabled?: boolean;
  modulusValue?: number;
}

export interface Settings {
  kerf: number;
  trim: number;
  timeoutMinutes?: number;
  algorithm: AlgorithmType;
  ai: AISettings;
  prioritizeStock: boolean;
  quoteMode?: 'batch' | 'centralized';
  quoteOrderPriority?: string[];
  quoteOrderIgnored?: string[];
  strictOrderPriority?: boolean;
  autoAdjustFixedLength?: boolean;
  autoAdjustMode?: 'efficiency' | 'smallMaterial';
  usePurchaseOrderLengths?: boolean;
  maxAutoLengthsCount?: number;
  modulusEnabled?: boolean;
  modulusValue?: number;
  limitLengthEnabled?: boolean;
  maxLength?: number;
  minLength?: number;
  usableOffcutLength?: number;
  ignoreModelsEnabled?: boolean;
  ignoredModels?: string[];
  substituteModelsEnabled?: boolean;
  substituteModelRules?: string[];
  substituteColorsEnabled?: boolean;
  substituteColorRules?: string[];
  printInfo: {
    project: string;
    orderNo: string;
    designer: string;
    reviewer: string;
    checker: string;
    auditor: string;
    craftsman: string;
  };
}

export type CuttingPattern = {
  count: number;
  originalLength: number;
  cuts: { length: number; count: number; demandId: string; remarks: string }[];
  waste: number;
  efficiency: number;
  isFixed: boolean; 
  orderNumber?: string;
  substituteModel?: string;
  isSubstitution?: boolean;
  substituteColor?: string;
  isColorSubstitution?: boolean;
};

export type ModelColorSummary = {
  model: string;
  color: string;
  totalQuantity: number;
  originalLength: number | string;
  totalWaste: number;
  efficiency: number;
  patterns: CuttingPattern[];
  demandSummary: string;
  isFixed?: boolean;
  substituteModel?: string;
  isSubstitution?: boolean;
  substituteColor?: string;
  isColorSubstitution?: boolean;
};

export type OptimizationSummary = {
  totalStockUsed: number;
  totalDemandFulfilled: number;
  totalWaste: number;
  averageEfficiency: number;
  summaries: ModelColorSummary[];
  unfulfilled: DemandItem[];
  adjustedFixedPlans?: Record<string, FixedLengthPlan>;
};

export type ProgressCallback = (progress: number) => void;

export function parseSubstitutionRules(rules: string[] | string = []): Map<string, { original: string; substitute: string }> {
  const map = new Map<string, { original: string; substitute: string }>();

  const processText = (text: string) => {
    if (!text || typeof text !== 'string') return;
    const lines = text.split(/[\r\n]+/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      // '/' or fullwidth '／' is the ONLY allowed separator
      const slashIdx = line.search(/[\/／]/);
      if (slashIdx !== -1) {
        const orig = line.slice(0, slashIdx).trim();
        const subst = line.slice(slashIdx + 1).trim();
        if (orig && subst && orig.toLowerCase() !== subst.toLowerCase()) {
          const ruleObj = { original: orig, substitute: subst };
          map.set(orig.toLowerCase(), ruleObj);

          const origNorm = normalizeModelName(orig);
          if (origNorm.raw) map.set(origNorm.raw, ruleObj);
          if (origNorm.noSpace) map.set(origNorm.noSpace, ruleObj);
          if (origNorm.core) map.set(origNorm.core, ruleObj);
          if (origNorm.coreNoO) map.set(origNorm.coreNoO, ruleObj);
        }
      }
    }
  };

  if (Array.isArray(rules)) {
    rules.forEach(item => {
      if (typeof item === 'string') processText(item);
    });
  } else if (typeof rules === 'string') {
    processText(rules);
  }

  return map;
}

let glpkInstance: any = null;
async function getGLPK() {
  if (!glpkInstance) {
    // @ts-ignore
    glpkInstance = await GLPK();
  }
  return glpkInstance;
}

export function normalizeModelName(str: string): { 
  raw: string; 
  noSpace: string; 
  core: string; 
  coreNoO: string;
} {
  if (!str) return { raw: '', noSpace: '', core: '', coreNoO: '' };
  
  // Convert fullwidth characters to halfwidth, strip zero-width spaces & NBSP
  let norm = str
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\u3000\u00A0]/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF\u00AD\r]/g, '');

  // Normalize all dash / hyphen / underscore / slash variants
  norm = norm.replace(/[\u2010-\u2015\u2212\uFF0D_~]/g, '-').trim().toLowerCase();

  const noSpace = norm.replace(/\s+/g, '');
  const core = norm.replace(/[^a-z0-9]/g, '');
  const coreNoO = core.replace(/o/g, '0');

  return { raw: norm, noSpace, core, coreNoO };
}

export function parseIgnoredModelsSet(settings: Settings): Set<string> {
  const set = new Set<string>();
  if (!settings || !settings.ignoreModelsEnabled) {
    return set;
  }
  const rawList = settings.ignoredModels;
  if (!rawList) return set;

  const processText = (text: string) => {
    if (!text || typeof text !== 'string') return;
    const lines = text.split(/[\r\n]+/);
    lines.forEach(rawLine => {
      const lineClean = rawLine.trim();
      if (!lineClean) return;

      set.add(lineClean.toLowerCase());

      const norm = normalizeModelName(lineClean);
      if (norm.raw) set.add(norm.raw);
      if (norm.noSpace) set.add(norm.noSpace);
      if (norm.core) set.add(norm.core);
      if (norm.coreNoO) set.add(norm.coreNoO);
    });
  };

  if (Array.isArray(rawList)) {
    rawList.forEach(item => {
      if (typeof item === 'string') processText(item);
    });
  } else if (typeof rawList === 'string') {
    processText(rawList);
  }

  return set;
}

export function isModelIgnored(model: string, ignoredSet: Set<string>): boolean {
  if (!model || ignoredSet.size === 0) return false;

  const trimmed = model.trim().toLowerCase();
  if (ignoredSet.has(trimmed)) return true;

  const norm = normalizeModelName(model);
  if (norm.raw && ignoredSet.has(norm.raw)) return true;
  if (norm.noSpace && ignoredSet.has(norm.noSpace)) return true;
  if (norm.core && ignoredSet.has(norm.core)) return true;
  if (norm.coreNoO && ignoredSet.has(norm.coreNoO)) return true;

  return false;
}

export function isOffcutPurchaseItem(p: PurchaseItem): boolean {
  if (!p) return false;
  const ord = (p.orderNumber || '').trim();
  const rem = (p.remarks || '').trim();
  return (
    ord === '料头利用' ||
    ord.includes('料头') ||
    ord.includes('余料') ||
    rem.includes('料头') ||
    rem.includes('余料') ||
    rem.includes('来自<')
  );
}

export function getValidPurchaseLengthsForModel(
  model: string,
  purchases: PurchaseItem[],
  settings: Settings
): number[] {
  if (!purchases || purchases.length === 0 || !model) return [];

  const minL = (settings.limitLengthEnabled && settings.minLength) ? settings.minLength : 0;
  const maxL = (settings.limitLengthEnabled && settings.maxLength) ? settings.maxLength : Infinity;
  const modulus = (settings.modulusEnabled && settings.modulusValue && settings.modulusValue > 0) ? settings.modulusValue : 0;

  const validItems = purchases.filter(p => {
    if (!p || p.length <= 0) return false;
    if (p.model.trim().toLowerCase() !== model.trim().toLowerCase()) return false;
    if (isOffcutPurchaseItem(p)) return false; // 排除料头利用
    if (settings.limitLengthEnabled) {
      if (p.length < minL || p.length > maxL) return false; // 满足长度限制
    }
    if (modulus > 0) {
      if (p.length % modulus !== 0) return false; // 满足模数要求
    }
    return true;
  });

  const uniqueLens = Array.from(new Set(validItems.map(p => p.length))).sort((a, b) => b - a);
  const maxCount = Math.min(Math.max(1, settings.maxAutoLengthsCount ?? 6), 6);
  return uniqueLens.slice(0, maxCount);
}

/**
 * 1D Bin Packing Optimizer
 */
export async function optimizeCutting(
  inputDemands: DemandItem[],
  inputStocks: StockItem[],
  fixedPlans: Record<string, FixedLengthPlan>,
  settings: Settings,
  purchases: PurchaseItem[] = [],
  onProgress?: (progress: number) => void
): Promise<OptimizationSummary> {
  const ignoredSet = parseIgnoredModelsSet(settings);

  const subModelMap = (settings.substituteModelsEnabled && settings.substituteModelRules) 
    ? parseSubstitutionRules(settings.substituteModelRules) 
    : new Map<string, { original: string; substitute: string }>();

  const demands = inputDemands.filter(d => {
    if (!d || d.quantity <= 0 || d.length <= 0) return false;
    if (settings.ignoreModelsEnabled && ignoredSet.size > 0) {
      const model = d.model || '';
      if (isModelIgnored(model, ignoredSet)) {
        return false;
      }
      if (settings.substituteModelsEnabled && subModelMap.size > 0) {
        const modelClean = model.trim().toLowerCase();
        const subRule = subModelMap.get(modelClean) || subModelMap.get(normalizeModelName(model).noSpace) || subModelMap.get(normalizeModelName(model).core);
        if (subRule && isModelIgnored(subRule.substitute, ignoredSet)) {
          return false;
        }
      }
    }
    return true;
  });
  const stocks = inputStocks.filter(s => s.quantity > 0 && s.length > 0).map(s => {
      let length = s.length;
      if (length < 100) length = Math.floor(length * 100) / 100;
      else length = Math.floor(length / 10) * 10;
      return {...s, length};
  });
  const actualFixedPlans: Record<string, FixedLengthPlan> = { ...fixedPlans };
  
  // Ensure all demands have at least a default plan if not explicitly provided
  demands.forEach(d => {
    if (!actualFixedPlans[d.model]) {
      actualFixedPlans[d.model] = { model: d.model, lengths: [6000, 0, 0, 0, 0, 0] };
    }
  });

  const allModels = new Set([...Object.keys(actualFixedPlans), ...demands.map(d => d.model)]);

  const runAlgo = async (dems: DemandItem[], stks: StockItem[], plans: Record<string, FixedLengthPlan>, sets: Settings, prog?: (p:number)=>void): Promise<OptimizationSummary> => {
    if (true /* forced batch quote */) {
       const orderPriority = sets.quoteOrderPriority || [];
       const distinctOrdersSet = new Set<string>();
       dems.forEach(d => distinctOrdersSet.add(d.orderNumber || ''));
       const orders = Array.from(distinctOrdersSet).sort((a, b) => {
          const ia = orderPriority.indexOf(a);
          const ib = orderPriority.indexOf(b);
          if (ia !== -1 && ib !== -1) return ia - ib;
          if (ia !== -1) return -1;
          if (ib !== -1) return 1;
          return a.localeCompare(b);
       });

       let currentStocks = stks.map(s => ({...s})).filter(s => !(sets.quoteOrderIgnored || []).includes(s.orderNumber || ''));
       let combinedSummaries: ModelColorSummary[] = [];
       let combinedUnfulfilled: DemandItem[] = [];

       for (let i = 0; i < orders.length; i++) {
           const ord = orders[i];
           const ordDemands = dems.filter(d => (d.orderNumber || '') === ord);
           if (ordDemands.length === 0) continue;
           
           let res: OptimizationSummary;
           const subProg = prog ? (p: number) => prog((i / orders.length) * 100 + (p / orders.length)) : undefined;
           if (sets.algorithm === 'FFD') {
              res = await optimizeCuttingFFD(ordDemands, currentStocks, plans, sets, subProg);
           } else {
              res = await optimizeCuttingMIP(ordDemands, currentStocks, plans, sets, purchases, subProg);
           }
           
           res.summaries.forEach(s => {
              if (ord) {
                 s.patterns.forEach(p => {
                    if (!p.orderNumber) p.orderNumber = ord;
                 });
              }
              
              s.patterns.forEach(p => {
                 if (!p.isFixed && p.count > 0) {
                     const targetModel = (p.isSubstitution && p.substituteModel) ? p.substituteModel : s.model;
                     const consumedStock = currentStocks.find(st => 
                       st.model.trim().toLowerCase() === targetModel.trim().toLowerCase() && 
                       st.color === s.color && 
                       st.length === p.originalLength &&
                       (!p.orderNumber || st.orderNumber === p.orderNumber) &&
                       st.quantity > 0
                     ) || currentStocks.find(st => 
                       st.model.trim().toLowerCase() === targetModel.trim().toLowerCase() && 
                       st.color === s.color && 
                       st.length === p.originalLength &&
                       st.quantity > 0
                     );
                     if (consumedStock) consumedStock.quantity -= p.count;
                 }
              });
              combinedSummaries.push(s);
           });
           res.unfulfilled.forEach(u => combinedUnfulfilled.push(u));
       }

       const totalStockUsed = combinedSummaries.reduce((sum, s) => sum + s.patterns.reduce((pSum, p) => pSum + p.originalLength * p.count, 0), 0);
       const totalDemandFulfilled = combinedSummaries.reduce((sum, s) => sum + s.patterns.reduce((pSum, p) => pSum + p.cuts.reduce((cSum, c) => cSum + c.length * c.count, 0) * p.count, 0), 0);
       const totalWaste = combinedSummaries.reduce((sum, s) => sum + s.totalWaste, 0);
       const averageEfficiency = totalStockUsed > 0 ? (totalDemandFulfilled / totalStockUsed) * 100 : 0;
       
       return { totalStockUsed, totalDemandFulfilled, totalWaste, averageEfficiency, summaries: combinedSummaries, unfulfilled: combinedUnfulfilled };
    } else {
       if (sets.algorithm === 'FFD') return await optimizeCuttingFFD(dems, stks, plans, sets, prog);
       else return await optimizeCuttingMIP(dems, stks, plans, sets, purchases, prog);
    }
  };

  if (settings.autoAdjustFixedLength) {
    const minL = settings.limitLengthEnabled && settings.minLength ? settings.minLength : 3000;
    const maxL = settings.limitLengthEnabled && settings.maxLength ? settings.maxLength : 7000;
    const step = settings.modulusEnabled && settings.modulusValue ? settings.modulusValue : 100;
    
    const adjusted: Record<string, FixedLengthPlan> = {};
    
    // Evaluate per model
    for (const model of Array.from(allModels)) {
      const originalPlan = actualFixedPlans[model] || { model, lengths: [6000, 0, 0, 0, 0, 0] };
      // 1. 如果已锁定，严格保留原方案
      if (originalPlan.isPinned) {
        adjusted[model] = originalPlan;
        continue;
      }
      
      const modelDemands = demands.filter(d => d.model === model);
      if (modelDemands.length === 0) {
        adjusted[model] = originalPlan;
        continue;
      }
      
      const modelStocks = stocks.filter(s => s.model === model);

      // 2. 如果开启优先消耗库存，先测试库存是否足以完全满足该型号下料（无需消耗定尺）
      if (settings.prioritizeStock && modelStocks.length > 0) {
        const stockTest = await optimizeCuttingFFD(
          modelDemands,
          modelStocks,
          { [model]: { model, lengths: [] } },
          { ...settings, autoAdjustFixedLength: false },
          undefined
        );
        if (stockTest.unfulfilled.length === 0) {
          // 全部由库存消耗完成，没有消耗定尺，不需要修改定尺方案
          adjusted[model] = originalPlan;
          continue;
        }
      }
      
      let candMin = minL;
      if (settings.modulusEnabled && settings.modulusValue) {
        candMin = Math.ceil(candMin / step) * step;
      } else {
        candMin = Math.ceil(candMin);
      }
      
      const candidateLengths: number[] = [];

      // 3. 优先采用采购单定尺（排除料头利用，并满足长度限制、模数要求）
      if (settings.usePurchaseOrderLengths && purchases.length > 0) {
        const validPurchaseLens = getValidPurchaseLengthsForModel(model, purchases, settings);
        if (validPurchaseLens.length > 0) {
          candidateLengths.push(...validPurchaseLens.sort((a, b) => a - b));
        }
      }

      // 如果未启用采购单定尺或采购单中未找到满足条件的定尺，则生成候选定尺方案（满足模数和长度限制）
      if (candidateLengths.length === 0) {
        if (settings.autoAdjustMode === 'smallMaterial') {
          const itemTrim = originalPlan.trim ?? settings.trim;
          const candSet = new Set<number>();
          for (const d of modelDemands) {
            for (let cutCount = 1; ; cutCount++) {
              const exactLength = (d.length + settings.kerf) * cutCount + itemTrim * 2;
              const candL = Math.ceil(exactLength / step) * step;
              if (candL > maxL) break;
              if (candL >= minL) {
                candSet.add(candL);
              }
            }
          }
          candidateLengths.push(...Array.from(candSet).sort((a, b) => a - b));
        } else {
          for (let l = candMin; l <= maxL; l += step) {
            candidateLengths.push(l);
          }
        }
      }

      if (candidateLengths.length === 0) {
        candidateLengths.push(originalPlan.lengths.find((v: number) => v > 0) || 6000);
      }

      const maxCounts = Math.min(Math.max(1, settings.maxAutoLengthsCount ?? 6), 6);
      let selectedLengths: number[] = [];
      
      if (onProgress) onProgress(10);
      
      // Multi-pass forward selection (fast FFD)
      let overallBestScore = -Infinity;
      
      for (let pass = 0; pass < maxCounts; pass++) {
         let bestLen = 0;
         let bestEfficiency = -Infinity;
         
         for (const cand of candidateLengths) {
            if (selectedLengths.includes(cand)) continue;
            
            const testLengths = [...selectedLengths, cand];
            const testPlan = { ...originalPlan, lengths: testLengths };
            
            // FFD Without progress yielding for speed
            const testResult = await optimizeCuttingFFD(modelDemands, modelStocks, { [model]: testPlan }, { ...settings, autoAdjustFixedLength: false }, undefined);
            
            const unfulfilledQty = testResult.unfulfilled.reduce((sum, u) => sum + u.quantity, 0);
            let score: number;
            if (settings.autoAdjustMode === 'smallMaterial') {
              const minDemandLength = modelDemands.length > 0 ? Math.min(...modelDemands.map(d => d.length)) : 150;
              const reusableThreshold = minDemandLength;
              
              let totalReusableLeftovers = 0;
              let totalStockUsed = 0;
              let totalDemandFulfilled = 0;
              
              for (const s of testResult.summaries) {
                if (s.model !== model) continue;
                for (const p of s.patterns) {
                  const patternStockLength = p.originalLength;
                  const patternCount = p.count;
                  const patternWaste = p.waste;
                  
                  totalStockUsed += patternStockLength * patternCount;
                  totalDemandFulfilled += p.cuts.reduce((sum, c) => sum + c.length * c.count, 0) * patternCount;
                  
                  if (patternWaste >= reusableThreshold) {
                    totalReusableLeftovers += patternWaste * patternCount;
                  }
                }
              }
              
              const adjustedStock = totalStockUsed - totalReusableLeftovers;
              const adjustedEff = adjustedStock > 0 ? (totalDemandFulfilled / adjustedStock) * 100 : 0;
              score = adjustedEff - (unfulfilledQty * 1000000); // Heavily penalize unfulfilled
            } else {
              score = testResult.averageEfficiency - (unfulfilledQty * 1000); // Heavily penalize unfulfilled
            }

            // Check if cand was actually used
            const candOriginalStr = (cand / 1000).toFixed(2) + ' (定尺)';
            const wasUsed = testResult.summaries.some((s: any) => s.originalLength === candOriginalStr);

            if (score > bestEfficiency) {
              if (pass === 0 || wasUsed) {
                bestEfficiency = score;
                bestLen = cand;
              }
            }
         }
         
         if (bestLen > 0) {
            if (pass === 0) {
              overallBestScore = bestEfficiency;
              selectedLengths.push(bestLen);
            } else {
              if (bestEfficiency >= overallBestScore - 1) {
                overallBestScore = Math.max(overallBestScore, bestEfficiency);
                selectedLengths.push(bestLen);
              } else {
                break; // Adding any more lengths hurts efficiency too much
              }
            }
         } else {
            break; // No more candidates
         }
      }
      
      // pad with 0
      while (selectedLengths.length < 6) selectedLengths.push(0);
      adjusted[model] = { ...originalPlan, lengths: selectedLengths };
    }

    if (onProgress) onProgress(50);
    
    // Second pass: Re-run optimization using the adjusted plans
    const secondPassSettings = { ...settings, autoAdjustFixedLength: false };
    
    let finalResult = await runAlgo(demands, stocks, adjusted, secondPassSettings, p => onProgress?.(50 + p / 2));
    
    // 最终校验：如果没有消耗定尺（0根定尺被使用），则不需要修改定尺方案，恢复原方案
    const modelsConsumingFixed = new Set<string>();
    finalResult.summaries.forEach(s => {
      s.patterns.forEach(p => {
        if (p.isFixed && p.count > 0) {
          modelsConsumingFixed.add(s.model);
        }
      });
    });

    const finalAdjustedPlans: Record<string, FixedLengthPlan> = {};
    for (const model of Array.from(allModels)) {
      const orig = actualFixedPlans[model] || { model, lengths: [6000, 0, 0, 0, 0, 0] };
      if (orig.isPinned || !modelsConsumingFixed.has(model)) {
        // 锁定或没有消耗定尺 -> 不需要修改定尺方案
        finalAdjustedPlans[model] = orig;
      } else {
        finalAdjustedPlans[model] = adjusted[model] || orig;
      }
    }

    finalResult.adjustedFixedPlans = finalAdjustedPlans;
    return finalResult;
  }

  // settings.autoAdjustFixedLength 为 false 时的处理流程
  const trialPlans: Record<string, FixedLengthPlan> = { ...actualFixedPlans };
  const purchasePlanForModel: Record<string, FixedLengthPlan> = {};

  if (settings.usePurchaseOrderLengths && purchases.length > 0) {
    for (const model of Array.from(allModels)) {
      const oldPlan = actualFixedPlans[model] || { model, lengths: [6000, 0, 0, 0, 0, 0] };
      if (oldPlan.isPinned) {
        continue;
      }
      const purchaseLens = getValidPurchaseLengthsForModel(model, purchases, settings);
      if (purchaseLens.length > 0) {
        const lengths: number[] = [0, 0, 0, 0, 0, 0];
        for (let i = 0; i < Math.min(purchaseLens.length, 6); i++) {
          lengths[i] = purchaseLens[i];
        }
        const newPlan = { ...oldPlan, lengths };
        trialPlans[model] = newPlan;
        purchasePlanForModel[model] = newPlan;
      }
    }
  }

  const finalResult = await runAlgo(demands, stocks, trialPlans, settings, onProgress);

  if (settings.usePurchaseOrderLengths && purchases.length > 0) {
    const modelsConsumingFixed = new Set<string>();
    finalResult.summaries.forEach(s => {
      s.patterns.forEach(p => {
        if (p.isFixed && p.count > 0) {
          modelsConsumingFixed.add(s.model);
        }
      });
    });

    const finalAdjustedPlans: Record<string, FixedLengthPlan> = {};
    for (const model of Array.from(allModels)) {
      const orig = actualFixedPlans[model] || { model, lengths: [6000, 0, 0, 0, 0, 0] };
      if (orig.isPinned || !modelsConsumingFixed.has(model)) {
        // 锁定或没有消耗定尺 -> 不需要修改定尺方案
        finalAdjustedPlans[model] = orig;
      } else if (purchasePlanForModel[model]) {
        // 消耗了定尺且有采购单定尺 -> 采用采购单定尺方案
        finalAdjustedPlans[model] = purchasePlanForModel[model];
      } else {
        finalAdjustedPlans[model] = orig;
      }
    }
    finalResult.adjustedFixedPlans = finalAdjustedPlans;
  }

  return finalResult;
}

export async function optimizeCuttingFFD(
  demands: DemandItem[],
  stocks: StockItem[],
  fixedPlans: Record<string, FixedLengthPlan>,
  settings: Settings,
  onProgress?: (progress: number) => void
): Promise<OptimizationSummary> {
  const { kerf, trim: globalTrim } = settings;
  const summaries: ModelColorSummary[] = [];
  const unfulfilled: DemandItem[] = [];

  const subModelMap = (settings.substituteModelsEnabled && settings.substituteModelRules) 
    ? parseSubstitutionRules(settings.substituteModelRules) 
    : new Map<string, { original: string; substitute: string }>();

  const subColorMap = (settings.substituteColorsEnabled && settings.substituteColorRules) 
    ? parseSubstitutionRules(settings.substituteColorRules) 
    : new Map<string, { original: string; substitute: string }>();

  const groups = new Map<string, { d: DemandItem[]; s: StockItem[]; f: FixedLengthPlan | null }>();

  demands.forEach((d) => {
    const key = `${d.model}|${d.color}`;
    if (!groups.has(key)) {
      groups.set(key, { d: [], s: [], f: fixedPlans[d.model] || null });
    }
    groups.get(key)!.d.push({ ...d });
  });

  if (settings.prioritizeStock) {
    stocks.forEach((s) => {
      const key = `${s.model}|${s.color}`;
      if (groups.has(key)) {
        groups.get(key)!.s.push({ ...s });
      }
    });
  }

  const groupEntries = Array.from(groups.entries());
  let processedGroups = 0;

  for (const [key, group] of groupEntries) {
    const [model, color] = key.split("|");
    const subRuleModel = subModelMap.get(model.trim().toLowerCase());
    const substituteModelName = subRuleModel?.substitute;

    const subRuleColor = subColorMap.get(color.trim().toLowerCase());
    const substituteColorName = subRuleColor?.substitute;

    const groupBaseProgress = (processedGroups / groupEntries.length) * 100;
    const groupWeight = 100 / groupEntries.length;
    processedGroups++;
    
    let pieces: { id: string; length: number; remarks: string }[] = [];
    group.d.forEach((d) => {
      for (let i = 0; i < d.quantity; i++) {
        pieces.push({ id: d.id, length: d.length, remarks: d.remarks });
      }
    });
    pieces.sort((a, b) => b.length - a.length);

    let realStock: { id: string; length: number; remaining: number; cuts: any[]; trim: number; isFixed: boolean; orderNumber?: string; isSubstituteModel?: boolean; stockModel?: string; isSubstituteColor?: boolean; stockColor?: string }[] = [];
    group.s.forEach((s) => {
      for (let i = 0; i < s.quantity; i++) {
        const usable = s.length - globalTrim * 2;
        if (usable > 0) {
          realStock.push({ id: s.id, length: s.length, remaining: usable, cuts: [], trim: globalTrim, isFixed: false, orderNumber: s.orderNumber, isSubstituteModel: false, stockModel: s.model, isSubstituteColor: false, stockColor: s.color });
        }
      }
    });

    if (substituteModelName) {
      const subStocks = stocks.filter(s => s.quantity > 0 && s.length > 0 && s.model.trim().toLowerCase() === substituteModelName.toLowerCase() && s.color.trim().toLowerCase() === color.trim().toLowerCase());
      subStocks.forEach((s) => {
        for (let i = 0; i < s.quantity; i++) {
          const usable = s.length - globalTrim * 2;
          if (usable > 0) {
            realStock.push({ id: s.id, length: s.length, remaining: usable, cuts: [], trim: globalTrim, isFixed: false, orderNumber: s.orderNumber, isSubstituteModel: true, stockModel: s.model, isSubstituteColor: false, stockColor: s.color });
          }
        }
      });
    }

    if (substituteColorName) {
      const subColorStocks = stocks.filter(s => s.quantity > 0 && s.length > 0 && s.model.trim().toLowerCase() === model.trim().toLowerCase() && s.color.trim().toLowerCase() === substituteColorName.toLowerCase());
      subColorStocks.forEach((s) => {
        for (let i = 0; i < s.quantity; i++) {
          const usable = s.length - globalTrim * 2;
          if (usable > 0) {
            realStock.push({ id: s.id, length: s.length, remaining: usable, cuts: [], trim: globalTrim, isFixed: false, orderNumber: s.orderNumber, isSubstituteModel: false, stockModel: s.model, isSubstituteColor: true, stockColor: s.color });
          }
        }
      });
    }

    if (substituteModelName && substituteColorName) {
      const subBothStocks = stocks.filter(s => s.quantity > 0 && s.length > 0 && s.model.trim().toLowerCase() === substituteModelName.toLowerCase() && s.color.trim().toLowerCase() === substituteColorName.toLowerCase());
      subBothStocks.forEach((s) => {
        for (let i = 0; i < s.quantity; i++) {
          const usable = s.length - globalTrim * 2;
          if (usable > 0) {
            realStock.push({ id: s.id, length: s.length, remaining: usable, cuts: [], trim: globalTrim, isFixed: false, orderNumber: s.orderNumber, isSubstituteModel: true, stockModel: s.model, isSubstituteColor: true, stockColor: s.color });
          }
        }
      });
    }

    const isBatchQuote = true; // settings.quoteMode === 'batch';
    const pp = settings.quoteOrderPriority || [];
    const isStrict = Boolean(settings.strictOrderPriority && settings.prioritizeStock);

    const getStockOrderRank = (orderNumber?: string) => {
      const idx = pp.indexOf(orderNumber || '');
      return idx === -1 ? pp.length : idx;
    };

    const getSubScore = (isSubModel?: boolean, isSubColor?: boolean) => {
      return (isSubModel ? 1 : 0) + (isSubColor ? 1 : 0);
    };

    const getStockPriorityTier = (s: { orderNumber?: string; isSubstituteModel?: boolean; isSubstituteColor?: boolean }) => {
      const subScore = getSubScore(s.isSubstituteModel, s.isSubstituteColor);
      const orderRank = getStockOrderRank(s.orderNumber);
      return subScore * 1000000 + orderRank;
    };

    realStock.sort((a, b) => {
      const subScoreA = (a.isSubstituteModel ? 1 : 0) + (a.isSubstituteColor ? 1 : 0);
      const subScoreB = (b.isSubstituteModel ? 1 : 0) + (b.isSubstituteColor ? 1 : 0);
      if (subScoreA !== subScoreB) {
        return subScoreA - subScoreB;
      }
      if (isBatchQuote) {
         const idxA = pp.indexOf(a.orderNumber || '');
         const idxB = pp.indexOf(b.orderNumber || '');
         const effA = idxA === -1 ? 99999 : idxA;
         const effB = idxB === -1 ? 99999 : idxB;
         if (effA !== effB) return effA - effB;
      }
      return b.length - a.length;
    });

    let fixedLengths = (group.f?.lengths || []).filter(len => len > 0);
    const itemTrim = group.f?.trim ?? globalTrim;
    const availableStock: any[] = [];
    let unusedStock = [...realStock];
    let piecesToPlace = [...pieces];
    let piecesPlacedCount = 0;

    while (piecesToPlace.length > 0) {
      if (onProgress && pieces.length > 0) {
        const subProgress = (piecesPlacedCount / pieces.length) * groupWeight;
        onProgress(Math.min(99, Math.round(groupBaseProgress + subProgress)));
      }
      
      // Periodically yield for large batches only if progress tracking is needed
      if (onProgress && piecesPlacedCount > 0 && piecesPlacedCount % 100 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      // 1. Identify all candidate bin options
      const binCandidates: { 
        length: number; 
        isFixed: boolean; 
        stockIdx: number; 
        trim: number; 
        isSubstituteModel?: boolean; 
        stockModel?: string; 
        isSubstituteColor?: boolean; 
        stockColor?: string;
        orderNumber?: string;
        orderRank: number;
      }[] = [];
      
      const minPieceLen = piecesToPlace[piecesToPlace.length - 1].length;
      const fitableStocks = unusedStock.filter(s => (s.length - globalTrim * 2) >= minPieceLen);

      if (isStrict) {
        if (fitableStocks.length > 0) {
          // Strictly only evaluate stocks from the highest priority tier that can fit at least one piece
          const topRank = Math.min(...fitableStocks.map(getStockPriorityTier));
          const eligibleStocks = unusedStock.filter(s => getStockPriorityTier(s) === topRank && (s.length - globalTrim * 2) >= minPieceLen);
          
          const uniqueUnusedStock = new Map<string, number>();
          eligibleStocks.forEach((s) => {
            const stockKey = `${s.length}-${s.orderNumber || ''}-${s.isSubstituteModel ? 'sm' : 'pm'}-${s.stockModel || ''}-${s.isSubstituteColor ? 'sc' : 'pc'}-${s.stockColor || ''}`;
            if (!uniqueUnusedStock.has(stockKey)) {
              const idx = unusedStock.indexOf(s);
              uniqueUnusedStock.set(stockKey, idx);
            }
          });
          uniqueUnusedStock.forEach((idx) => {
            const s = unusedStock[idx];
            binCandidates.push({ 
              length: s.length, 
              isFixed: false, 
              stockIdx: idx, 
              trim: globalTrim, 
              isSubstituteModel: s.isSubstituteModel, 
              stockModel: s.stockModel, 
              isSubstituteColor: s.isSubstituteColor, 
              stockColor: s.stockColor,
              orderNumber: s.orderNumber,
              orderRank: getStockOrderRank(s.orderNumber)
            });
          });
        } else {
          // Only when NO stock from ANY order can fit any piece do we fallback to fixed length
          fixedLengths.forEach(len => {
            binCandidates.push({ length: len, isFixed: true, stockIdx: -1, trim: itemTrim, orderRank: 9999999 });
          });
        }
      } else {
        // Non-strict: all unique stocks and fixed lengths can be candidate bins
        const uniqueUnusedStock = new Map<string, number>();
        unusedStock.forEach((s, idx) => {
          const stockKey = `${s.length}-${s.orderNumber || ''}-${s.isSubstituteModel ? 'sm' : 'pm'}-${s.stockModel || ''}-${s.isSubstituteColor ? 'sc' : 'pc'}-${s.stockColor || ''}`;
          if (!uniqueUnusedStock.has(stockKey)) {
            uniqueUnusedStock.set(stockKey, idx);
          }
        });
        uniqueUnusedStock.forEach((idx) => {
          const s = unusedStock[idx];
          binCandidates.push({ 
            length: s.length, 
            isFixed: false, 
            stockIdx: idx, 
            trim: globalTrim, 
            isSubstituteModel: s.isSubstituteModel, 
            stockModel: s.stockModel, 
            isSubstituteColor: s.isSubstituteColor, 
            stockColor: s.stockColor,
            orderNumber: s.orderNumber,
            orderRank: getStockOrderRank(s.orderNumber)
          });
        });

        fixedLengths.forEach(len => {
          binCandidates.push({ length: len, isFixed: true, stockIdx: -1, trim: itemTrim, orderRank: 9999999 });
        });
      }

      let bestBinChoice: any = null;
      let highestOverallEfficiency = -1;

      // 2. Evaluate each bin candidate 
      for (const cand of binCandidates) {
        const usable = cand.length - cand.trim * 2;
        if (usable <= 0) continue;

        // Use a bounded search with pruning for the best combination in this bin
        const findBestCombination = (target: number, availablePieces: any[], maxSteps: number = 2000): { cuts: any[], indices: number[], waste: number } => {
          let bestCuts: any[] = [];
          let bestIndices: number[] = [];
          let minWaste = target;
          let steps = 0;

          const backtrack = (rem: number, startIdx: number, currentCuts: any[], currentIndices: number[]) => {
            steps++;
            if (rem < minWaste) {
              minWaste = rem;
              bestCuts = [...currentCuts];
              bestIndices = [...currentIndices];
            }
            if (minWaste < 0.1 || steps >= maxSteps) return;

            for (let i = startIdx; i < availablePieces.length; i++) {
              if (steps >= maxSteps) return;
              
              // Prune duplicate consecutive lengths
              if (i > startIdx && availablePieces[i].length === availablePieces[i - 1].length) continue;

              const p = availablePieces[i];
              const pieceWithKerf = p.length + (currentCuts.length > 0 ? kerf : 0);
              
              if (rem >= pieceWithKerf) {
                currentCuts.push({ ...p, demandId: p.id });
                currentIndices.push(i);
                backtrack(rem - pieceWithKerf, i + 1, currentCuts, currentIndices);
                currentIndices.pop();
                currentCuts.pop();
                if (minWaste < 0.1)  break;
              }
            }
          };

          backtrack(target, 0, [], []);
          
          return { cuts: bestCuts, indices: bestIndices, waste: minWaste };
        };

        const result = findBestCombination(usable, piecesToPlace);
        if (result.cuts.length === 0) continue;

        let efficiency = (usable - result.waste) / usable;
        
        // Prioritize stock in sequence: Primary stock (+3000) > 1-sub stock (+2000) > 2-sub stock (+1000) > Fixed-length plan (+0)
        let adjustedEfficiency = efficiency;
        if (!cand.isFixed) {
          const subCount = (cand.isSubstituteModel ? 1 : 0) + (cand.isSubstituteColor ? 1 : 0);
          if (subCount === 0) {
            adjustedEfficiency += 3000;
          } else if (subCount === 1) {
            adjustedEfficiency += 2000;
          } else {
            adjustedEfficiency += 1000;
          }
          if (!isStrict) {
            // When not strictly following order, allow lower priority orders with higher efficiency to be picked
            adjustedEfficiency -= cand.orderRank * 0.05;
          }
        }

        if (adjustedEfficiency > highestOverallEfficiency || 
           (Math.abs(adjustedEfficiency - highestOverallEfficiency) < 0.0001 && cand.length < (bestBinChoice?.cand.length || Infinity))) {
          highestOverallEfficiency = adjustedEfficiency;
          bestBinChoice = { 
            cand, 
            cuts: result.cuts, 
            indices: result.indices, 
            efficiency 
          };
        }
      }

      // 3. Commit the best bin choice
      if (bestBinChoice) {
        const { cand, cuts } = bestBinChoice;
        
        // Find how many times we can repeat this EXACT cut pattern
        const reqCounts = new Map<number, number>();
        cuts.forEach((c: any) => reqCounts.set(c.length, (reqCounts.get(c.length) || 0) + 1));
        
        const availPieces = new Map<number, Array<{id: string; length: number; remarks: string}>>();
        piecesToPlace.forEach(p => {
          if (!availPieces.has(p.length)) availPieces.set(p.length, []);
          availPieces.get(p.length)!.push(p);
        });

        // Calculate K (max times this pattern can be repeatedly applied)
        let K = Infinity;
        reqCounts.forEach((reqQty, len) => {
          const availList = availPieces.get(len) || [];
          K = Math.min(K, Math.floor(availList.length / reqQty));
        });

        if (!cand.isFixed) {
          const stockCount = unusedStock.filter(s => 
            s.length === cand.length && 
            (s.orderNumber || '') === (cand.orderNumber || '') &&
            Boolean(s.isSubstituteModel) === Boolean(cand.isSubstituteModel) && 
            (!cand.isSubstituteModel || s.stockModel === cand.stockModel) &&
            Boolean(s.isSubstituteColor) === Boolean(cand.isSubstituteColor) &&
            (!cand.isSubstituteColor || s.stockColor === cand.stockColor)
          ).length;
          K = Math.min(K, stockCount);
        }

        if (K <= 0) K = 1; 

        // Apply K times
        for (let k = 0; k < K; k++) {
          const actualCutsForThisBin: any[] = [];
          
          reqCounts.forEach((reqQty, len) => {
             const list = availPieces.get(len)!;
             for (let r = 0; r < reqQty; r++) {
               const p = list.shift()!;
               actualCutsForThisBin.push({ ...p, demandId: p.id });
             }
          });

          // Sort cuts descending within the bin
          actualCutsForThisBin.sort((a, b) => b.length - a.length);

          const totalCut = actualCutsForThisBin.reduce((sum, c) => sum + c.length, 0);
          const usable = cand.length - (cand.trim * 2);
          
          let binId;
          let orderNumberStr;
          let isSubModel = false;
          let subModelStr = undefined;
          let isSubColor = false;
          let subColorStr = undefined;

          if (cand.isFixed) {
            binId = `fixed-${model}-${cand.length}-${availableStock.length}`;
          } else {
            const stockItemIndex = unusedStock.findIndex(s => 
              s.length === cand.length && 
              (s.orderNumber || '') === (cand.orderNumber || '') &&
              Boolean(s.isSubstituteModel) === Boolean(cand.isSubstituteModel) && 
              (!cand.isSubstituteModel || s.stockModel === cand.stockModel) &&
              Boolean(s.isSubstituteColor) === Boolean(cand.isSubstituteColor) &&
              (!cand.isSubstituteColor || s.stockColor === cand.stockColor)
            );
            const stockItem = unusedStock[stockItemIndex];
            binId = stockItem.id;
            orderNumberStr = stockItem.orderNumber;
            isSubModel = stockItem.isSubstituteModel || false;
            subModelStr = stockItem.stockModel;
            isSubColor = stockItem.isSubstituteColor || false;
            subColorStr = stockItem.stockColor;
            unusedStock.splice(stockItemIndex, 1);
          }

          availableStock.push({
            id: binId,
            length: cand.length,
            remaining: Math.max(0, usable - totalCut - (actualCutsForThisBin.length > 1 ? (actualCutsForThisBin.length - 1) * kerf : 0)),
            cuts: actualCutsForThisBin,
            trim: cand.trim,
            isFixed: cand.isFixed,
            orderNumber: orderNumberStr,
            isSubstituteModel: isSubModel,
            substituteModel: subModelStr,
            isSubstituteColor: isSubColor,
            substituteColor: subColorStr
          });
          
          piecesPlacedCount += actualCutsForThisBin.length;
        }

        // Rebuild available pieces for next iteration
        piecesToPlace = [];
        availPieces.forEach(list => piecesToPlace.push(...list));
        piecesToPlace.sort((a,b) => b.length - a.length);
      } else {
        // No bin can fit even the smallest remaining piece
        const piece = piecesToPlace[0];
        const existing = unfulfilled.find(u => u.id === piece.id && u.model === model && u.color === color);
        if (existing) {
          existing.quantity++;
        } else {
          const original = group.d.find(d => d.id === piece.id)!;
          unfulfilled.push({ ...original, quantity: 1 });
        }
        piecesToPlace.shift();
        piecesPlacedCount++;
      }
    }

    const patterns: CuttingPattern[] = [];
    availableStock.forEach((stock) => {
      if (stock.cuts.length > 0) {
        const totalCut = stock.cuts.reduce((sum, c) => sum + c.length, 0);
        const waste = stock.length - totalCut - (stock.trim * 2) - (stock.cuts.length > 1 ? (stock.cuts.length - 1) * kerf : 0);
        const groupedCutsMap = new Map<string, { length: number; count: number; demandId: string; remarks: string }>();
        stock.cuts.forEach(c => {
          const cutKey = `${c.length}-${c.remarks}`;
          if (!groupedCutsMap.has(cutKey)) {
            groupedCutsMap.set(cutKey, { length: c.length, count: 0, demandId: c.demandId, remarks: c.remarks });
          }
          groupedCutsMap.get(cutKey)!.count++;
        });
        const groupedCuts = Array.from(groupedCutsMap.values());
        const patternKey = `${stock.length}|${stock.trim}|${stock.isFixed}|${stock.orderNumber || ''}|${groupedCuts.map(c => `${c.length}x${c.count}`).join(';')}`;
        const existingPattern = patterns.find(p => {
          const pKey = `${p.originalLength}|${stock.trim}|${p.isFixed}|${p.orderNumber || ''}|${p.cuts.map(c => `${c.length}x${c.count}`).join(';')}`;
          return pKey === patternKey;
        });
        if (existingPattern) {
          existingPattern.count++;
        } else {
          patterns.push({
            count: 1,
            originalLength: stock.length,
            cuts: groupedCuts,
            waste: Math.max(0, waste),
            efficiency: (totalCut / stock.length) * 100,
            isFixed: stock.isFixed,
            orderNumber: stock.orderNumber,
            isSubstitution: stock.isSubstituteModel,
            substituteModel: stock.substituteModel,
            isColorSubstitution: stock.isSubstituteColor,
            substituteColor: stock.substituteColor
          });
        }
      }
    });

    // Group patterns by originalLength AND isFixed AND orderNumber
    const patternsByGroup = new Map<string, CuttingPattern[]>();
    patterns.forEach(p => {
      const gKey = `${p.originalLength}|${p.isFixed}|${p.orderNumber || ''}`;
      const existing = patternsByGroup.get(gKey) || [];
      existing.push(p);
      patternsByGroup.set(gKey, existing);
    });

    const demandCounts = new Map<number, number>();
    group.d.forEach(d => {
      demandCounts.set(d.length, (demandCounts.get(d.length) || 0) + d.quantity);
    });
    const demandSummary = Array.from(demandCounts.entries()).sort((a, b) => b[0] - a[0]).map(([len, qty]) => `${len}x${qty}`).join(' ; ');

    patternsByGroup.forEach((groupPatterns, gKey) => {
      const [lenStr, isFixedStr, orderNoStr] = gKey.split('|');
      const len = parseFloat(lenStr);
      const isFixed = isFixedStr === 'true';

      const totalQuantity = groupPatterns.reduce((sum, p) => sum + p.count, 0);
      const totalWasteInGroup = groupPatterns.reduce((sum, p) => sum + p.waste * p.count, 0);
      const totalOriginalInGroup = groupPatterns.reduce((sum, p) => sum + p.originalLength * p.count, 0);
      const totalCutInGroup = groupPatterns.reduce((sum, p) => sum + p.cuts.reduce((s, c) => s + c.length * c.count, 0) * p.count, 0);
      
      let label = (len / 1000).toFixed(2);
      if (!isFixed && orderNoStr) {
         label += ` (${orderNoStr})`;
      } else {
         label += isFixed ? ' (定尺)' : ' (库存)';
      }
      
      summaries.push({ 
        model, 
        color, 
        totalQuantity, 
        originalLength: label,
        totalWaste: totalWasteInGroup, 
        efficiency: (totalCutInGroup / totalOriginalInGroup) * 100, 
        patterns: groupPatterns, 
        demandSummary,
        isFixed,
        isSubstitution: false,
        isColorSubstitution: false
      });
    });
  }

  // Sort summaries by Model -> Color -> Length (Descending)
  summaries.sort((a, b) => {
    if (a.model !== b.model) return a.model.localeCompare(b.model);
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return parseFloat(b.originalLength as string) - parseFloat(a.originalLength as string);
  });

  const totalStockUsed = summaries.reduce((sum, s) => sum + s.patterns.reduce((pSum, p) => pSum + p.originalLength * p.count, 0), 0);
  const totalDemandFulfilled = summaries.reduce((sum, s) => sum + s.patterns.reduce((pSum, p) => pSum + p.cuts.reduce((cSum, c) => cSum + c.length * c.count, 0) * p.count, 0), 0);
  const totalWaste = summaries.reduce((sum, s) => sum + s.totalWaste, 0);
  const averageEfficiency = totalStockUsed > 0 ? (totalDemandFulfilled / totalStockUsed) * 100 : 0;
  return { totalStockUsed, totalDemandFulfilled, totalWaste, averageEfficiency, summaries, unfulfilled };
}

export async function optimizeCuttingMIP(
  demands: DemandItem[],
  stocks: StockItem[],
  fixedPlans: Record<string, FixedLengthPlan>,
  settings: Settings,
  purchases: PurchaseItem[] = [],
  onProgress?: ProgressCallback
): Promise<OptimizationSummary> {
  const glpk = await getGLPK();
  const { kerf, trim: globalTrim } = settings;
  const summaries: ModelColorSummary[] = [];
  const unfulfilled: DemandItem[] = [];

  const groups = new Map<string, { d: DemandItem[]; s: StockItem[]; f: FixedLengthPlan | null }>();
  demands.forEach((d) => {
    const key = `${d.model}|${d.color}`;
    if (!groups.has(key)) groups.set(key, { d: [], s: [], f: fixedPlans[d.model] || null });
    groups.get(key)!.d.push({ ...d });
  });
  if (settings.prioritizeStock) {
    stocks.forEach((s) => {
      const key = `${s.model}|${s.color}`;
      if (groups.has(key)) groups.get(key)!.s.push({ ...s });
    });
  }

  const groupKeys = Array.from(groups.keys());
  for (let gIdx = 0; gIdx < groupKeys.length; gIdx++) {
    const key = groupKeys[gIdx];
    const group = groups.get(key)!;
    
    await new Promise(resolve => setTimeout(resolve, 0));
    if (onProgress) {
      onProgress(10 + Math.round((gIdx / groupKeys.length) * 80));
    }

    const [model, color] = key.split("|");
    const itemTrim = group.f?.trim ?? globalTrim;
    
    interface MipBinItem {
      length: number;
      quantity: number;
      isFixed: boolean;
      id: string;
      cost: number;
      name: string;
      trim: number;
      orderNumber?: string;
    }

    async function solveMIPPass(
      inputDemands: { length: number; quantity: number; id: string; remarks: string; model: string; color: string; orderNumber?: string }[],
      inputBins: MipBinItem[]
    ): Promise<{
      patterns: CuttingPattern[];
      remainingDemands: { length: number; quantity: number; id: string; remarks: string; model: string; color: string; orderNumber?: string }[];
    }> {
      const activeDemands = inputDemands.filter(d => d.quantity > 0);
      if (activeDemands.length === 0 || inputBins.length === 0) {
        return { patterns: [], remainingDemands: inputDemands };
      }

      const demandMap = new Map<number, { qty: number; ids: string[]; remarks: string[] }>();
      activeDemands.forEach(d => {
        const existing = demandMap.get(d.length);
        if (existing) {
          existing.qty += d.quantity;
          existing.ids.push(d.id);
          existing.remarks.push(d.remarks);
        } else {
          demandMap.set(d.length, { qty: d.quantity, ids: [d.id], remarks: [d.remarks] });
        }
      });
      const uniqueDemands = Array.from(demandMap.entries()).map(([len, data]) => ({ length: len, ...data }));
      const M = uniqueDemands.length;

      const binTypes: MipBinItem[] = inputBins.map(b => ({ ...b }));
      binTypes.push({ length: 999999, quantity: 999999, isFixed: true, id: `dummy`, cost: 1000000, name: `Dummy`, trim: 0 });
      const DUMMY_BIN_IDX = binTypes.length - 1;

      interface Pattern {
        counts: number[];
        binIdx: number;
      }
      const patterns: Pattern[] = [];

      // 1. Initial Homogeneous Patterns
      for (let k = 0; k < binTypes.length; k++) {
        if (k === DUMMY_BIN_IDX) continue;
        const bin = binTypes[k];
        const effCap = bin.length - bin.trim * 2 + kerf;
        for (let i = 0; i < M; i++) {
          const itemW = uniqueDemands[i].length + kerf;
          if (itemW <= effCap) {
            const counts = new Array(M).fill(0);
            counts[i] = Math.floor(effCap / itemW);
            patterns.push({ counts, binIdx: k });
          }
        }
      }

      for (let i = 0; i < M; i++) {
        const counts = new Array(M).fill(0);
        counts[i] = 1;
        patterns.push({ counts, binIdx: DUMMY_BIN_IDX });
      }

      // 2. Column Generation Loop
      let cgIter = 0;
      let resRelax: any = null;
      while (cgIter < 60) {
        cgIter++;
        const lpRelax = {
          name: 'MasterRelaxed',
          objective: { direction: glpk.GLP_MIN, name: 'cost', vars: [] as any[] },
          subjectTo: [] as any[]
        };

        for (let j = 0; j < patterns.length; j++) {
          lpRelax.objective.vars.push({ name: `y_${j}`, coef: binTypes[patterns[j].binIdx].cost });
        }

        for (let i = 0; i < M; i++) {
          const vars = [];
          for (let j = 0; j < patterns.length; j++) {
            if (patterns[j].counts[i] > 0) vars.push({ name: `y_${j}`, coef: patterns[j].counts[i] });
          }
          lpRelax.subjectTo.push({ name: `dem_${i}`, vars, bnds: { type: glpk.GLP_LO, lb: uniqueDemands[i].qty, ub: 0 } });
        }

        for (let k = 0; k < binTypes.length; k++) {
          if (!binTypes[k].isFixed) {
            const vars = [];
            for (let j = 0; j < patterns.length; j++) {
              if (patterns[j].binIdx === k) vars.push({ name: `y_${j}`, coef: 1 });
            }
            lpRelax.subjectTo.push({ name: `stock_${k}`, vars, bnds: { type: glpk.GLP_UP, lb: 0, ub: binTypes[k].quantity } });
          }
        }

        try {
          resRelax = await glpk.solve(lpRelax, { msglev: glpk.GLP_MSG_OFF, presol: true });
        } catch (e) {
          break;
        }
        if (!resRelax || (resRelax.result.status !== glpk.GLP_OPT && resRelax.result.status !== glpk.GLP_FEAS)) break;

        let added = false;
        const pi = new Array(M).fill(0);
        for (let i = 0; i < M; i++) pi[i] = resRelax.result.dual[`dem_${i}`] || 0;
        const mu = new Array(binTypes.length).fill(0);
        for (let k = 0; k < binTypes.length; k++) {
          if (!binTypes[k].isFixed) {
            mu[k] = resRelax.result.dual[`stock_${k}`] || 0;
          }
        }

        for (let k = 0; k < binTypes.length; k++) {
          const bin = binTypes[k];
          if (k === DUMMY_BIN_IDX) continue;
          const effCap = Math.round((bin.length - bin.trim * 2 + kerf) * 10);
          
          const items = uniqueDemands.map((d, i) => ({
            i,
            weight: Math.round((d.length + kerf) * 10),
            value: pi[i]
          })).filter(it => it.weight <= effCap);

          items.sort((a, b) => b.value / b.weight - a.value / a.weight);

          let bestVal = -1;
          let bestCounts = new Array(M).fill(0);
          let nodeCount = 0;
          const maxNodes = 5000;

          const search = (itemIdx: number, currentWeight: number, currentVal: number, counts: number[]) => {
            nodeCount++;
            if (nodeCount > maxNodes) return;
            if (itemIdx === items.length) {
              if (currentVal > bestVal) { bestVal = currentVal; bestCounts = [...counts]; }
              return;
            }
            const item = items[itemIdx];
            let bound = currentVal;
            let remainingW = effCap - currentWeight;
            for (let j = itemIdx; j < items.length; j++) {
              const it = items[j];
              if (it.weight <= remainingW) {
                const take = Math.floor(remainingW / it.weight);
                bound += take * it.value;
                remainingW -= take * it.weight;
              }
              if (remainingW > 0) {
                bound += (remainingW / it.weight) * it.value;
                remainingW = 0;
                break;
              }
            }
            if (bound <= bestVal + 1e-6) return;

            const maxCount = Math.floor((effCap - currentWeight) / item.weight);
            for (let count = maxCount; count >= 0; count--) {
              if (nodeCount > maxNodes) return;
              if (count > 0) {
                  const nextCounts = [...counts];
                  nextCounts[item.i] = count;
                  search(itemIdx + 1, currentWeight + count * item.weight, currentVal + count * item.value, nextCounts);
              } else {
                  search(itemIdx + 1, currentWeight, currentVal, counts);
              }
            }
          };

          if (items.length > 0) {
             search(0, 0, 0, new Array(M).fill(0));
          }

          const reducedCost = bin.cost - bestVal - mu[k];
          if (reducedCost < -1e-4) {
            const exists = patterns.some(p => p.binIdx === k && p.counts.every((c, idx) => c === bestCounts[idx]));
            if (!exists) {
              patterns.push({ counts: bestCounts, binIdx: k });
              added = true;
            }
          }
        }

        if (cgIter % 5 === 0) await new Promise(resolve => setTimeout(resolve, 0));
        if (!added) break;
      }

      // 3. Mixed Integer Program (MIP) over Generated Columns
      let resUse = resRelax;
      let isIntegerSolution = false;

      if (resRelax && (resRelax.result.status === glpk.GLP_OPT || resRelax.result.status === glpk.GLP_FEAS)) {
        try {
          const lpInt = {
            name: 'MasterInteger',
            objective: { direction: glpk.GLP_MIN, name: 'cost', vars: [] as any[] },
            subjectTo: [] as any[],
            generals: [] as string[]
          };

          for (let j = 0; j < patterns.length; j++) {
            lpInt.objective.vars.push({ name: `y_${j}`, coef: binTypes[patterns[j].binIdx].cost });
            lpInt.generals.push(`y_${j}`);
          }

          for (let i = 0; i < M; i++) {
            const vars = [];
            for (let j = 0; j < patterns.length; j++) {
              if (patterns[j].counts[i] > 0) vars.push({ name: `y_${j}`, coef: patterns[j].counts[i] });
            }
            lpInt.subjectTo.push({ name: `dem_${i}`, vars, bnds: { type: glpk.GLP_LO, lb: uniqueDemands[i].qty, ub: 0 } });
          }

          for (let k = 0; k < binTypes.length; k++) {
            if (!binTypes[k].isFixed) {
              const vars = [];
              for (let j = 0; j < patterns.length; j++) {
                if (patterns[j].binIdx === k) vars.push({ name: `y_${j}`, coef: 1 });
              }
              lpInt.subjectTo.push({ name: `stock_${k}`, vars, bnds: { type: glpk.GLP_UP, lb: 0, ub: binTypes[k].quantity } });
            }
          }

          const resInt = await glpk.solve(lpInt, { msglev: glpk.GLP_MSG_OFF, presol: true });
          if (resInt && (resInt.result.status === glpk.GLP_OPT || resInt.result.status === glpk.GLP_FEAS)) {
            resUse = resInt;
            isIntegerSolution = true;
          }
        } catch (e) {
          console.error('MIP final solve failed:', e);
        }
      }

      const passPatterns: CuttingPattern[] = [];
      const remainingQty = new Array(M).fill(0);
      for (let i = 0; i < M; i++) remainingQty[i] = uniqueDemands[i].qty;

      if (resUse && (resUse.result.status === glpk.GLP_OPT || resUse.result.status === glpk.GLP_FEAS)) {
         Object.entries(resUse.result.vars).forEach(([varName, val]) => {
           let count = isIntegerSolution ? Math.round(val as any) : Math.floor(val as any);
           if (count > 0 && varName.startsWith('y_')) {
             const j = parseInt(varName.substring(2));
             const pat = patterns[j];
             if (pat.binIdx === DUMMY_BIN_IDX) return;
             const bin = binTypes[pat.binIdx];
             
             if (!bin.isFixed) {
               count = Math.min(count, bin.quantity);
               bin.quantity -= count;
             }
             if (count <= 0) return;

             const dCuts: any[] = [];
             let totalLength = 0;
             for (let i = 0; i < M; i++) {
               if (pat.counts[i] > 0) {
                  const take = Math.min(remainingQty[i], pat.counts[i] * count);
                  if (take > 0) {
                      remainingQty[i] -= take;
                  }
                  totalLength += pat.counts[i] * uniqueDemands[i].length;
               }
             }
             if (totalLength === 0) return;
             
             const numPieces = pat.counts.reduce((a, b) => a + b, 0);
             const waste = bin.length - totalLength - bin.trim * 2 - (numPieces > 1 ? (numPieces - 1) * kerf : 0);
             
             for (let i = 0; i < M; i++) {
               if (pat.counts[i] > 0) {
                 dCuts.push({ length: uniqueDemands[i].length, count: pat.counts[i], demandId: uniqueDemands[i].ids[0], remarks: uniqueDemands[i].remarks[0] });
               }
             }
             
             passPatterns.push({
               count: count,
               originalLength: bin.length,
               cuts: dCuts,
               waste: Math.max(0, waste),
               efficiency: (totalLength / bin.length) * 100,
               isFixed: bin.isFixed,
               orderNumber: (bin as any).orderNumber
             });
           }
         });
      }

      const remainingDemands: { length: number; quantity: number; id: string; remarks: string; model: string; color: string; orderNumber?: string }[] = [];
      for (let i = 0; i < M; i++) {
        if (remainingQty[i] > 0) {
          remainingDemands.push({
            id: uniqueDemands[i].ids[0],
            length: uniqueDemands[i].length,
            quantity: remainingQty[i],
            remarks: uniqueDemands[i].remarks[0],
            model,
            color
          });
        }
      }

      return { patterns: passPatterns, remainingDemands };
    }

    const pp = settings.quoteOrderPriority || [];
    const isStrict = Boolean(settings.strictOrderPriority && settings.prioritizeStock);
    const isAutoAdjustPass = settings.autoAdjustFixedLength && group.f?.lengths.length && group.f.lengths.length > 5;
    let fixedLengths = (group.f?.lengths || []).filter(len => len > 0);

    let currentDemands = group.d.map(d => ({ ...d }));
    const groupAllPatterns: CuttingPattern[] = [];

    if (isStrict && group.s.length > 0) {
      // Sort distinct stock orders strictly by quoteOrderPriority
      const distinctStockOrders = Array.from(new Set(group.s.map(s => s.orderNumber || ''))).sort((a, b) => {
        const idxA = pp.indexOf(a);
        const idxB = pp.indexOf(b);
        const rankA = idxA === -1 ? pp.length : idxA;
        const rankB = idxB === -1 ? pp.length : idxB;
        if (rankA !== rankB) return rankA - rankB;
        return a.localeCompare(b);
      });

      for (const ord of distinctStockOrders) {
        const ordStocks = group.s.filter(s => (s.orderNumber || '') === ord && s.quantity > 0);
        if (ordStocks.length === 0) continue;
        const activeDemands = currentDemands.filter(d => d.quantity > 0);
        if (activeDemands.length === 0) break;

        const minDem = Math.min(...activeDemands.map(d => d.length));
        const usableStocks = ordStocks.filter(s => (s.length - globalTrim * 2) >= minDem);
        if (usableStocks.length === 0) continue;

        const stockGroups = new Map<string, { qty: number, ids: string[], len: number, orderNumber?: string }>();
        usableStocks.forEach(s => {
          const key = `${s.length}|${s.orderNumber || ''}`;
          const existing = stockGroups.get(key) || { qty: 0, ids: [], len: s.length, orderNumber: s.orderNumber };
          existing.qty += s.quantity;
          existing.ids.push(s.id);
          stockGroups.set(key, existing);
        });

        const ordBinTypes: MipBinItem[] = [];
        stockGroups.forEach((data) => {
          ordBinTypes.push({
            length: data.len,
            quantity: data.qty,
            isFixed: false,
            id: data.ids[0],
            cost: data.len * 0.001,
            name: `库存(${data.len}mm)`,
            trim: globalTrim,
            orderNumber: data.orderNumber
          });
        });

        const passResult = await solveMIPPass(activeDemands, ordBinTypes);
        groupAllPatterns.push(...passResult.patterns);
        currentDemands = passResult.remainingDemands;

        // Deduct used stock from group.s
        passResult.patterns.forEach(p => {
          const st = group.s.find(s => (s.orderNumber || '') === ord && s.length === p.originalLength && s.quantity > 0);
          if (st) st.quantity = Math.max(0, st.quantity - p.count);
        });
      }

      // Fulfill any remaining demands with fixed-length specifications
      const activeRemaining = currentDemands.filter(d => d.quantity > 0);
      if (activeRemaining.length > 0 && fixedLengths.length > 0) {
        const fixedBinTypes: MipBinItem[] = [];
        fixedLengths.forEach(len => {
          let cost = len;
          if (isAutoAdjustPass) {
            cost = len * (1 + (len / 200000));
          }
          fixedBinTypes.push({
            length: len,
            quantity: 999999,
            isFixed: true,
            id: `fixed-${len}`,
            cost: cost,
            name: `定尺规格(${len}mm)`,
            trim: itemTrim
          });
        });

        const fixedPass = await solveMIPPass(activeRemaining, fixedBinTypes);
        groupAllPatterns.push(...fixedPass.patterns);
        currentDemands = fixedPass.remainingDemands;
      }
    } else {
      // Non-strict: combine all stocks and fixed lengths so higher-efficiency patterns from lower-priority orders can be used
      const stockGroups = new Map<string, { qty: number, ids: string[], len: number, orderNumber?: string }>();
      group.s.forEach(s => {
        const key = `${s.length}|${s.orderNumber || ''}`;
        const existing = stockGroups.get(key) || { qty: 0, ids: [], len: s.length, orderNumber: s.orderNumber };
        existing.qty += s.quantity;
        existing.ids.push(s.id);
        stockGroups.set(key, existing);
      });

      const binTypes: MipBinItem[] = [];
      stockGroups.forEach((data) => {
        let cost = settings.prioritizeStock ? data.len * 0.001 : data.len;
        const idx = pp.indexOf(data.orderNumber || '');
        const eff = idx === -1 ? pp.length : idx;
        if (settings.prioritizeStock) {
          cost += eff * 10.0;
        } else {
          cost += eff * 10000.0;
        }
        binTypes.push({
          length: data.len,
          quantity: data.qty,
          isFixed: false,
          id: data.ids[0],
          cost,
          name: `库存(${data.len}mm)`,
          trim: globalTrim,
          orderNumber: data.orderNumber
        });
      });

      fixedLengths.forEach(len => {
        let cost = len;
        if (isAutoAdjustPass) {
          cost = len * (1 + (len / 200000));
        }
        binTypes.push({ length: len, quantity: 999999, isFixed: true, id: `fixed-${len}`, cost: cost, name: `定尺规格(${len}mm)`, trim: itemTrim });
      });

      const passResult = await solveMIPPass(currentDemands, binTypes);
      groupAllPatterns.push(...passResult.patterns);
      currentDemands = passResult.remainingDemands;

      passResult.patterns.forEach(p => {
        if (!p.isFixed) {
          const st = group.s.find(s => (s.orderNumber || '') === (p.orderNumber || '') && s.length === p.originalLength && s.quantity > 0);
          if (st) st.quantity = Math.max(0, st.quantity - p.count);
        }
      });
    }

    const patternsByGroup = new Map<string, CuttingPattern[]>();
    groupAllPatterns.forEach(p => {
      const gKey = `${p.originalLength}|${p.isFixed}|${p.orderNumber || ''}`;
      const existing = patternsByGroup.get(gKey) || [];
      existing.push(p);
      patternsByGroup.set(gKey, existing);
    });

    const demandCounts = new Map<number, number>();
    group.d.forEach(d => demandCounts.set(d.length, (demandCounts.get(d.length) || 0) + d.quantity));
    const demandSummary = Array.from(demandCounts.entries()).sort((a, b) => b[0] - a[0]).map(([len, qty]) => `${len}x${qty}`).join(' ; ');

    patternsByGroup.forEach((groupPatternsForLen, gKey) => {
      const [lenStr, isFixedStr, orderNoStr] = gKey.split('|');
      const isFixed = isFixedStr === 'true';
      const len = parseInt(lenStr);

      const totalQuantity = groupPatternsForLen.reduce((sum, p) => sum + p.count, 0);
      const totalWasteInGroup = groupPatternsForLen.reduce((sum, p) => sum + p.waste * p.count, 0);
      const totalOriginalInGroup = groupPatternsForLen.reduce((sum, p) => sum + p.originalLength * p.count, 0);
      const totalCutInGroup = groupPatternsForLen.reduce((sum, p) => sum + p.cuts.reduce((s, c) => s + c.length * c.count, 0) * p.count, 0);
      
      let label = (len / 1000).toFixed(2);
      if (!isFixed && orderNoStr) {
         label += ` (${orderNoStr})`;
      } else {
         label += isFixed ? ' (定尺)' : ' (库存)';
      }

      summaries.push({
        model, color, 
        totalQuantity, 
        originalLength: label, 
        totalWaste: totalWasteInGroup, 
        efficiency: (totalCutInGroup / totalOriginalInGroup) * 100, 
        patterns: groupPatternsForLen, 
        demandSummary,
        isFixed
      });
    });

    // Residual demands fallback
    const residualDemands = currentDemands.filter(d => d.quantity > 0).map(d => ({
      id: d.id,
      length: d.length,
      quantity: d.quantity,
      remarks: d.remarks,
      model,
      color
    }));

    if (residualDemands.length > 0) {
      const residualStocks: any[] = group.s.filter(s => s.quantity > 0).map(s => ({
        id: s.id,
        length: s.length,
        quantity: s.quantity,
        orderNumber: s.orderNumber,
        model,
        color
      }));
      const fallback = await optimizeCuttingFFD(residualDemands, residualStocks, group.f ? { [model]: group.f } : {}, settings);
      fallback.summaries.forEach((s: any) => summaries.push(s));
      fallback.unfulfilled.forEach((u: any) => unfulfilled.push(u));
    }
  }

  summaries.sort((a, b) => {
    if (a.model !== b.model) return a.model.localeCompare(b.model);
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return parseFloat(b.originalLength as string) - parseFloat(a.originalLength as string);
  });

  const totalStockUsed = summaries.reduce((sum, s) => sum + s.patterns.reduce((pSum, p) => pSum + p.originalLength * p.count, 0), 0);
  const totalDemandFulfilled = summaries.reduce((sum, s) => sum + s.patterns.reduce((pSum, p) => pSum + p.cuts.reduce((cSum, c) => cSum + c.length * c.count, 0) * p.count, 0), 0);
  const totalWaste = summaries.reduce((sum, s) => sum + s.totalWaste, 0);
  const averageEfficiency = totalStockUsed > 0 ? (totalDemandFulfilled / totalStockUsed) * 100 : 0;
  return { totalStockUsed, totalDemandFulfilled, totalWaste, averageEfficiency, summaries, unfulfilled };
}
