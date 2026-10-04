import { GoogleGenerativeAI } from "@google/generative-ai";
import { DemandItem, StockItem, OptimizationSummary, AISettings, FixedLengthPlan, Settings, ProfileSalesItem, OrderColumn, PurchaseItem } from "../lib/optimizer";

export interface AISuggestion {
  advice: string;
  recommendedFixedPlans?: Record<string, { lengths: number[] }>;
  recommendedSettings?: {
    kerf?: number;
    trim?: number;
    algorithm?: 'FFD' | 'CG';
  };
  estimatedEfficiency?: string; // Estimated optimization rate, e.g. "98.5%"
}

export interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

export async function chatWithAI(
  messages: ChatMessage[],
  demands: DemandItem[],
  stocks: StockItem[],
  summary: OptimizationSummary | null,
  settings: AISettings,
  currentSettings: { kerf: number, trim: number, algorithm: string, prioritizeStock?: boolean },
  fixedPlans: Record<string, FixedLengthPlan>,
  profileSales?: ProfileSalesItem[],
  profileSalesColumns?: OrderColumn[],
  purchases?: PurchaseItem[]
): Promise<AISuggestion> {
  const isStockPrioritized = currentSettings.prioritizeStock !== false;
  
  const pinnedModels = Object.values(fixedPlans || {}).filter(p => p.isPinned).map(p => p.model);

  const contextPrompt = `
    你是一位经验丰富的工业型材套裁优化专家。你的目标是通过分析数据，主动为用户提供能显著提高利用率的“定尺方案”或其他工程/采购建议。

    【当前边界条件】:
    - 优先消耗库存: ${isStockPrioritized ? '已开启' : '已关闭'}
    - 固定的定尺方案型号(isPinned): ${pinnedModels.length > 0 ? pinnedModels.join(', ') : '无'}。**极端重要**: 你绝对不能修改、调整或对这些已经被固定的型号(${pinnedModels.join(', ')})提出任何 \`recommendedFixedPlans\` 建议。它们已被锁定，必须严格遵循现有的定尺。

    【当前任务分析背景】:
    1. 需求数据 (需切割的零件): ${demands.map(d => `型号:${d.model}, 颜色:${d.color}, 长度:${d.length}mm, 数量:${d.quantity}支`).join('; ')}
    2. 原材料库 (现有库存): ${stocks.map(s => `型号:${s.model}, 颜色:${s.color}, 长度:${s.length}mm, 数量:${s.quantity}支`).join('; ')}
    3. 当前切割参数: 锯缝(kerf)=${currentSettings.kerf}mm, 刀具端面损耗(trim)=${currentSettings.trim}mm, 使用算法=${currentSettings.algorithm}
    ${settings.modulusEnabled ? `4. **[重要约束] 定尺模数已开启**: 您建议的定尺方案长度必须是 **${settings.modulusValue}mm** 的整数倍（例如，如果模数是100，建议定尺可以是5900, 6000, 6100等）。` : '4. 定尺模数未开启，你可以建议任意合理的长度。'}
    ${summary ? `5. 当前优化结果:
       - 平均利用率: ${summary.averageEfficiency.toFixed(2)}%
       - 总废料量: ${summary.totalWaste} mm
       - 方案分布: ${summary.summaries.map(s => `型号:${s.model}, 颜色:${s.color}, 长度:${s.originalLength}, 数量:${s.totalQuantity}支, 效率:${s.efficiency.toFixed(1)}%`).join(' | ')}
       - 未完成清单(因太长或缺料无法排料的零件): ${summary.unfulfilled.length > 0 ? summary.unfulfilled.map(u => `型号:${u.model}, 长度:${u.length}mm, 数量:${u.quantity}`).join('; ') : '无'}
    ` : '5. [注意] 目前尚未进行初始优化，请根据经验给出第一版建议。'}
    6. 采购单数据: ${purchases ? purchases.map(p => `型材:${p.profileName || ''}, 型号:${p.model}, 颜色:${p.color}, 长度:${p.length}mm, 数量:${p.quantity}`).join('; ') : '无'}
    7. 销料库数据(由于排料等产生的已分配量): ${profileSales ? profileSales.map(ps => {
      const remaining = ps.quantity - Object.values(ps.orders || {}).reduce((a,b)=>a+b, 0);
      return `型号:${ps.model}, 颜色:${ps.color}, 长度:${ps.length}mm, 总量:${ps.quantity}, 剩余量:${remaining}`;
    }).join('; ') : '无'}

    【核心行为准则】:
    - **定尺方案的产生条件（极端重要）**: 你的 \`recommendedFixedPlans\` 是专门用于"采购新材料"的。如果【优先消耗库存】是开启的，并且你发现现有的库存已经完全足够把所有的零件切完（没有任何未完成清单，且完全没有使用到未标注为"库存"的新鲜定尺），那么你 **必须保持 recommendedFixedPlans 为空**，不需要并且绝不能强行推荐一个仅仅为了消耗库存的"假定尺"。
    - **定尺与库存的关系**: 你的计算逻辑必须是：先假定现有库存已被优先切割。**仅仅当库存耗尽后，对于还剩下没切完的零件，你才需要去思考用多长的"定尺"新料去切它们最划算**。
    - **定尺方案主键**: 你的 \`recommendedFixedPlans\` 中的 Key 必须 **仅仅是型号名称** (如 "A-01")，严禁包含颜色或其他信息。因为定尺方案是针对型材型号设置的，与颜色无关。
    - **严禁建议调整锯缝或端面损耗参数**: 你只应专注于定尺长度的优化建议，不要在建议中要求用户去调整锯缝 (kerf) 或端面损耗 (trim)，这些是物理约束，你无权干涉。
    - **单位警告（极其重要）**: 千万注意单位换算！所有的长度单位都是毫米 (mm)。不能把 3米 说成 300mm，3米是 3000mm。在描述时要格外留意，不要出现单位量级错误。
    - **主动出击**: 不要只当复读机。你必须遍历并深度检查所有线材的定尺方案。你的目标是确保每个材料型号的优化率（利用率）都达到 **92% 以上**。如果当前利用率较低，你必须思考是否存在更优的定尺。例如，如果零件多为1200mm，而定尺是6000mm，虽然能整除，但如果有端面损耗(trim)，6000mm 实际上只能切 4 根。通过建议 5100mm 或 6300mm 定尺，可能大幅提升效率至 95% 以上。
    - **逻辑回复**: 如果用户提出了具体问题（如“为什么效率这么低？”），请结合数据深度剖析原因（如：“因为您的定尺6米在切掉两个1.5米和两个1.3米零件后，剩余的0.4米无法再利用”）。
    - **结合上下文**: 请务必阅读之前的聊天记录。如果用户说“我不想要超过5.8米的材料”，你的建议必须符合这个约束。

    【输出要求】:
    必须返回 JSON 格式：
    {
      "advice": "你的专业建议文本。必须包含：1.现状分析；2.改进逻辑；3.对用户消息的针对性回复。",
      "recommendedFixedPlans": {
        "型号名称": { "lengths": [建议长度1, 建议长度2] }
      },
      "estimatedEfficiency": "预估优化率（如：99.1%）"
    }
  `;

  if (settings.provider === 'Gemini') {
    return await rotateKeys(messages, contextPrompt, settings, geminiChat);
  } else {
    // For OpenAI compatible
    return await rotateKeys(messages, contextPrompt, settings, getOpenAICompatibleAdvise);
  }
}

async function rotateKeys(
  messages: ChatMessage[],
  systemInstruction: string,
  settings: AISettings,
  chatFn: (m: ChatMessage[], s: string, ai: AISettings, key: string) => Promise<AISuggestion>
): Promise<AISuggestion> {
  const keys = settings.apiKeys && settings.apiKeys.length > 0 
    ? settings.apiKeys.filter(k => !!k) 
    : [settings.apiKey].filter(k => !!k);
  
  // If no keys in settings, try system default for Gemini
  if (keys.length === 0 && settings.provider === 'Gemini') {
    keys.push(process.env.GEMINI_API_KEY || '');
  }

  if (keys.length === 0) return { advice: "未配置 API Key。请在设置中添加密钥。" };

  let lastError = "";
  // Try all keys in the pool
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const result = await chatFn(messages, systemInstruction, settings, key);
      // If the advice contains an error message that looks like rate limit, throw to retry
      if (result.advice.includes("429") || result.advice.includes("QuotaExceeded") || result.advice.includes("rate limit")) {
        throw new Error(result.advice);
      }
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      console.warn(`Key ${i+1} failed, trying next... Error:`, lastError);
      // Continue to next key
    }
  }

  return { advice: `所有密钥均失效。最后一次错误: ${lastError}` };
}

async function geminiChat(
  messages: ChatMessage[],
  systemInstruction: string,
  settings: AISettings,
  apiKey: string
): Promise<AISuggestion> {
  if (!apiKey) throw new Error("API Key 为空");

  // Use the standard GoogleGenerativeAI constructor
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = settings.model || "gemini-1.5-flash";
  
  try {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      systemInstruction: systemInstruction 
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'model' ? 'model' : 'user' as any,
      parts: [{ text: m.content }]
    }));
    const userMessage = messages[messages.length - 1]?.content || '';

    const chat = model.startChat({
      history: history,
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const data = JSON.parse(jsonStr);
      if (data.advice) return data;
      return { advice: text };
    } catch (e) {
      return { advice: text || "无法解析 AI 建议。" };
    }
  } catch (error) {
    throw error;
  }
}

async function getOpenAICompatibleAdvise(
  messages: ChatMessage[],
  systemInstruction: string,
  settings: AISettings,
  apiKey: string
): Promise<AISuggestion> {
  const baseUrl = settings.baseUrl || (settings.provider === 'OpenAI' ? 'https://api.openai.com/v1' : '');
  const model = settings.model || (settings.provider === 'OpenAI' ? 'gpt-4o' : '');

  if (!apiKey) throw new Error("API Key 为空");
  if (!baseUrl) throw new Error("未配置 API 接口地址");

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemInstruction },
          ...messages.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.content }))
        ],
        response_format: { type: "json_object" },
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : text;
      const parsed = JSON.parse(jsonStr || '{}');
      if (parsed.advice) return parsed;
      return { advice: text || "无法解析 AI 建议。" };
    } catch (e) {
      return { advice: text || "无法解析 AI 建议。" };
    }
  } catch (error) {
    throw error;
  }
}
