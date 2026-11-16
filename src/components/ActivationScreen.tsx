import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ShieldAlert, CheckCircle2, Copy, RefreshCw, KeyRound, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

export function ActivationScreen({ onActivated }: { onActivated: () => void }) {
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [authError, setAuthError] = useState('');
  
  // Custom dialog for entering backup or test device ID (avoids iframe-blocked window.prompt)
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [inputDeviceId, setInputDeviceId] = useState('');

  useEffect(() => {
    // Generate or retrieve "physical device ID" (browser fingerprint substitute)
    let storedId = '';
    try {
      storedId = localStorage.getItem('wire-optimizer-device-id') || '';
      if (!storedId) {
        storedId = 'DEV-' + Math.random().toString(16).substring(2, 10).toUpperCase();
        localStorage.setItem('wire-optimizer-device-id', storedId);
      }
    } catch (e) {
      console.warn("Storage access denied or failed in ActivationScreen:", e);
      storedId = 'DEV-SANDBOX-' + Math.random().toString(16).substring(2, 10).toUpperCase();
    }
    setDeviceId(storedId);
    setInputDeviceId(storedId);

    // Check if device ID is in the backend whitelist
    const checkAuth = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/auth/verify?device=${encodeURIComponent(storedId)}&_t=${Date.now()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: storedId })
        });
        
        let data;
        let textResult = '';
        try {
          textResult = await res.clone().text();
          data = JSON.parse(textResult);
        } catch (parseErr: any) {
          throw new Error(`JSON解析失败。状态码: ${res.status}。返回内容: "${textResult.substring(0, 50)}" (${parseErr.message})`);
        }
        
        if (data.success) {
          // Device is in the database! Automatically allow entry.
          setIsActivated(true);
          setTimeout(() => {
            onActivated();
          }, 800);
        } else {
          // Not found in DB, show the "Access Denied" screen
          setAuthError(data.message || '该设备尚未在系统中授权');
          setLoading(false);
        }
      } catch (e: any) {
        console.error("Backend validation failed", e);
        setAuthError(e.message || "请求服务器授权接口失败，请检查网络或后端服务");
        setLoading(false);
      }
    };
    checkAuth();
  }, [onActivated, retryCount]);

  const copyDeviceId = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(deviceId)
        .then(() => toast.success("机器码已复制到剪贴板"))
        .catch(() => toast.error("复制失败，请手动选中文本复制"));
    } else {
      toast.info("请长按或双击手动选中文本复制");
    }
  };

  const handleSaveCustomDeviceId = () => {
    const trimmed = inputDeviceId.trim();
    if (!trimmed) {
      toast.error("特征码不能为空");
      return;
    }
    try {
      localStorage.setItem('wire-optimizer-device-id', trimmed);
    } catch (e) {
      console.warn("Could not save to localStorage", e);
    }
    setDeviceId(trimmed);
    setEditDialogOpen(false);
    toast.success("特征码已更新，正在验证...");
    setRetryCount(c => c + 1);
  };

  const handleApplyPreset = (code: string) => {
    setInputDeviceId(code);
  };

  if (loading && !isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4] p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-black/5 max-w-sm w-full text-center">
          <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full" />
          <h2 className="text-lg font-bold text-slate-800">正在验证系统授权</h2>
          <p className="text-xs text-slate-500">正在与本地授权数据库匹配设备特征码...</p>
        </div>
      </div>
    );
  }

  if (isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4] p-4">
        <motion.div 
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-emerald-100 max-w-sm w-full text-center"
        >
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-9 h-9" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">授权验证通过</h2>
          <p className="text-slate-500 text-sm font-medium">设备已获得正式授权，正在进入系统...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F4] p-4 font-sans selection:bg-orange-100 selection:text-orange-900">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-black/10 overflow-hidden"
      >
        <div className="bg-gradient-to-b from-orange-50/60 to-white p-8 text-center border-b border-black/5">
          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-orange-200 shadow-sm">
            <ShieldAlert className="w-8 h-8 text-orange-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">设备未授权</h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            该设备尚未在系统中登记，请将机器特征码提供给管理员获取授权。
          </p>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">当前设备特征码</label>
              <button 
                type="button"
                onClick={() => {
                  setInputDeviceId(deviceId);
                  setEditDialogOpen(true);
                }}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium hover:underline flex items-center gap-1 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                修改/恢复特征码
              </button>
            </div>
            <div className="flex gap-2">
              <Input 
                value={deviceId} 
                readOnly 
                className="font-mono text-center bg-slate-50 text-slate-800 tracking-wider font-semibold text-base focus-visible:ring-0 focus-visible:ring-offset-0 border-black/15 select-all"
              />
              <Button 
                onClick={copyDeviceId} 
                variant="outline" 
                className="shrink-0 hover:bg-orange-50 hover:text-orange-600 border-black/15 text-slate-600" 
                title="复制识别码"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-orange-50/80 text-orange-950 p-4 rounded-xl text-xs leading-relaxed border border-orange-200/80 space-y-2">
            <div className="font-semibold flex items-center gap-1.5 text-orange-900">
              <span>使用说明：</span>
            </div>
            <p>
              请复制上方特征码发送给系统管理员，管理员在 <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-orange-200 text-orange-800">database/licenses.json</span> 登记备案后，点击下方刷新按钮即可直接进入。
            </p>
            {authError && (
              <div className="mt-2 p-2.5 bg-white/80 text-slate-800 text-xs rounded border border-orange-200 font-mono break-all whitespace-pre-wrap">
                状态: {authError}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Button 
              className="w-full text-base h-11 bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-md shadow-orange-200 gap-2" 
              onClick={() => {
                toast.info("正在重新验证授权...");
                setRetryCount(c => c + 1);
              }}
            >
              <RefreshCw className="w-4 h-4" />
              已联系管理员添加，刷新重试
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Dialog for modifying/restoring device ID */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-orange-600" />
              修改 / 恢复设备特征码
            </DialogTitle>
            <DialogDescription>
              如果您之前已经备份过授权特征码，或需要使用指定测试码，可在此处直接粘贴并保存。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label htmlFor="custom-dev-id">设备特征码 (机器码)</Label>
              <Input
                id="custom-dev-id"
                value={inputDeviceId}
                onChange={(e) => setInputDeviceId(e.target.value)}
                placeholder="例如：DEV-1A7C3E2D"
                className="font-mono"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveCustomDeviceId();
                }}
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-500 font-medium">快捷填入已授权测试码：</span>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 font-mono hover:border-orange-500 hover:text-orange-600"
                  onClick={() => handleApplyPreset('DEV-1A7C3E2D')}
                >
                  <Sparkles className="w-3 h-3 text-orange-500" />
                  DEV-1A7C3E2D (正式测试码)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 font-mono hover:border-orange-500 hover:text-orange-600"
                  onClick={() => handleApplyPreset('wwwwwww')}
                >
                  wwwwwww
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 gap-1 font-mono hover:border-orange-500 hover:text-orange-600"
                  onClick={() => handleApplyPreset('AAAAAAAAAAAAAA')}
                >
                  AAAAAAAAAAAAAA
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSaveCustomDeviceId} className="bg-orange-600 hover:bg-orange-700 text-white">
              保存并验证
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
