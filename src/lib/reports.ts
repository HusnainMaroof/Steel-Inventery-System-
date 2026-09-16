import { fmtDate, fmtMoney, fmtPct } from "./format";
import { ymd, type ProfitReport } from "./profitReport";

function periodText(ex: ProfitReport) {
  return ex.mode === "range" ? `${fmtDate(ex.from)} → ${fmtDate(ex.to)}` : ex.periodLabel;
}

function csvCell(v: string | number) {
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "report";
}

function fileStamp(ex: ProfitReport) {
  return `${slug(ex.productLabel)}-${slug(ex.periodLabel)}`;
}

function qty(n: number, unit: string) {
  const v = (Math.round(n * 1000) / 1000).toLocaleString("en-US");
  return unit ? `${v} ${unit}` : v;
}

export function reportCsv(ex: ProfitReport) {
  const purCharges = [
    ["Transport", ex.purchaseCharges.transport],
    ["Loading", ex.purchaseCharges.loading],
    ["Labour", ex.purchaseCharges.labour],
    ["Other", ex.purchaseCharges.other],
  ].filter(([, v]) => (v as number) > 0.001);
  const saleCharges = [
    ["Loading", ex.saleCharges.loading],
    ["Transport", ex.saleCharges.transport],
    ["Labour", ex.saleCharges.labour],
  ].filter(([, v]) => (v as number) > 0.001);

  const lines: (string | number)[][] = [
    ["Profit & Reports"],
    ["Period", periodText(ex)],
    ["Product", ex.productLabel],
    [],
    ["Stock Summary"],
    ["Product", "Opening", "Purchase", "Total", "Sold", "Remaining", "Opening Value", "Purchase Value", "Total Stock Value", "Sales Amount", "Valuation of Remaining"],
    ...ex.stock.map((r) => [
      r.productName,
      qty(r.openingQty, r.unit),
      qty(r.purchaseQty, r.unit),
      qty(r.totalQty, r.unit),
      qty(r.soldQty, r.unit),
      qty(r.remainingQty, r.unit),
      r.openingValue,
      r.purchaseValue,
      r.openingValue + r.purchaseValue,
      r.salesAmount,
      r.remainingValue,
    ]),
    ["", "", "", "", "", "Total value", ex.openingValue, ex.purchaseValue, ex.totalStockValue, "", ex.remainingValue],
    [],
    ["Profit & Loss"],
    ["Sales Revenue", ex.salesRevenue],
    ["Stock Cost", ex.stockCost],
    ["Profit on Sales", ex.profitOnSales],
    ...(ex.expensesApplied ? [["Other Expenses", ex.expenses] as (string | number)[]] : []),
    ["Net Profit", ex.netProfit],
    ["Profit %", fmtPct(ex.profitPct)],
    [],
    ["Cash Position"],
    ["Opening Cash", ex.openingCash],
    ["Cash Received", ex.cashReceived],
    ["Cash Paid", ex.cashPaid],
    ...(ex.expensesApplied ? [["Other Expenses", ex.cashExpenses] as (string | number)[]] : []),
    ["Cash in Hand", ex.cashInHand],
    [],
    ["Business Value"],
    ["Valuation of Remaining Stock", ex.remainingValue],
    ["Customer Due", ex.customerDue],
    ["Cash in Hand", ex.cashInHand],
    ["Total Business Value", ex.businessValue],
    [],
    ["Money to Pay"],
    ["Supplier", "Due"],
    ...ex.suppliers.map((r) => [r.name, r.due]),
    ["Total Supplier Due", ex.supplierDue],
    [],
    ["Money to Receive"],
    ["Customer", "Due"],
    ...ex.customers.map((r) => [r.name, r.due]),
    ["Total Customer Due", ex.customerDue],
    [],
    ["Expenses"],
  ];
  if (purCharges.length > 0) {
    lines.push(
      ["Paid on Purchases"],
      ...purCharges,
      ["Subtotal", purCharges.reduce((a, [, v]) => a + (v as number), 0)]
    );
  }
  if (saleCharges.length > 0) {
    lines.push(
      ["Paid on Sales"],
      ...saleCharges,
      ["Subtotal", saleCharges.reduce((a, [, v]) => a + (v as number), 0)]
    );
  }
  if (ex.expensesApplied) {
    lines.push(
      ["Other Expenses"],
      ...ex.expenseRows.map((r) => [r.label, r.amount]),
      ["Total", ex.expenses]
    );
  }
  lines.push(
    [],
    ["Stock Count"],
    ["Product", "Stock in Records", "Counted in Yard", "Difference"],
    ...ex.stockChecks.map((r) => [
      r.productName,
      qty(r.systemQty, r.unit),
      r.physicalQty == null ? "Not counted yet" : qty(r.physicalQty, r.unit),
      r.difference == null ? "" : qty(r.difference, r.unit),
    ])
  );
  return lines.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function downloadReportCsv(ex: ProfitReport) {
  const blob = new Blob(["\uFEFF" + reportCsv(ex)], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `profit-report-${fileStamp(ex)}-${ymd(new Date())}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function money(n: number) {
  return fmtMoney(n);
}

function tr(label: string, value: string, strong = false) {
  return `<tr class="${strong ? "strong" : ""}"><td>${label}</td><td>${value}</td></tr>`;
}

export function printReportPdf(ex: ProfitReport) {
  const stockRows = ex.stock
    .map(
      (r) => `<tr>
        <td>${r.productName}</td>
        <td>${qty(r.openingQty, r.unit)}</td>
        <td>${qty(r.purchaseQty, r.unit)}</td>
        <td>${qty(r.totalQty, r.unit)}</td>
        <td>${qty(r.soldQty, r.unit)}</td>
        <td>${qty(r.remainingQty, r.unit)}</td>
        <td>${money(r.openingValue)}</td>
        <td>${money(r.purchaseValue)}</td>
        <td>${money(r.openingValue + r.purchaseValue)}</td>
        <td>${money(r.salesAmount)}</td>
        <td>${money(r.remainingValue)}</td>
      </tr>`
    )
    .join("");
  const payRows = ex.suppliers.map((r) => tr(r.name, money(r.due))).join("");
  const recRows = ex.customers.map((r) => tr(r.name, money(r.due))).join("");
  const purChargeRows = [
    ["Transport", ex.purchaseCharges.transport],
    ["Loading", ex.purchaseCharges.loading],
    ["Labour", ex.purchaseCharges.labour],
    ["Other", ex.purchaseCharges.other],
  ]
    .filter(([, v]) => (v as number) > 0.001)
    .map(([l, v]) => tr(l as string, money(v as number)))
    .join("");
  const saleChargeRows = [
    ["Loading", ex.saleCharges.loading],
    ["Transport", ex.saleCharges.transport],
    ["Labour", ex.saleCharges.labour],
  ]
    .filter(([, v]) => (v as number) > 0.001)
    .map(([l, v]) => tr(l as string, money(v as number)))
    .join("");
  const expRows = ex.expenseRows.map((r) => tr(r.label, money(r.amount))).join("");
  const checkRows = ex.stockChecks
    .map(
      (r) => `<tr>
        <td>${r.productName}</td>
        <td>${qty(r.systemQty, r.unit)}</td>
        <td>${r.physicalQty == null ? "Not counted yet" : qty(r.physicalQty, r.unit)}</td>
        <td>${r.difference == null ? "—" : qty(r.difference, r.unit)}</td>
      </tr>`
    )
    .join("");

  const html = `<!doctype html><html><head><title>Profit & Reports — ${periodText(ex)}</title>
<style>
  body { font-family: Inter, Arial, sans-serif; color: #171717; padding: 28px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p.meta { margin: 0 0 20px; font-size: 13px; }
  h2 { font-size: 11px; letter-spacing: .14em; text-transform: uppercase; margin: 28px 0 8px; }
  h3 { font-size: 12px; font-weight: 600; margin: 14px 0 2px; }
  p.note { font-size: 12px; margin: 2px 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 7px 0; border-bottom: 1px solid #e5e5e5; }
  td:nth-child(n+2), th:nth-child(n+2) { text-align: right; font-variant-numeric: tabular-nums; }
  tr.strong td { font-weight: 700; border-top: 1px solid #171717; border-bottom: none; }
</style></head><body>
<h1>Profit & Reports</h1>
<p class="meta">${periodText(ex)} · ${ex.productLabel}</p>
<h2>Stock Summary</h2>
<table>
<tr><th>Product</th><th>Opening</th><th>Purchase</th><th>Total</th><th>Sold</th><th>Remaining</th><th>Opening Value</th><th>Purchase Value</th><th>Total Stock Value</th><th>Sales Amount</th><th>Valuation</th></tr>
${stockRows}
</table>
<table>
${tr("Opening Stock Value", money(ex.openingValue))}
${tr("Purchase Value", money(ex.purchaseValue))}
${tr("Total Stock Value (investment)", money(ex.totalStockValue))}
${tr("Valuation of Remaining Stock", money(ex.remainingValue), true)}
</table>
<h2>Profit & Loss</h2>
<table>
${tr("Sales Revenue", money(ex.salesRevenue))}
${tr("Stock Cost", money(ex.stockCost))}
${tr("Profit on Sales", money(ex.profitOnSales), true)}
${ex.expensesApplied ? tr("Other Expenses", money(ex.expenses)) : ""}
${tr("Net Profit", money(ex.netProfit), true)}
${tr("Profit %", fmtPct(ex.profitPct))}
</table>
<h2>Cash Position</h2>
<table>
${tr("Opening Cash", money(ex.openingCash))}
${tr("Cash Received", money(ex.cashReceived))}
${tr("Cash Paid", money(ex.cashPaid))}
${ex.expensesApplied ? tr("Other Expenses", money(ex.cashExpenses)) : ""}
${tr("Cash in Hand", money(ex.cashInHand), true)}
</table>
<h2>Business Value</h2>
<table>
${tr("Valuation of Remaining Stock", money(ex.remainingValue))}
${tr("Customer Due", money(ex.customerDue))}
${tr("Cash in Hand", money(ex.cashInHand))}
${tr("Total Business Value", money(ex.businessValue), true)}
</table>
<h2>Money to Pay</h2>
<table>
${payRows || tr("No supplier due", money(0))}
${tr("Total Supplier Due", money(ex.supplierDue), true)}
</table>
<h2>Money to Receive</h2>
<table>
${recRows || tr("No customer due", money(0))}
${tr("Total Customer Due", money(ex.customerDue), true)}
</table>
<h2>Expenses</h2>
${
  purChargeRows
    ? `<h3>Paid on Purchases</h3><table>${purChargeRows}${tr("Subtotal", money(
        ex.purchaseCharges.transport +
          ex.purchaseCharges.loading +
          ex.purchaseCharges.labour +
          ex.purchaseCharges.other
      ), true)}</table>`
    : ""
}
${
  saleChargeRows
    ? `<h3>Paid on Sales</h3><table>${saleChargeRows}${tr("Subtotal", money(
        ex.saleCharges.loading + ex.saleCharges.transport + ex.saleCharges.labour
      ), true)}</table>`
    : ""
}
${
  ex.expensesApplied
    ? `<h3>Other Expenses</h3><table>${expRows}${tr("Total", money(ex.expenses), true)}</table>`
    : ""
}
${!purChargeRows && !saleChargeRows && !ex.expensesApplied ? `<p class="note">No expenses recorded in this period.</p>` : ""}
<h2>Stock Count</h2>
<table>
<tr><th>Product</th><th>Stock in Records</th><th>Counted in Yard</th><th>Difference</th></tr>
${checkRows}
</table>
</body></html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  w.print();
}
