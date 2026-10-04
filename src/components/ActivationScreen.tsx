import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, CheckCircle2, Copy, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";

export function ActivationScreen({ onActivated }: { onActivated: () => void }) {
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [isActivated, setIsActivated] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Generate or retrieve "physical device ID" (browser fingerprint substitute)
    let storedId = '';
    try {
      storedId = localStorage.getItem('wire-optimizer-device-id') || '';
      if (!storedId) {
        storedId = 'DEV-' + Math.random().toString(16).substr(2, 8).toUpperCase();
        localStorage.setItem('wire-optimizer-device-id', storedId);
      }
    } catch (e) {
      console.warn("Storage access denied or failed in ActivationScreen:", e);
      storedId = 'DEV-SANDBOX-' + Math.random().toString(16).substr(2, 8).toUpperCase();
    }
    setDeviceId(storedId);

    // Check if device ID is in the backend whitelist
    const checkAuth = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/auth/verify?device=${storedId}&_t=${Date.now()}`, {
          method: 'POST',
          headers:{ 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: storedId })
        });
        
        let data;
        let textResult = '';
        try {
          textResult = await res.clone().text();
          data = await res.json();
        } catch (parseErr: any) {
          throw new Error(`JSON解析失败。状态码: ${res.status}。返回内容: "${textResult.substring(0, 50)}" (${parseErr.message})`);
        }
        
        if (data.success) {
          // Device is in the database! Automatically allow entry.
          setIsActivated(true);
          setTimeout(onActivated, 1000);
        } else {
           // Not found in DB, show the "Access Denied" screen
           setAuthError(data.message || '未授权');
           setLoading(false);
        }
      } catch(e: any) {
        console.error("Backend validation failed", e);
        setAuthError(e.message || "请求失败");
        setLoading(false);
      }
    };
    checkAuth();
  }, [onActivated, retryCount]);

  const copyDeviceId = () => {
    navigator.clipboard.writeText(deviceId);
    toast.success("机器码已复制");
  };

  if (loading && !isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (isActivated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 rounded-2xl shadow-xl flex flex-col items-center gap-4 border border-green-100"
        >
          <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">验证通过</h2>
          <p className="text-slate-500 font-medium tracking-wide">正在进入系统...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans selection:bg-blue-100">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden"
      >
        <div className="bg-slate-50 p-8 text-center border-b border-slate-100">
          <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
            <ShieldAlert className="w-8 h-8 text-blue-500" />
          </div>
          <h1 className="text-2xl font-semibold text-slate-800 mb-2 tracking-tight">设备未授权</h1>
          <p className="text-slate-500 text-sm">该设备尚未在系统中登记，请联系管理员获取授权。</p>
        </div>

        <div className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 flex items-center justify-between">
              <span>当前设备特征码</span>
              <button 
                onClick={() => {
                  const oldId = prompt('请输入您之前备份的特征码（例如：DEV-1A7C3E2D）：', deviceId);
                  if (oldId && oldId.trim()) {
                    localStorage.setItem('wire-optimizer-device-id', oldId.trim());
                    setDeviceId(oldId.trim());
                    setRetryCount(c => c + 1);
                    toast.success("特征码已更新");
                  }
                }}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium bg-transparent border-0 p-0 cursor-pointer"
              >
                修改/恢复特征码
              </button>
            </label>
            <div className="flex gap-2">
              <Input 
                value={deviceId} 
                readOnly 
                className="font-mono text-center bg-slate-50 text-slate-600 tracking-wider font-semibold text-lg focus-visible:ring-0 focus-visible:ring-offset-0 border-slate-200"
              />
              <Button onClick={copyDeviceId} variant="outline" className="shrink-0 hover:bg-slate-100 border-slate-200 text-slate-600" title="复制识别码">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm leading-relaxed border border-blue-100">
            <span className="font-semibold block mb-1">使用说明：</span>
            请<span className="font-semibold">复制上方特征码</span>并发送给管理员，待管理员在数据库录入并备案此设备后，点击下方刷新重试即可。
            
            {authError && (
              <div className="mt-3 p-3 bg-white/60 text-slate-700 text-xs rounded border border-blue-50 break-all whitespace-pre-wrap">
                提示: {authError}
              </div>
            )}
          </div>

          <Button 
            className="w-full text-base h-11 bg-blue-600 hover:bg-blue-700 text-white font-medium" 
            onClick={() => {
              toast.info("正在验证...");
              setRetryCount(c => c + 1);
            }}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            我已联系管理员添加，刷新重试
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
