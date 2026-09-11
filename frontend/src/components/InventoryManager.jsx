import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import BarcodeImage from './BarcodeImage';
import { formatMoney } from '../utils/format';

// مكوّن عام لإدارة صنف مخزني - يُستخدم من صفحتي "الصيدلية" (أدوية فقط) و"المخازن" (مستلزمات/معدات)
// كل صفحة تمرّر الفئات المسموحة لها فقط، فيبقى المخزون قاعدة بيانات واحدة لكنه معروض ومُدار بشكل منفصل
export default function InventoryManager({ pageTitleKey, allowedCategories, defaultCategory }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canManage = ['admin', 'pharmacy'].includes(user?.role);
  const canEditPrice = ['admin', 'billing'].includes(user?.role);

  const emptyForm = {
    name: '',
    category: defaultCategory,
    unit: 'قطعة',
    quantity: 0,
    min_stock: 0,
    unit_price: 0,
    expiry_date: '',
    notes: '',
    barcode: '',
  };

  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeCategory, setActiveCategory] = useState('all');
  const [editingPriceId, setEditingPriceId] = useState(null);
  const [priceDraft, setPriceDraft] = useState('');

  const [scanCode, setScanCode] = useState('');
  const [scanQty, setScanQty] = useState(1);
  const [scanDirection, setScanDirection] = useState('in');
  const [scanResult, setScanResult] = useState(null);
  const scanInputRef = useRef(null);

  async function loadItems() {
    const { data } = await api.get('/inventory');
    setItems(data.filter((i) => allowedCategories.includes(i.category)));
  }

  useEffect(() => { loadItems(); }, []);

  useEffect(() => {
    if (canManage) scanInputRef.current?.focus();
  }, [canManage]);

  async function handleAdd(e) {
    e.preventDefault();
    await api.post('/inventory', form);
    setForm(emptyForm);
    setShowForm(false);
    loadItems();
  }

  async function adjustStock(item, delta) {
    await api.post(`/inventory/${item.id}/adjust`, { delta });
    loadItems();
  }

  async function removeItem(id) {
    await api.delete(`/inventory/${id}`);
    loadItems();
  }

  async function regenerateBarcode(item) {
    await api.post(`/inventory/${item.id}/barcode`);
    loadItems();
  }

  function startEditPrice(item) {
    setEditingPriceId(item.id);
    setPriceDraft(String(item.unit_price));
  }

  async function savePrice(item) {
    await api.put(`/inventory/${item.id}/price`, { unit_price: Number(priceDraft) });
    setEditingPriceId(null);
    loadItems();
  }

  // معالجة مسح الباركود: يُستدعى عند ضغط Enter (قارئ الباركود يُرسل Enter تلقائيًا بعد القراءة)
  async function handleScanSubmit(e) {
    e.preventDefault();
    if (!scanCode.trim()) return;
    const delta = scanDirection === 'in' ? Math.abs(Number(scanQty)) : -Math.abs(Number(scanQty));
    try {
      const { data } = await api.post('/inventory/scan-adjust', { barcode: scanCode.trim(), delta });
      if (!allowedCategories.includes(data.category)) {
        setScanResult({ type: 'error', text: t('scan_wrong_section') });
      } else {
        setScanResult({ type: 'success', message: `${data.name}: ${t('new_quantity')} ${data.quantity} ${data.unit}` });
      }
      loadItems();
    } catch (err) {
      setScanResult({ type: 'error', message: err.response?.data?.message || t('scan_error') });
    }
    setScanCode('');
    scanInputRef.current?.focus();
  }

  function printLabel(item) {
    const win = window.open('', '_blank', 'width=380,height=260');
    if (!win) return;
    win.document.write(`
      <html dir="rtl">
        <head><title>${item.name}</title></head>
        <body style="font-family: Tahoma, Arial, sans-serif; text-align:center; padding:16px;">
          <div style="font-size:14px; font-weight:bold; margin-bottom:8px;">${item.name}</div>
          <svg id="barcode"></svg>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <script>
            JsBarcode("#barcode", "${item.barcode || ''}", { format: "CODE128", height: 50, fontSize: 14 });
            window.print();
          </script>
        </body>
      </html>
    `);
    win.document.close();
  }

  const filtered = activeCategory === 'all' ? items : items.filter((i) => i.category === activeCategory);
  const lowStockCount = items.filter((i) => i.quantity <= i.min_stock).length;
  const noBarcodeCount = items.filter((i) => !i.barcode).length;
  const totalValue = items.reduce((sum, i) => sum + Number(i.quantity) * Number(i.unit_price), 0);

  function stockBadge(item) {
    if (item.quantity <= 0) return <span className="badge out-of-stock">{t('out_of_stock')}</span>;
    if (item.quantity <= item.min_stock) return <span className="badge low-stock">{t('low_stock')}</span>;
    return <span className="badge active">{t('in_stock')}</span>;
  }

  return (
    <div>
      <div className="topbar">
        <h2>{t(pageTitleKey)}</h2>
        {canManage && <button onClick={() => setShowForm(!showForm)}>+ {t('add_item')}</button>}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">{t('total_items')}</div>
          <div className="stat-value">{items.length}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('low_stock_alert')}</div>
          <div className="stat-value">{lowStockCount}</div>
        </div>
        <div className="stat-card warn">
          <div className="stat-label">{t('no_barcode_alert')}</div>
          <div className="stat-value">{noBarcodeCount}</div>
        </div>
        {canEditPrice && (
          <div className="stat-card">
            <div className="stat-label">{t('total_inventory_value')}</div>
            <div className="stat-value">{formatMoney(totalValue)}</div>
          </div>
        )}
      </div>

      {canManage && (
        <form className="card" onSubmit={handleScanSubmit}>
          <div className="section-title">📷 {t('quick_scan')}</div>
          <div className="grid-3">
            <div>
              <label>{t('scan_or_enter_barcode')}</label>
              <input
                ref={scanInputRef}
                autoFocus
                value={scanCode}
                onChange={(e) => setScanCode(e.target.value)}
                placeholder={t('scan_placeholder')}
              />
            </div>
            <div>
              <label>{t('quantity')}</label>
              <input type="number" min="1" value={scanQty} onChange={(e) => setScanQty(e.target.value)} />
            </div>
            <div>
              <label>{t('operation')}</label>
              <select value={scanDirection} onChange={(e) => setScanDirection(e.target.value)}>
                <option value="in">{t('stock_in')}</option>
                <option value="out">{t('stock_out')}</option>
              </select>
            </div>
          </div>
          <button type="submit">{scanDirection === 'in' ? t('stock_in') : t('stock_out')}</button>
          {scanResult && (
            <div className={scanResult.type === 'error' ? 'error-text' : ''} style={{ marginTop: 10, color: scanResult.type === 'success' ? 'var(--success-text)' : undefined, fontWeight: 600 }}>
              {scanResult.message || scanResult.text}
            </div>
          )}
        </form>
      )}

      {showForm && canManage && (
        <form className="card" onSubmit={handleAdd}>
          <div className="grid-3">
            <div>
              <label>{t('item_name')}</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label>{t('category')}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {allowedCategories.map((c) => <option key={c} value={c}>{t(c)}</option>)}
              </select>
            </div>
            <div>
              <label>{t('unit')}</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <label>{t('quantity')}</label>
              <input required type="number" min="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label>{t('min_stock')}</label>
              <input type="number" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} />
            </div>
            <div>
              <label>{t('unit_price')}</label>
              <input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} />
            </div>
            <div>
              <label>{t('expiry_date')}</label>
              <input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} />
            </div>
            <div>
              <label>{t('barcode')} <span className="muted">({t('barcode_optional')})</span></label>
              <input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} placeholder={t('barcode_auto')} />
            </div>
          </div>
          <div>
            <label>{t('notes')}</label>
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <button type="submit">{t('save')}</button>
        </form>
      )}

      {allowedCategories.length > 1 && (
        <div className="tag-list" style={{ marginBottom: 16 }}>
          {['all', ...allowedCategories].map((c) => (
            <button
              key={c}
              className={activeCategory === c ? '' : 'secondary'}
              onClick={() => setActiveCategory(c)}
              type="button"
            >
              {c === 'all' ? t('all_categories') : t(c)}
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{t('item_name')}</th>
              <th>{t('barcode')}</th>
              {allowedCategories.length > 1 && <th>{t('category')}</th>}
              <th>{t('quantity')}</th>
              <th>{t('unit_price')}</th>
              <th>{t('expiry_date')}</th>
              <th>{t('status')}</th>
              {(canManage || canEditPrice) && <th></th>}
            </tr>
          </thead>
          <tbody>
            {filtered.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>
                  {item.barcode ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <BarcodeImage value={item.barcode} height={24} fontSize={10} />
                      {canManage && (
                        <button type="button" className="secondary" onClick={() => printLabel(item)}>{t('print')}</button>
                      )}
                    </div>
                  ) : (
                    <span className="muted">
                      {t('no_barcode')}
                      {canManage && (
                        <button type="button" className="secondary" style={{ marginInlineStart: 8 }} onClick={() => regenerateBarcode(item)}>
                          {t('generate_barcode')}
                        </button>
                      )}
                    </span>
                  )}
                </td>
                {allowedCategories.length > 1 && <td>{t(item.category)}</td>}
                <td>{item.quantity} {item.unit}</td>
                <td>
                  {canEditPrice && editingPriceId === item.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        style={{ width: 90, marginBottom: 0 }}
                      />
                      <button onClick={() => savePrice(item)}>{t('save')}</button>
                      <button className="secondary" onClick={() => setEditingPriceId(null)}>{t('cancel')}</button>
                    </div>
                  ) : (
                    <span
                      onClick={() => canEditPrice && startEditPrice(item)}
                      style={canEditPrice ? { cursor: 'pointer', borderBottom: '1px dashed var(--primary)' } : undefined}
                      title={canEditPrice ? t('edit_price') : undefined}
                    >
                      {formatMoney(item.unit_price)}
                    </span>
                  )}
                </td>
                <td>{item.expiry_date || '-'}</td>
                <td>{stockBadge(item)}</td>
                {(canManage || canEditPrice) && (
                  <td style={{ display: 'flex', gap: 6 }}>
                    {canManage && (
                      <>
                        <button className="secondary" onClick={() => adjustStock(item, 1)}>+1</button>
                        <button className="secondary" onClick={() => adjustStock(item, -1)}>-1</button>
                        <button className="danger" onClick={() => removeItem(item.id)}>{t('delete')}</button>
                      </>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="muted">{t('no_data')}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
