import * as XLSX from 'xlsx';

export function getVisualWidth(val: any): number {
  if (val === null || val === undefined) return 0;
  const str = String(val);
  let width = 0;
  for (let i = 0; i < str.length; i++) {
    width += str.charCodeAt(i) > 255 ? 2 : 1;
  }
  return width;
}

export interface ExportColumn<T> {
  header: string;
  getValue: (item: T, index: number) => any;
}

/**
 * 通用 Excel 导出工具：
 * 1. 自适应列宽
 * 2. 文字/数字居中对齐
 * 3. 数值 0 正常显示
 * 4. 自动生成最左侧序号列
 * 5. 包含采购单号等字段
 */
export function exportToExcel<T>({
  filename,
  sheetName = 'Sheet1',
  columns,
  data,
  includeIndex = true,
}: {
  filename: string;
  sheetName?: string;
  columns: ExportColumn<T>[];
  data: T[];
  includeIndex?: boolean;
}) {
  const headers: string[] = [];
  if (includeIndex) {
    headers.push('序号');
  }
  columns.forEach(col => headers.push(col.header));

  const rows: any[][] = [];

  data.forEach((item, idx) => {
    const row: any[] = [];
    if (includeIndex) {
      row.push(idx + 1);
    }
    columns.forEach(col => {
      let val = col.getValue(item, idx);
      if (val === null || val === undefined) {
        val = '';
      }
      row.push(val);
    });
    rows.push(row);
  });

  const aoa = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // 1. 自适应列宽 (Auto-fit column width)
  const colWidths: { wch: number }[] = [];
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    let maxLen = getVisualWidth(headers[colIdx]);
    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const cellVal = rows[rowIdx][colIdx];
      const cellLen = getVisualWidth(cellVal);
      if (cellLen > maxLen) {
        maxLen = cellLen;
      }
    }
    // 增加适当内边距，最小列宽 8
    colWidths.push({ wch: Math.max(maxLen + 4, 8) });
  }
  ws['!cols'] = colWidths;

  // 2. 文字居中显示 (Center alignment)
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cellAddress]) continue;
        if (!ws[cellAddress].s) ws[cellAddress].s = {};
        ws[cellAddress].s.alignment = {
          horizontal: 'center',
          vertical: 'center',
          wrapText: true,
        };
      }
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const finalFilename = filename.endsWith('.xlsx') ? filename : `${filename.replace(/\.csv$/, '')}.xlsx`;
  XLSX.writeFile(wb, finalFilename);
}
