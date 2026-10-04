import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { ProfileSalesItem, OrderColumn } from "../../lib/optimizer";
import { cn } from "@/lib/utils";

interface OrderInputCellProps {
  initialValue: number;
  colId: string;
  itemId: string;
  width: number;
  bgClass: string;
  onUpdate: (itemId: string, colId: string, val: number) => void;
}

const OrderInputCell = React.memo(function OrderInputCell({
  initialValue,
  colId,
  itemId,
  width,
  bgClass,
  onUpdate,
}: OrderInputCellProps) {
  const [val, setVal] = useState<string>(initialValue === 0 ? '' : String(initialValue));

  useEffect(() => {
    setVal(initialValue === 0 ? '' : String(initialValue));
  }, [initialValue]);

  const handleBlur = () => {
    const num = parseInt(val, 10) || 0;
    if (num !== initialValue) {
      onUpdate(itemId, colId, num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const num = parseInt(val, 10) || 0;
      if (num !== initialValue) {
        onUpdate(itemId, colId, num);
      }
    }
  };

  return (
    <td 
      style={{ width }} 
      className={cn("p-1 px-3 align-middle whitespace-nowrap", bgClass)}
    >
      <Input 
        type="number" 
        value={val} 
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="0"
        className="h-8 border-transparent hover:border-black/10 focus:border-orange-500 bg-transparent transition-all text-xs font-mono"
      />
    </td>
  );
});

interface ProfileSalesRowProps {
  item: ProfileSalesItem;
  idx: number;
  columns: OrderColumn[];
  columnWidths: Record<string, number>;
  stickyLefts: Record<string, number>;
  isBatch: boolean;
  onUpdateOrderValue: (id: string, colId: string, value: number) => void;
}

export const ProfileSalesRow = React.memo(function ProfileSalesRow({
  item,
  idx,
  columns,
  columnWidths,
  stickyLefts,
  isBatch,
  onUpdateOrderValue,
}: ProfileSalesRowProps) {
  const remainingValue = item.quantity - columns.reduce((sum, col) => sum + (item.orders?.[col.id] || 0), 0);
  const isRed = remainingValue < 0;

  const getStickyTdStyle = (key: string) => {
    const isSticky = stickyLefts[key] !== undefined;
    return {
      position: isSticky ? ('sticky' as const) : undefined,
      left: isSticky ? stickyLefts[key] : undefined,
      zIndex: isSticky ? 10 : undefined,
      width: columnWidths[key] || 100
    };
  };

  const getStickyTdClass = (key: string) => {
    const isSticky = stickyLefts[key] !== undefined;
    if (!isSticky) return "";
    return cn(
      "sticky z-10 transition-colors border-r border-black/[0.03]",
      isRed 
        ? "bg-[#fdf2f2] group-hover:bg-[#fde2e2]" 
        : "bg-white group-hover:bg-slate-50",
      key === 'remaining' && "border-r-2 border-black/20 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.15)]"
    );
  };

  return (
    <tr 
      className={cn(
        "border-b transition-colors hover:bg-muted/50 group border-black/[0.03] last:border-0",
        isRed ? "bg-red-50/50 hover:bg-red-100/50" : "hover:bg-black/[0.01]"
      )}
    >
      <td 
        style={getStickyTdStyle('index')} 
        className={cn(
          getStickyTdClass('index'),
          "px-2 text-center text-xs font-mono text-black/50 select-none align-middle whitespace-nowrap"
        )}
      >
        {idx + 1}
      </td>
      <td style={getStickyTdStyle('profileName')} className={getStickyTdClass('profileName')}>
        <div className="h-8 flex items-center px-3 text-xs text-black/60 truncate cursor-not-allowed">
          {item.profileName || '-'}
        </div>
      </td>
      <td style={getStickyTdStyle('model')} className={getStickyTdClass('model')}>
        <div className="h-8 flex items-center px-3 text-xs text-black/60 cursor-not-allowed">
          {item.model || '-'}
        </div>
      </td>
      <td style={getStickyTdStyle('length')} className={getStickyTdClass('length')}>
        <div className="h-8 flex items-center px-3 text-xs font-mono text-black/60 cursor-not-allowed">
          {item.length || '-'}
        </div>
      </td>
      <td style={getStickyTdStyle('color')} className={getStickyTdClass('color')}>
        <div className="h-8 flex items-center px-3 text-xs text-black/60 cursor-not-allowed">
          {item.color || '-'}
        </div>
      </td>
      {isBatch && (
        <td style={getStickyTdStyle('orderNumber')} className={getStickyTdClass('orderNumber')}>
          <div className="h-8 flex items-center px-3 text-xs text-black/60 cursor-not-allowed">
            {item.orderNumber || '-'}
          </div>
        </td>
      )}
      <td style={getStickyTdStyle('quantity')} className={getStickyTdClass('quantity')}>
        <div className="h-8 flex items-center px-3 text-xs font-mono text-black/60 cursor-not-allowed">
          {item.quantity}
        </div>
      </td>
      <td style={getStickyTdStyle('remaining')} className={getStickyTdClass('remaining')}>
        <div className={cn("h-8 flex items-center px-3 text-xs font-mono font-bold", isRed ? "text-red-600" : remainingValue > 0 ? "text-green-600" : "text-black/40")}>
          {remainingValue}
        </div>
      </td>

      {/* Dynamic Orders inputs */}
      {columns.map((col, colIdx) => {
        const orderVal = item.orders?.[col.id] || 0;
        return (
          <OrderInputCell
            key={col.id}
            initialValue={orderVal}
            colId={col.id}
            itemId={item.id}
            width={columnWidths[col.id] || 100}
            bgClass={colIdx % 2 === 0 ? "bg-blue-50/20" : "bg-indigo-50/20"}
            onUpdate={onUpdateOrderValue}
          />
        );
      })}
    </tr>
  );
}, (prevProps, nextProps) => {
  if (prevProps.item !== nextProps.item) {
    if (
      prevProps.item.id !== nextProps.item.id ||
      prevProps.item.quantity !== nextProps.item.quantity ||
      prevProps.item.profileName !== nextProps.item.profileName ||
      prevProps.item.model !== nextProps.item.model ||
      prevProps.item.length !== nextProps.item.length ||
      prevProps.item.color !== nextProps.item.color ||
      prevProps.item.orderNumber !== nextProps.item.orderNumber
    ) {
      return false;
    }
    // Check orders equality
    const prevOrders = prevProps.item.orders || {};
    const nextOrders = nextProps.item.orders || {};
    const allColIds = new Set([...Object.keys(prevOrders), ...Object.keys(nextOrders)]);
    for (const colId of allColIds) {
      if ((prevOrders[colId] || 0) !== (nextOrders[colId] || 0)) {
        return false;
      }
    }
  }

  if (prevProps.idx !== nextProps.idx) return false;
  if (prevProps.isBatch !== nextProps.isBatch) return false;
  if (prevProps.columns !== nextProps.columns) {
    if (prevProps.columns.length !== nextProps.columns.length) return false;
    for (let i = 0; i < prevProps.columns.length; i++) {
      if (prevProps.columns[i].id !== nextProps.columns[i].id || prevProps.columns[i].name !== nextProps.columns[i].name) {
        return false;
      }
    }
  }
  if (prevProps.columnWidths !== nextProps.columnWidths) {
    for (const key of Object.keys(nextProps.columnWidths)) {
      if (prevProps.columnWidths[key] !== nextProps.columnWidths[key]) return false;
    }
  }
  if (prevProps.stickyLefts !== nextProps.stickyLefts) {
    for (const key of Object.keys(nextProps.stickyLefts)) {
      if (prevProps.stickyLefts[key] !== nextProps.stickyLefts[key]) return false;
    }
  }
  return true;
});
