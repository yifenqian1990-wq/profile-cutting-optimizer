
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, PurchaseItem } from "../lib/optimizer";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUp, ArrowDown, ArrowUpAZ, ChevronsUp, ChevronsDown } from "lucide-react";

interface SettingsPanelProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  purchases?: PurchaseItem[];
}

export function SettingsPanel({ settings, setSettings, purchases = [] }: SettingsPanelProps) {
  const updateSetting = (field: keyof Settings, value: any) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-black/5 shadow-sm max-w-2xl">
          <CardHeader>
            <CardTitle className="text-lg font-bold">切割参数</CardTitle>
            <CardDescription>配置锯片宽度、料头损耗及优化算法</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="kerf" className="text-sm font-medium">锯缝宽度 (mm)</Label>
                <span className="text-xs text-black/40">每次切割损耗的材料</span>
              </div>
              <Input 
                id="kerf"
                type="number"
                value={settings.kerf}
                onChange={(e) => updateSetting('kerf', parseFloat(e.target.value) || 0)}
                className="h-10 border-black/10 focus:border-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="trim" className="text-sm font-medium">料头长度 (mm)</Label>
                <span className="text-xs text-black/40">原材料两端需切除的长度</span>
              </div>
              <Input 
                id="trim"
                type="number"
                value={settings.trim}
                onChange={(e) => updateSetting('trim', parseFloat(e.target.value) || 0)}
                className="h-10 border-black/10 focus:border-orange-500"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="timeoutMinutes" className="text-sm font-medium">套裁时间限制 (分钟)</Label>
                <span className="text-xs text-black/40">单次套裁计算超时上限，默认10分钟</span>
              </div>
              <Input 
                id="timeoutMinutes"
                type="number"
                min={1}
                max={180}
                step={1}
                value={settings.timeoutMinutes ?? 10}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  updateSetting('timeoutMinutes', isNaN(val) ? 10 : Math.max(1, val));
                }}
                className="h-10 border-black/10 focus:border-orange-500"
                placeholder="默认: 10"
              />
              <p className="text-[10px] text-black/40 leading-relaxed">
                设置每次套裁计算的最长允许时间（默认10分钟）。如果数据量较大或计算复杂度高，可手动调大此限制以避免超时中断。
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="algorithm" className="text-sm font-medium">套裁优化算法</Label>
                <span className="text-xs text-black/40">选择用于计算排料套裁的算法引擎</span>
              </div>
              <Select 
                value={settings.algorithm || 'CG'} 
                onValueChange={(val) => updateSetting('algorithm', val)}
              >
                <SelectTrigger id="algorithm" className="h-10 border-black/10 focus:border-orange-500">
                  <SelectValue placeholder="选择算法" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FFD">快速贪心算法 (FFD)</SelectItem>
                  <SelectItem value="CG">列生成整数规划算法 (CG/MIP - 推荐，省料)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-black/40 leading-relaxed">
                <strong>快速贪心算法 (FFD)：</strong>一根一根材料拼凑，计算极快。但在大料与极其零碎的小料混合时，容易提前耗尽零碎小料导致后续大料产生严重的“贪心浪费”。<br />
                <strong>列生成整数规划算法 (CG/MIP)：</strong>进行全局多方案数学规划（推荐）。通过列生成算法配合混合整数线性规划，全局寻找总原材料用量最省的套裁方案，能彻底避免上述废料陷阱。
              </p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label htmlFor="prioritize-stock" className="text-sm font-medium">优先消耗库存</Label>
                <p className="text-[10px] text-black/40">优先使用库存列表中的材料，库存用完后再订购新料</p>
              </div>
              <Switch 
                id="prioritize-stock"
                checked={settings.prioritizeStock}
                onCheckedChange={(val) => updateSetting('prioritizeStock', val)}
              />
            </div>

            {settings.prioritizeStock && (
              <>
                <Separator />
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-sm font-medium">库存套裁优先消耗顺序</Label>
                        <p className="text-xs text-black/40 mt-1">按此顺序依次在采购单上进行库存套裁消耗。</p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-1"
                        onClick={() => {
                            const availableOrders = Array.from(new Set(purchases.map(p => p.orderNumber).filter(Boolean)));
                            const priorityList = settings.quoteOrderPriority && settings.quoteOrderPriority.length > 0 
                              ? [...settings.quoteOrderPriority, ...availableOrders.filter(o => !settings.quoteOrderPriority!.includes(o))]
                              : availableOrders;
                            const sorted = [...priorityList].sort((a, b) => String(a).localeCompare(String(b)));
                            updateSetting('quoteOrderPriority', sorted);
                        }}
                      >
                        <ArrowUpAZ className="h-4 w-4" /> 升序排列
                      </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-black/10 bg-slate-50/80">
                      <div className="space-y-0.5 pr-3">
                        <div className="flex items-center gap-2">
                          <Label htmlFor="strict-order-switch" className="text-sm font-semibold cursor-pointer">
                            严格按顺序
                          </Label>
                          <span className={`text-[11px] px-1.5 py-0.5 rounded font-medium ${settings.strictOrderPriority ? 'bg-orange-100 text-orange-700' : 'bg-slate-200 text-slate-600'}`}>
                            {settings.strictOrderPriority ? '严格优先' : '兼顾套裁率'}
                          </span>
                        </div>
                        <p className="text-xs text-black/55 leading-relaxed">
                          开启后，排在前面的库存订单必须优先消耗完毕（即使套裁率较低也必须全部用完才能继续下一个库存订单）；关闭后，在套裁率不错的情况下可选用优先级稍后的订单。
                        </p>
                      </div>
                      <Switch 
                        id="strict-order-switch"
                        checked={Boolean(settings.strictOrderPriority)}
                        onCheckedChange={(checked) => updateSetting('strictOrderPriority', checked)}
                      />
                    </div>
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1 border rounded-md p-2 bg-white">
                      {(() => {
                        const availableOrders = Array.from(new Set(purchases.map(p => p.orderNumber).filter(Boolean)));
                        const priorityList = settings.quoteOrderPriority && settings.quoteOrderPriority.length > 0 
                          ? [...settings.quoteOrderPriority, ...availableOrders.filter(o => !settings.quoteOrderPriority!.includes(o))]
                          : availableOrders;

                        return priorityList.map((order, idx, arr) => {
                          const isIgnored = settings.quoteOrderIgnored?.includes(order);
                          return (
                          <div key={order} className="flex items-center justify-between bg-black/5 border border-black/5 rounded-md px-3 py-2 text-sm">
                            <div className="flex items-center gap-2">
                              <input 
                                type="checkbox" 
                                className="h-4 w-4 rounded border-black/20 text-orange-600 focus:ring-orange-500"
                                checked={!isIgnored} 
                                onChange={(e) => {
                                   const ignored = settings.quoteOrderIgnored || [];
                                   if (e.target.checked) {
                                      updateSetting('quoteOrderIgnored', ignored.filter(o => o !== order));
                                   } else {
                                      updateSetting('quoteOrderIgnored', [...ignored, order]);
                                   }
                                }}
                              />
                              <span className={isIgnored ? "line-through text-black/40" : ""}>{idx + 1}. {order}</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-black/10" 
                                disabled={idx === 0}
                                title="置顶"
                                onClick={() => {
                                  const newPriority = [...arr];
                                  const item = newPriority.splice(idx, 1)[0];
                                  newPriority.unshift(item);
                                  updateSetting('quoteOrderPriority', newPriority);
                                }}
                              >
                                <ChevronsUp className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-black/10" 
                                disabled={idx === 0}
                                title="上移"
                                onClick={() => {
                                  const newPriority = [...arr];
                                  const temp = newPriority[idx - 1];
                                  newPriority[idx - 1] = newPriority[idx];
                                  newPriority[idx] = temp;
                                  updateSetting('quoteOrderPriority', newPriority);
                                }}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-black/10" 
                                disabled={idx === arr.length - 1}
                                title="下移"
                                onClick={() => {
                                  const newPriority = [...arr];
                                  const temp = newPriority[idx + 1];
                                  newPriority[idx + 1] = newPriority[idx];
                                  newPriority[idx] = temp;
                                  updateSetting('quoteOrderPriority', newPriority);
                                }}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 hover:bg-black/10" 
                                disabled={idx === arr.length - 1}
                                title="置尾"
                                onClick={() => {
                                  const newPriority = [...arr];
                                  const item = newPriority.splice(idx, 1)[0];
                                  newPriority.push(item);
                                  updateSetting('quoteOrderPriority', newPriority);
                                }}
                              >
                                <ChevronsDown className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )});
                      })()}
                    </div>
                    {purchases.length === 0 && <div className="text-sm text-black/40 italic">暂无采购单记录</div>}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="modulus-enabled" className="text-sm font-medium">开启定尺模数</Label>
                  <p className="text-[10px] text-black/40">开启后内容录入定尺长度必须是该数值倍数</p>
                </div>
                <Switch 
                  id="modulus-enabled"
                  checked={settings.modulusEnabled}
                  onCheckedChange={(val) => updateSetting('modulusEnabled', val)}
                />
              </div>
              
              {settings.modulusEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-orange-500/20">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="modulus-value" className="text-sm font-medium">模数数值 (mm)</Label>
                  </div>
                  <Input 
                    id="modulus-value"
                    type="number"
                    value={settings.modulusValue}
                    onChange={(e) => updateSetting('modulusValue', parseFloat(e.target.value) || 1)}
                    className="h-10 border-black/10 focus:border-orange-500"
                    placeholder="例如: 100"
                  />
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="auto-adjust-fixed" className="text-sm font-medium">自动调整定尺方案</Label>
                  <p className="text-[10px] text-black/40">开启后优化时若需要定尺，会自动寻找利用率高的长度</p>
                </div>
                <Switch 
                  id="auto-adjust-fixed"
                  checked={settings.autoAdjustFixedLength}
                  onCheckedChange={(val) => updateSetting('autoAdjustFixedLength', val)}
                />
              </div>

              {settings.autoAdjustFixedLength && (
                <div className="space-y-4 pl-4 border-l-2 border-orange-500/20">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="max-auto-lengths" className="text-sm font-medium">最大定尺种类数量(1-6)</Label>
                    </div>
                    <Input 
                      id="max-auto-lengths"
                      type="number"
                      min={1}
                      max={6}
                      value={settings.maxAutoLengthsCount ?? 6}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 1;
                        if (val < 1) val = 1;
                        if (val > 6) val = 6;
                        updateSetting('maxAutoLengthsCount', val);
                      }}
                      className="h-10 border-black/10 focus:border-orange-500"
                    />
                  </div>
                  
                  <div className="space-y-2 pt-2 border-t border-black/5">
                    <Label className="text-sm font-medium">自动调整模式</Label>
                    <RadioGroup 
                      value={settings.autoAdjustMode || 'efficiency'} 
                      onValueChange={(val) => updateSetting('autoAdjustMode', val)}
                      className="grid grid-cols-1 gap-3 pt-1"
                    >
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="efficiency" id="adj-mode-eff" className="mt-1 border-black/20 text-orange-500 focus:ring-orange-500" />
                        <div>
                          <Label htmlFor="adj-mode-eff" className="text-sm font-medium cursor-pointer text-gray-700">利用率最高模式</Label>
                          <p className="text-[10px] text-black/40">在候选范围内自动寻找整体原材料利用率最高的定尺长度</p>
                        </div>
                      </div>
                      <div className="flex items-start space-x-2">
                        <RadioGroupItem value="smallMaterial" id="adj-mode-small" className="mt-1 border-black/20 text-orange-500 focus:ring-orange-500" />
                        <div>
                          <Label htmlFor="adj-mode-small" className="text-sm font-medium cursor-pointer text-gray-700">小料定尺模式</Label>
                          <p className="text-[10px] text-black/40">按 “(零件长度 + 锯缝) * 切料数量 + 修边 = 接近满足模数” 的计算方式，减少切割后的废料头</p>
                        </div>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-black/5">
                    <div className="space-y-0.5">
                      <Label htmlFor="use-purchase-lengths" className="text-sm font-medium">优先采用采购单定尺</Label>
                      <p className="text-[10px] text-black/40">优先采用采购单定尺（排除料头利用），若未消耗定尺则保持原定尺方案，需要定尺时满足模数、锁定、种类数量、长度限制等要求</p>
                    </div>
                    <Switch 
                      id="use-purchase-lengths"
                      checked={settings.usePurchaseOrderLengths}
                      onCheckedChange={(val) => updateSetting('usePurchaseOrderLengths', val)}
                    />
                  </div>
                </div>
              )}

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="limits-enabled" className="text-sm font-medium">定尺长度限制</Label>
                  <p className="text-[10px] text-black/40">开启后限制所有型材的自动最优定尺范围</p>
                </div>
                <Switch 
                  id="limits-enabled"
                  checked={settings.limitLengthEnabled}
                  onCheckedChange={(val) => updateSetting('limitLengthEnabled', val)}
                />
              </div>
              
              {settings.limitLengthEnabled && (
                <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-orange-500/20">
                  <div className="space-y-2">
                    <Label htmlFor="min-length-val" className="text-sm font-medium">最短 (mm)</Label>
                    <Input 
                      id="min-length-val"
                      type="number"
                      value={settings.minLength}
                      onChange={(e) => updateSetting('minLength', parseFloat(e.target.value) || 0)}
                      className="h-10 border-black/10 focus:border-orange-500"
                      placeholder="例如: 3000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-length-val" className="text-sm font-medium">最长 (mm)</Label>
                    <Input 
                      id="max-length-val"
                      type="number"
                      value={settings.maxLength}
                      onChange={(e) => updateSetting('maxLength', parseFloat(e.target.value) || 0)}
                      className="h-10 border-black/10 focus:border-orange-500"
                      placeholder="例如: 7000"
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="ignore-models-enabled" className="text-sm font-medium">开启型号忽略</Label>
                  <p className="text-[10px] text-black/40">开启后填入的型号在套裁计算时将被忽略</p>
                </div>
                <Switch 
                  id="ignore-models-enabled"
                  checked={settings.ignoreModelsEnabled}
                  onCheckedChange={(val) => updateSetting('ignoreModelsEnabled', val)}
                />
              </div>
              
              {settings.ignoreModelsEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-orange-500/20">
                  <Label htmlFor="ignored-models-textarea" className="text-sm font-medium">忽略套裁的型号列表 (一行一个型号)</Label>
                  <Textarea 
                    id="ignored-models-textarea"
                    value={(settings.ignoredModels || []).join('\n')}
                    onChange={(e) => {
                      const list = e.target.value.split('\n');
                      updateSetting('ignoredModels', list);
                    }}
                    placeholder={"例如:\nXH-101\nXH-102"}
                    className="min-h-[100px] border-black/10 focus:border-orange-500 font-mono text-sm"
                  />
                  <p className="text-[10px] text-black/40">优化套裁时，这些型号的零件将被忽略，不参与套裁计算。填入的一行数据整体即为一个型号。</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="substitute-models-enabled" className="text-sm font-medium">开启型号替换</Label>
                  <p className="text-[10px] text-black/40">开启后可配置替换规则，主型号库存消耗完后自动消耗替换型号的库存</p>
                </div>
                <Switch 
                  id="substitute-models-enabled"
                  checked={settings.substituteModelsEnabled}
                  onCheckedChange={(val) => updateSetting('substituteModelsEnabled', val)}
                />
              </div>
              
              {settings.substituteModelsEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-orange-500/20">
                  <Label htmlFor="substitute-models-textarea" className="text-sm font-medium">{"型号替换方案 (一行一种替换，以 \"/\" 为唯一分隔符: 原型号/替换型号)"}</Label>
                  <Textarea 
                    id="substitute-models-textarea"
                    value={(settings.substituteModelRules || []).join('\n')}
                    onChange={(e) => {
                      const list = e.target.value.split('\n');
                      updateSetting('substituteModelRules', list);
                    }}
                    placeholder={"例如:\nXH-101/XH-102\nXH-201/XH-202"}
                    className="min-h-[100px] border-black/10 focus:border-orange-500 font-mono text-sm"
                  />
                  <p className="text-[10px] text-black/40">当原型号库存消耗完毕后，系统将自动继续消耗该替换型号的库存，以"/"为唯一分隔符，一行一种替换。</p>
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="substitute-colors-enabled" className="text-sm font-medium">开启颜色替换</Label>
                  <p className="text-[10px] text-black/40">开启后可配置替换规则，原颜色库存消耗完后自动消耗替换颜色的库存</p>
                </div>
                <Switch 
                  id="substitute-colors-enabled"
                  checked={settings.substituteColorsEnabled}
                  onCheckedChange={(val) => updateSetting('substituteColorsEnabled', val)}
                />
              </div>
              
              {settings.substituteColorsEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-amber-500/20">
                  <Label htmlFor="substitute-colors-textarea" className="text-sm font-medium">{"颜色替换方案 (一行一种替换，以 \"/\" 为唯一分隔符: 原颜色/替换颜色)"}</Label>
                  <Textarea 
                    id="substitute-colors-textarea"
                    value={(settings.substituteColorRules || []).join('\n')}
                    onChange={(e) => {
                      const list = e.target.value.split('\n');
                      updateSetting('substituteColorRules', list);
                    }}
                    placeholder={"例如:\n氧化银/磨砂银\n白色/电泳白"}
                    className="min-h-[100px] border-black/10 focus:border-amber-500 font-mono text-sm"
                  />
                  <p className="text-[10px] text-black/40">当原颜色库存消耗完毕后，系统将自动继续消耗该替换颜色的库存，以"/"为唯一分隔符，一行一种替换。</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
