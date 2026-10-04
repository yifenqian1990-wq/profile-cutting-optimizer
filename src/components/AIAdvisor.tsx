import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Sparkles, Loader2, Send, Bot, User, RotateCcw, Wrench, Copy, Trash2, RefreshCw, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { chatWithAI, ChatMessage, AISuggestion } from '../services/aiService';
import { DemandItem, StockItem, OptimizationSummary, AISettings, FixedLengthPlan, Settings, ProfileSalesItem, OrderColumn, PurchaseItem } from '../lib/optimizer';
import ReactMarkdown from 'react-markdown';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { toast } from 'sonner';

interface AIAdvisorProps {
  demands: DemandItem[];
  stocks: StockItem[];
  profileSales?: ProfileSalesItem[];
  profileSalesColumns?: OrderColumn[];
  purchases?: PurchaseItem[];
  summary: OptimizationSummary | null;
  isOptimizing: boolean;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  latestSuggestion: AISuggestion | null;
  setLatestSuggestion: React.Dispatch<React.SetStateAction<AISuggestion | null>>;
  aiSettings: AISettings;
  currentSettings: { kerf: number, trim: number, algorithm: 'FFD' | 'CG', prioritizeStock?: boolean };
  fixedPlans: Record<string, FixedLengthPlan>;
  onApplySuggestions?: (plans: Record<string, FixedLengthPlan> | null, settings: Partial<Settings> | null) => void;
}

export const AIAdvisor: React.FC<AIAdvisorProps> = ({ 
  demands, 
  stocks, 
  profileSales,
  profileSalesColumns,
  purchases,
  summary, 
  isOptimizing, 
  messages,
  setMessages,
  latestSuggestion,
  setLatestSuggestion,
  aiSettings,
  currentSettings,
  fixedPlans,
  onApplySuggestions
}) => {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [showPlansDetail, setShowPlansDetail] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const enabled = aiSettings?.enabled ?? false;

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleStartAnalysis = () => {
    handleChat("请作为高级排料工程师，深度分析当前的套裁方案。请结合未完成清单和现有型材数据，给予能够显著提升利用率的定尺方案建议（例如最佳采购长度）。目标是让每种线材利用率都达到 92% 以上。");
  };

  const handleChat = async (content: string, isRetry: boolean = false) => {
    const trimmedContent = content.trim();
    if (!trimmedContent && !isRetry) return;
    if (isLoading) return;

    let updatedMessages = [...messages];
    
    if (!isRetry) {
      const newUserMessage: ChatMessage = { role: 'user', content: trimmedContent };
      updatedMessages = [...updatedMessages, newUserMessage];
      setMessages(updatedMessages);
      setInput('');
    } else {
      // If retry, we assume the last message was the model failing or we want a better answer
      // Find the last user message to resend if the last message is a model error or just want re-run
    }

    setIsLoading(true);

    try {
      const result = await chatWithAI(
        updatedMessages,
        demands,
        stocks,
        summary,
        aiSettings,
        currentSettings,
        fixedPlans,
        profileSales,
        profileSalesColumns,
        purchases
      );
      
      setMessages(prev => [...prev, { role: 'model', content: result.advice }]);
      setLatestSuggestion(result);
    } catch (error) {
      console.error("AI Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', content: "抱歉，我目前无法连接到 AI 服务，请检查您的 API 配置。" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = async () => {
    if (messages.length === 0 || isLoading) return;
    
    // Find the last user message
    const lastUserMsgIdx = [...messages].reverse().findIndex(m => m.role === 'user');
    if (lastUserMsgIdx === -1) return;

    const actualIdx = messages.length - 1 - lastUserMsgIdx;
    const historyUpToLastUser = messages.slice(0, actualIdx + 1);
    
    setMessages(historyUpToLastUser);
    setIsLoading(true);

    try {
      const result = await chatWithAI(
        historyUpToLastUser,
        demands,
        stocks,
        summary,
        aiSettings,
        currentSettings,
        fixedPlans,
        profileSales,
        profileSalesColumns,
        purchases
      );
      
      setMessages(prev => [...prev, { role: 'model', content: result.advice }]);
      setLatestSuggestion(result);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: "重新试失败，请重试。" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMessage = (idx: number) => {
    setMessages(prev => prev.filter((_, i) => i !== idx));
  };

  const copyMessage = (content: string, idx: number) => {
    navigator.clipboard.writeText(content);
    setCopiedIdx(idx);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const handleApply = () => {
    if (!latestSuggestion || !onApplySuggestions) return;
    
    const plans: Record<string, FixedLengthPlan> = {};
    if (latestSuggestion.recommendedFixedPlans) {
      Object.entries(latestSuggestion.recommendedFixedPlans).forEach(([fullKey, data]) => {
        // Safeguard: AI sometimes includes color. We need just the model name.
        // Usually model is the first word or before a space/colon.
        const model = fullKey.split(' ')[0].split(':')[0].trim();
        plans[model] = { model, lengths: data.lengths };
      });
    }

    onApplySuggestions(
      Object.keys(plans).length > 0 ? plans : null,
      latestSuggestion.recommendedSettings || null
    );
  };

  const clearChat = () => {
    setMessages([]);
    setLatestSuggestion(null);
  };

  if (!enabled) return null;

  const hasSuggestions = latestSuggestion && (
    (latestSuggestion.recommendedFixedPlans && Object.keys(latestSuggestion.recommendedFixedPlans).length > 0) ||
    latestSuggestion.recommendedSettings ||
    latestSuggestion.estimatedEfficiency
  );

  return (
    <div className="flex flex-col lg:flex-row h-[700px] gap-4">
      <Card className="flex-1 flex flex-col border-blue-200 bg-blue-50/10 overflow-hidden shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-blue-100 bg-blue-50/50 py-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <CardTitle className="text-base font-bold text-blue-900 leading-none">AI 智能助理</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleRetry} 
              disabled={isLoading || messages.length === 0}
              className="h-8 w-8 text-blue-400 hover:text-blue-600"
              title="重试最后一条"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon" onClick={clearChat} className="h-8 w-8 text-blue-400 hover:text-blue-600" title="清空对话">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full px-4 pt-4 pb-20">
            <div className="space-y-6">
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                  <Bot className="h-16 w-16 text-blue-200" />
                  
                  <div className="space-y-3">
                    <h3 className="text-lg font-bold text-blue-900">AI 定尺优化分析</h3>
                    <p className="text-sm text-blue-600/80 max-w-sm mx-auto">
                      AI 将会深度分析您的切割废料，直接给您提供采购长度的优化定尺方案。
                    </p>
                  </div>
                  
                  <Button 
                    size="lg" 
                    onClick={handleStartAnalysis}
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 gap-2 font-bold px-8"
                  >
                    <Sparkles className="h-5 w-5 fill-current opacity-80" />
                    立即启动 AI 智能分析
                  </Button>

                  <div className="pt-8 space-y-2">
                    <p className="text-xs text-blue-900/60 font-medium tracking-wide">或者尝试问我：</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleChat("怎么减少边角料？")} className="text-xs border-blue-100 text-blue-600 bg-white">怎么减少边角料？</Button>
                      <Button variant="outline" size="sm" onClick={() => handleChat("分析一下当前的废料集中在哪里")} className="text-xs border-blue-100 text-blue-600 bg-white">分析废料分布</Button>
                      <Button variant="outline" size="sm" onClick={() => handleChat("如果我想提高CG算法的效率该怎么调参？")} className="text-xs border-blue-100 text-blue-600 bg-white">CG算法调参</Button>
                    </div>
                  </div>
                </div>
              )}

              {messages.map((message, idx) => (
                <div 
                  key={idx} 
                  className={`flex group ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-3 max-w-[85%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      message.role === 'user' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className={`relative p-4 rounded-2xl text-sm ${
                        message.role === 'user' 
                          ? 'bg-orange-600 text-white rounded-tr-none shadow-sm' 
                          : 'bg-white border border-blue-100 text-blue-950 rounded-tl-none shadow-sm shadow-blue-50/50'
                      }`}>
                        <div className={`prose prose-sm max-w-none ${message.role === 'user' ? 'prose-invert' : 'prose-blue'} markdown-body`}>
                          <ReactMarkdown>{message.content}</ReactMarkdown>
                        </div>
                      </div>
                      
                      {/* Message Actions */}
                      <div className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <button 
                          onClick={() => copyMessage(message.content, idx)}
                          className="text-[10px] flex items-center gap-1 text-black/40 hover:text-blue-600"
                        >
                          {copiedIdx === idx ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          {copiedIdx === idx ? '已复制' : '复制'}
                        </button>
                        <button 
                          onClick={() => deleteMessage(idx)}
                          className="text-[10px] flex items-center gap-1 text-black/40 hover:text-red-500"
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3 max-w-[85%]">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-blue-100 text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                    <div className="p-4 bg-white border border-blue-100 rounded-2xl rounded-tl-none shadow-sm">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-3 border-t border-blue-100 bg-white mt-auto">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleChat(input); }} 
            className="flex w-full gap-2"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="告诉 AI 您想如何优化方案..."
              className="flex-1 bg-blue-50/30 border-blue-100 focus-visible:ring-blue-400"
              disabled={isLoading}
            />
            <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 shrink-0 shadow-sm">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>

      {/* Suggestion Panel - Now on the right */}
      {hasSuggestions && !isLoading && (
        <Card className="lg:w-[350px] flex-shrink-0 border-orange-200 bg-orange-50/30 shadow-sm animate-in fade-in slide-in-from-right-4 duration-300 h-full flex flex-col overflow-hidden">
          <CardHeader className="border-b border-orange-100 bg-orange-50/50 py-3 shrink-0">
             <div className="flex items-center gap-2">
               <Wrench className="h-4 w-4 text-orange-600" />
               <span className="text-sm font-bold text-orange-900">AI 调整建议已准备就绪</span>
             </div>
          </CardHeader>

          <CardContent className="p-4 flex-1 overflow-y-auto w-full">
            <div className="flex flex-col gap-6">
              {latestSuggestion.estimatedEfficiency && (
                <div className="space-y-2">
                  <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">预估优化率</div>
                  <Badge variant="secondary" className="bg-orange-100 border-orange-200 text-orange-700 font-bold text-base px-3 py-1">
                    {latestSuggestion.estimatedEfficiency}
                  </Badge>
                </div>
              )}

              {latestSuggestion.recommendedSettings && (
                <div className="space-y-2">
                  <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">切割参数调整</div>
                  <div className="flex flex-wrap gap-2">
                    {latestSuggestion.recommendedSettings.kerf !== undefined && (
                      <Badge variant="secondary" className="bg-white border-orange-200 text-orange-700">锯缝: {latestSuggestion.recommendedSettings.kerf}mm</Badge>
                    )}
                    {latestSuggestion.recommendedSettings.trim !== undefined && (
                      <Badge variant="secondary" className="bg-white border-orange-200 text-orange-700">边距: {latestSuggestion.recommendedSettings.trim}mm</Badge>
                    )}
                    {latestSuggestion.recommendedSettings.algorithm && (
                      <Badge variant="secondary" className="bg-white border-orange-200 text-orange-700">算法: {latestSuggestion.recommendedSettings.algorithm}</Badge>
                    )}
                  </div>
                </div>
              )}

              {latestSuggestion.recommendedFixedPlans && Object.keys(latestSuggestion.recommendedFixedPlans).length > 0 && (
                <div className="space-y-3">
                  <div className="text-[10px] text-orange-600 font-bold uppercase tracking-wider">定尺方案推荐</div>
                  
                  <div className="flex flex-col gap-2 w-full">
                    <Badge variant="secondary" className="bg-white border-orange-200 text-orange-700 justify-center py-1">
                      已识别 {Object.keys(latestSuggestion.recommendedFixedPlans).length} 个型号的定尺
                    </Badge>

                    <div className="mt-2 flex flex-col gap-2">
                      {Object.entries(latestSuggestion.recommendedFixedPlans).map(([model, data]) => (
                        <div key={model} className="flex flex-col gap-1 p-3 bg-white rounded-lg border border-orange-100 shadow-sm w-full">
                          <span className="font-bold text-gray-700 text-xs w-full break-all pb-1 border-b border-orange-50 line-clamp-1" title={model}>{model}</span>
                          <span className="text-orange-700 font-mono text-sm tracking-tight break-words">{data.lengths.join(', ')} mm</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>

          <CardFooter className="p-4 border-t border-orange-100 bg-white shrink-0">
             <Button 
                onClick={handleApply}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white gap-2 shadow-sm font-bold h-12"
              >
                <Sparkles className="h-4 w-4 shrink-0" />
                执行调整建议
              </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
};
