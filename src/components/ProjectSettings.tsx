import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, AIProvider, AISettings, PurchaseItem } from "../lib/optimizer";
import { Sparkles, Globe, Cpu, Key, Eye, EyeOff, Database, Plus, Trash2, Download, Upload, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ProjectSettingsProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  purchases?: PurchaseItem[];
}

export function ProjectSettings({ settings, setSettings, purchases = [] }: ProjectSettingsProps) {
  const [showKeyIdx, setShowKeyIdx] = useState<number | null>(null);

  const updateAISetting = (field: keyof Settings['ai'], value: any) => {
    setSettings(prev => ({
      ...prev,
      ai: { ...(prev.ai || { enabled: false, provider: 'Gemini', apiKey: '', baseUrl: '', model: '' }), [field]: value }
    }));
  };

  const ai = settings.ai || { enabled: false, provider: 'Gemini', apiKey: '', baseUrl: '', model: '' };
  const apiKeyList = ai.apiKeys || (ai.apiKey ? [ai.apiKey] : []);

  const addKey = () => {
    const newList = [...apiKeyList, ''];
    updateAISetting('apiKeys', newList);
    updateAISetting('apiKey', newList[0] || '');
  };

  const removeKey = (idx: number) => {
    const newList = apiKeyList.filter((_, i) => i !== idx);
    updateAISetting('apiKeys', newList);
    updateAISetting('apiKey', newList[0] || '');
  };

  const updateKey = (idx: number, val: string) => {
    const newList = [...apiKeyList];
    newList[idx] = val;
    updateAISetting('apiKeys', newList);
    if (idx === 0) updateAISetting('apiKey', val);
  };

  const exportAIDatabase = () => {
    const data = JSON.stringify(ai, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ai-settings-db.json';
    link.click();
    toast.success("AI 智能设置数据库已导出");
  };

  const importAIDatabase = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (re: any) => {
        try {
          const imported = JSON.parse(re.target.result) as AISettings;
          setSettings(prev => ({ ...prev, ai: imported }));
          localStorage.setItem('wire-optimizer-ai-settings', JSON.stringify(imported));
          toast.success("AI 智能设置数据库已导入并加载");
        } catch (err) {
          toast.error("导入失败: 无效的 JSON 文件");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const updatePrintInfo = (field: keyof Settings['printInfo'], value: string) => {
    setSettings(prev => ({
      ...prev,
      printInfo: { ...prev.printInfo, [field]: value }
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-black/5 shadow-sm max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold">工程参数</CardTitle>
          <CardDescription>配置可利用料头长度等全局规则</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-6">
             <div className="space-y-2">
               <Label htmlFor="usable-length" className="text-sm font-medium">可利用料头长度 (mm)</Label>
               <Input 
                 id="usable-length" 
                 type="number"
                 value={settings.usableOffcutLength ?? ''} 
                 onChange={(e) => setSettings(prev => ({ ...prev, usableOffcutLength: parseFloat(e.target.value) || 0 }))}
                 placeholder="例如: 1000" 
                 className="h-10 border-black/10 focus:border-orange-500"
               />
               <p className="text-xs text-muted-foreground">优化完成后，长度大于等于该值的料头将被标记为可随套裁单导入到采购单列表进行再次利用。</p>
             </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-black/5 shadow-sm max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg font-bold">报表打印参数</CardTitle>
          <CardDescription>配置报表抬头信息及页脚签名信息（随保存的工程数据一起保存）</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-proj" className="text-sm font-medium">项目名称</Label>
              <Input 
                id="p-proj" 
                value={settings.printInfo?.project || ''} 
                onChange={(e) => updatePrintInfo('project', e.target.value)}
                placeholder="项目名称" 
                className="h-10 border-black/10 focus:border-orange-500"
              />
            </div>
          </div>

          <Separator className="my-2" />
          
          <div className="grid grid-cols-3 gap-4 text-black">
            <div className="space-y-1.5">
              <Label htmlFor="p-des" className="text-xs text-black/50 font-bold uppercase">设计</Label>
              <Input id="p-des" value={settings.printInfo?.designer || ''} onChange={(e) => updatePrintInfo('designer', e.target.value)} className="h-9 text-xs" placeholder="签名" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-rev" className="text-xs text-black/50 font-bold uppercase">校对</Label>
              <Input id="p-rev" value={settings.printInfo?.reviewer || ''} onChange={(e) => updatePrintInfo('reviewer', e.target.value)} className="h-9 text-xs" placeholder="签名" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-chk" className="text-xs text-black/50 font-bold uppercase">标审</Label>
              <Input id="p-chk" value={settings.printInfo?.checker || ''} onChange={(e) => updatePrintInfo('checker', e.target.value)} className="h-9 text-xs" placeholder="签名" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-aud" className="text-xs text-black/50 font-bold uppercase">审核</Label>
              <Input id="p-aud" value={settings.printInfo?.auditor || ''} onChange={(e) => updatePrintInfo('auditor', e.target.value)} className="h-9 text-xs" placeholder="签名" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-cra" className="text-xs text-black/50 font-bold uppercase">工艺</Label>
              <Input id="p-cra" value={settings.printInfo?.craftsman || ''} onChange={(e) => updatePrintInfo('craftsman', e.target.value)} className="h-9 text-xs" placeholder="签名" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-black/5 shadow-sm overflow-hidden border-l-4 border-l-blue-500 max-w-2xl">
        <CardHeader className="bg-blue-50/50">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-blue-600" />
                AI 智能设置
              </CardTitle>
              <CardDescription>配置智能套裁分析助手及 API 密钥池</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={ai.enabled}
                onCheckedChange={(val) => updateAISetting('enabled', val)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className={`space-y-6 pt-6 transition-opacity duration-300 ${!ai.enabled ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold flex items-center gap-2">
              <Database className="h-4 w-4 text-blue-600" />
              AI 数据库管理
            </h4>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={exportAIDatabase} className="h-8 gap-1 text-xs">
                <Download className="h-3 w-3" />
                导出数据
              </Button>
              <Button variant="outline" size="sm" onClick={importAIDatabase} className="h-8 gap-1 text-xs">
                <Upload className="h-3 w-3" />
                导入数据
              </Button>
            </div>
          </div>

          <Separator className="opacity-50" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Globe className="h-4 w-4 text-black/40" />
                模型提供商
              </Label>
              <Select 
                value={ai.provider} 
                onValueChange={(val: AIProvider) => {
                  updateAISetting('provider', val);
                  if (val === 'Gemini') updateAISetting('model', 'gemini-1.5-flash');
                  else if (val === 'OpenAI') {
                    updateAISetting('model', 'gpt-4o');
                    updateAISetting('baseUrl', 'https://api.openai.com/v1');
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择提供商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gemini">Google Gemini</SelectItem>
                  <SelectItem value="OpenAI">OpenAI</SelectItem>
                  <SelectItem value="Custom">自定义 (OpenAI 兼容)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium flex items-center gap-2 text-primary">
                <Cpu className="h-4 w-4 text-black/40" />
                模型名称
              </Label>
              <Input 
                value={ai.model}
                onChange={(e) => updateAISetting('model', e.target.value)}
                placeholder={ai.provider === 'Gemini' ? 'gemini-1.5-flash' : 'gpt-4o'}
                className="h-10 border-black/10 focus:border-blue-500"
              />
            </div>
          </div>

          {ai.provider !== 'Gemini' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">接口地址 (Base URL)</Label>
              <Input 
                value={ai.baseUrl}
                onChange={(e) => updateAISetting('baseUrl', e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="h-10 border-black/10 focus:border-blue-500"
              />
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Key className="h-4 w-4 text-black/40" />
                API 密钥池 (额度不够时将自动轮换)
              </Label>
              <Button variant="ghost" size="sm" onClick={addKey} className="h-6 text-[10px] gap-1 hover:bg-blue-100">
                <Plus className="h-3 w-3" />
                添加密钥
              </Button>
            </div>
            
            <div className="space-y-2">
              {apiKeyList.map((key, idx) => (
                <div key={idx} className="flex items-center gap-2 group">
                  <div className="flex-1 relative">
                    <Input 
                      type={showKeyIdx === idx ? "text" : "password"}
                      value={key}
                      onChange={(e) => updateKey(idx, e.target.value)}
                      placeholder={`密钥 ${idx + 1}`}
                      className="h-9 pr-10 border-black/10 focus:border-blue-500 pr-12"
                    />
                    <button 
                      type="button"
                      onClick={() => setShowKeyIdx(showKeyIdx === idx ? null : idx)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 hover:text-black"
                    >
                      {showKeyIdx === idx ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => removeKey(idx)} 
                    disabled={apiKeyList.length === 1 && idx === 0}
                    className="h-9 w-9 text-black/20 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              {apiKeyList.length === 0 && (
                <div className="text-center py-4 border border-dashed rounded-md bg-white/50">
                  <p className="text-xs text-black/40">暂无已保存的密钥</p>
                </div>
              )}
            </div>
            
            <p className="text-[10px] text-black/40">
              * 如果选择 Gemini 且密钥池为空，将尝试使用系统默认密钥。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
