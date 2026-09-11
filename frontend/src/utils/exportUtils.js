import * as XLSX from 'xlsx-js-style';

// يطبع محتوى HTML عبر إطار مخفي داخل الصفحة نفسها - لا يعتمد على صلاحية فتح نوافذ منبثقة
// (window.open قد يُحظر من متصفحات كثيرة حتى مع نقرة مستخدم حقيقية)
export function printHtml(title, bodyHtml) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <html dir="rtl" lang="ar">
      <head>
        <title>${title}</title>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          body { font-family: Tahoma, Arial, sans-serif; padding: 32px; color: #1e2530; }
          h1 { font-size: 20px; margin: 0 0 4px; }
          .meta { color: #5a6474; font-size: 13px; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border: 1px solid #d3dae3; padding: 6px 8px; text-align: right; font-size: 11.5px; }
          th { background: #f4f6f8; font-weight: 700; }
          .badge { padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `);
  doc.close();

  iframe.onload = () => {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => document.body.removeChild(iframe), 1000);
  };
}

// يُنزّل ملف Word (.doc) عبر تحويل HTML مباشرةً - يفتحه Word فعليًا كجدول منسّق
export function exportToWord(filename, title, bodyHtml) {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Tahoma, Arial, sans-serif; direction: rtl; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #999; padding: 6px 8px; text-align: right; font-size: 12px; }
          th { background: #eee; font-weight: bold; }
          h1 { font-size: 18px; }
        </style>
      </head>
      <body>${bodyHtml}</body>
    </html>
  `;
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.doc`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ألوان الهوية البصرية لنظام Starlight - تُستخدم في كل ملفات Excel المُصدَّرة من النظام
const BRAND = {
  titleFill: '4F46E5', // primary-dark
  headerFill: '6366F1', // primary
  accentFill: '22D3EE', // primary-2
  lightFill: 'EEF2FF', // primary-light
  altRowFill: 'F7F8FC',
  darkText: '1E2530',
  mutedText: '5A6474',
  white: 'FFFFFF',
  border: 'D3DAE3',
};

const thinBorder = { style: 'thin', color: { rgb: BRAND.border } };
const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

function autoWidth(header, values) {
  const headerLen = String(header ?? '').length;
  const maxValueLen = values.reduce((max, v) => Math.max(max, String(v ?? '').length), 0);
  return { wch: Math.min(Math.max(headerLen, maxValueLen, 8) + 4, 45) };
}

/**
 * يبني ملف Excel نظامي كامل الهوية البصرية: من اليمين إلى اليسار، بعنوان النظام واسم التقرير
 * وتاريخ الإصدار، ورؤوس أعمدة وصفوف منسّقة بالألوان والحدود، وصف إجمالي اختياري.
 *
 * columns: [{ key, header, numFmt? }]
 * rows: [{ [key]: value }]
 * totalsRow: { [key]: value } | null - يُعرض بخط عريض وحد علوي مزدوج
 */
export function exportStyledExcel({
  filename,
  sheetName = 'Sheet1',
  reportTitle,
  reportSubtitle,
  columns,
  rows,
  totalsRow,
}) {
  const colCount = columns.length;
  const lastColLetter = XLSX.utils.encode_col(colCount - 1);

  const aoa = [];
  aoa.push(['نظام إدارة المستشفيات by Starlight']);
  aoa.push([reportTitle || sheetName]);
  aoa.push([
    `${reportSubtitle ? reportSubtitle + '  |  ' : ''}تاريخ الإصدار: ${new Date().toLocaleString('en-GB')}  |  عدد السجلات: ${rows.length}`,
  ]);
  aoa.push([]); // فاصل
  aoa.push(columns.map((c) => c.header));
  rows.forEach((r) => aoa.push(columns.map((c) => (r[c.key] === undefined || r[c.key] === null ? '' : r[c.key]))));
  if (totalsRow) {
    aoa.push(columns.map((c) => (totalsRow[c.key] === undefined || totalsRow[c.key] === null ? '' : totalsRow[c.key])));
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // اتجاه الورقة من اليمين إلى اليسار - المفتاح الصحيح في xlsx-js-style هو RTL (بحرف كبير)
  // وليس rightToLeft، وإلا تُتجاهَل الخاصية صامتًا ولا يظهر أي أثر في ملف الإكسل الناتج
  ws['!views'] = [{ RTL: true }];

  // دمج صفوف العنوان عبر كل الأعمدة
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
  ];

  const headerRowIdx = 4; // صف رؤوس الأعمدة (0-based)
  const dataStartIdx = headerRowIdx + 1;

  // تنسيق صف "اسم النظام"
  const titleCell = XLSX.utils.encode_cell({ r: 0, c: 0 });
  ws[titleCell].s = {
    font: { bold: true, sz: 15, color: { rgb: BRAND.white } },
    fill: { fgColor: { rgb: BRAND.titleFill } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  // تنسيق صف عنوان التقرير
  const reportCell = XLSX.utils.encode_cell({ r: 1, c: 0 });
  ws[reportCell].s = {
    font: { bold: true, sz: 13, color: { rgb: BRAND.darkText } },
    fill: { fgColor: { rgb: BRAND.lightFill } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  // تنسيق صف البيانات الوصفية (التاريخ وعدد السجلات)
  const metaCell = XLSX.utils.encode_cell({ r: 2, c: 0 });
  ws[metaCell].s = {
    font: { italic: true, sz: 10, color: { rgb: BRAND.mutedText } },
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  // تنسيق رؤوس الأعمدة
  for (let c = 0; c < colCount; c += 1) {
    const cellRef = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (!ws[cellRef]) continue;
    ws[cellRef].s = {
      font: { bold: true, sz: 11, color: { rgb: BRAND.white } },
      fill: { fgColor: { rgb: BRAND.headerFill } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: allBorders,
    };
  }

  // تنسيق صفوف البيانات (تظليل متبادل + حدود + محاذاة يمين)
  rows.forEach((row, rIdx) => {
    const excelRow = dataStartIdx + rIdx;
    const isAlt = rIdx % 2 === 1;
    columns.forEach((col, c) => {
      const cellRef = XLSX.utils.encode_cell({ r: excelRow, c });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      const isNumeric = typeof row[col.key] === 'number';
      ws[cellRef].s = {
        font: { sz: 10.5, color: { rgb: BRAND.darkText } },
        fill: { fgColor: { rgb: isAlt ? BRAND.altRowFill : BRAND.white } },
        alignment: { horizontal: isNumeric ? 'center' : 'right', vertical: 'center' },
        border: allBorders,
      };
      if (col.numFmt && isNumeric) ws[cellRef].z = col.numFmt;
    });
  });

  // تنسيق صف الإجمالي (إن وُجد)
  if (totalsRow) {
    const excelRow = dataStartIdx + rows.length;
    columns.forEach((col, c) => {
      const cellRef = XLSX.utils.encode_cell({ r: excelRow, c });
      if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' };
      const isNumeric = typeof totalsRow[col.key] === 'number';
      ws[cellRef].s = {
        font: { bold: true, sz: 11, color: { rgb: BRAND.darkText } },
        fill: { fgColor: { rgb: BRAND.accentFill } },
        alignment: { horizontal: isNumeric ? 'center' : 'right', vertical: 'center' },
        border: { top: { style: 'double', color: { rgb: BRAND.titleFill } }, bottom: thinBorder, left: thinBorder, right: thinBorder },
      };
      if (col.numFmt && isNumeric) ws[cellRef].z = col.numFmt;
    });
  }

  // عرض الأعمدة تلقائيًا حسب أطول محتوى
  ws['!cols'] = columns.map((col) => autoWidth(col.header, rows.map((r) => r[col.key])));

  // ارتفاع صف العنوان الرئيسي أكبر قليلًا
  ws['!rows'] = [{ hpx: 26 }, { hpx: 22 }, { hpx: 18 }];

  ws['!ref'] = `A1:${lastColLetter}${dataStartIdx + rows.length + (totalsRow ? 1 : 0)}`;

  const workbook = XLSX.utils.book_new();
  workbook.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(workbook, ws, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

// يُنزّل ملف Excel من مصفوفة كائنات (كل عنصر = صف، مفاتيحه = أسماء الأعمدة) بنفس الهوية البصرية
// المنسّقة للنظام (RTL + ألوان + حدود) - واجهة مبسّطة فوق exportStyledExcel لأي شاشة في النظام
export function exportToExcel(filename, sheetName, rows, options = {}) {
  if (!rows || rows.length === 0) {
    exportStyledExcel({ filename, sheetName, reportTitle: options.reportTitle || sheetName, columns: [{ key: 'msg', header: 'لا توجد بيانات' }], rows: [] });
    return;
  }
  const keys = Object.keys(rows[0]);
  const columns = keys.map((k) => ({ key: k, header: k, numFmt: typeof rows[0][k] === 'number' ? '#,##0.00' : undefined }));
  exportStyledExcel({
    filename,
    sheetName,
    reportTitle: options.reportTitle || sheetName,
    reportSubtitle: options.reportSubtitle,
    columns,
    rows,
    totalsRow: options.totalsRow,
  });
}
