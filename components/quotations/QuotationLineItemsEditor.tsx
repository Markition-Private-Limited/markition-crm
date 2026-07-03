"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calculateLineItemTotal, emptyQuotationLineItem, formatCurrency, type QuotationLineItemDraft } from "@/src/modules/quotations/quotation-types";
import { Copy, Plus, Trash2 } from "lucide-react";

interface QuotationLineItemsEditorProps {
  items: QuotationLineItemDraft[];
  currency: string;
  onChange: (items: QuotationLineItemDraft[]) => void;
}

function updateRow(items: QuotationLineItemDraft[], index: number, patch: Partial<QuotationLineItemDraft>) {
  return items.map((item, currentIndex) => (currentIndex === index ? { ...item, ...patch } : item));
}

export function QuotationLineItemsEditor({ items, currency, onChange }: QuotationLineItemsEditorProps) {
  const addRow = () => onChange([...items, emptyQuotationLineItem()]);
  const duplicateRow = (index: number) => onChange([...items.slice(0, index + 1), { ...items[index] }, ...items.slice(index + 1)]);
  const removeRow = (index: number) => onChange(items.length === 1 ? [emptyQuotationLineItem()] : items.filter((_, currentIndex) => currentIndex !== index));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Products & Services</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300">Build the quote line by line. Duplicate a row when you need a repeated service pattern.</p>
        </div>
        <Button type="button" variant="secondary" onClick={addRow}>
          <Plus className="h-4 w-4" />
          Add row
        </Button>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => {
          const rowTotal = calculateLineItemTotal(item);

          return (
            <div key={`${item.item_name || "row"}-${index}`} className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/80">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Row {index + 1}</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300">Total</span>
                  <span className="text-base font-semibold text-slate-950 dark:text-slate-50">{formatCurrency(rowTotal, currency)}</span>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-12">
                <div className="lg:col-span-4">
                  <Input
                    label="Service / product"
                    value={item.item_name}
                    onChange={(event) => onChange(updateRow(items, index, { item_name: event.target.value }))}
                    placeholder="Retainer package"
                    required
                  />
                </div>
                <div className="lg:col-span-8">
                  <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
                    <span>Description</span>
                    <textarea
                      value={item.description}
                      onChange={(event) => onChange(updateRow(items, index, { description: event.target.value }))}
                      rows={2}
                      className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-400 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      placeholder="Scope, deliverables, and delivery notes"
                    />
                  </label>
                </div>
                <div className="lg:col-span-2">
                  <Input
                    label="Qty"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.quantity}
                    onChange={(event) => onChange(updateRow(items, index, { quantity: event.target.value }))}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Input
                    label="Unit price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(event) => onChange(updateRow(items, index, { unit_price: event.target.value }))}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Input
                    label="Discount %"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.discount}
                    onChange={(event) => onChange(updateRow(items, index, { discount: event.target.value }))}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Input
                    label="Tax %"
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.tax}
                    onChange={(event) => onChange(updateRow(items, index, { tax: event.target.value }))}
                  />
                </div>
              </div>

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => duplicateRow(index)}>
                  <Copy className="h-4 w-4" />
                  Duplicate row
                </Button>
                <Button type="button" variant="ghost" className="text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950" onClick={() => removeRow(index)}>
                  <Trash2 className="h-4 w-4" />
                  Remove row
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
