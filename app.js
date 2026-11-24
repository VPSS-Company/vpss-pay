/* VPSS Pay Sandbox — all payment outcomes are simulated. No real payment data is processed. */
(() => {
  // Optional: Add your Supabase Project URL and Anon Key for cross-device QR sync
  const SUPABASE_URL = '';
  const SUPABASE_ANON_KEY = '';

  const sb = (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const KEY = 'vpss_pay_sandbox_v2';
  const params = new URLSearchParams(location.search);
  const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{"orders":[],"transactions":[]}') } catch { return { orders: [], transactions: [] } } };
  const writeLocal = data => { localStorage.setItem(KEY, JSON.stringify(data)); window.dispatchEvent(new Event('vpss-updated')) };
  const id = () => 'VP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2300);
  }

  function detectCardBrand(digits) {
    if (/^4/.test(digits)) return 'Visa';
    if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
    if (/^(60|65|81|82|508)/.test(digits)) return 'RuPay';
    if (/^3[47]/.test(digits)) return 'Amex';
    if (/^6(?:011|5)/.test(digits)) return 'Discover';
    return 'Card';
  }

  async function saveOrder(order) {
    const local = readLocal();
    local.orders.unshift(order);
    writeLocal(local);

    if (sb) {
      await sb.from('sandbox_orders').insert({
        id: order.id,
        description: order.description,
        amount: order.amount,
        status: order.status,
        created_at: order.createdAt
      });
    }
  }

  async function findOrder() {
    const orderId = params.get('order');
    if (!orderId) return null;

    if (sb) {
      const { data } = await sb.from('sandbox_orders').select('*').eq('id', orderId).maybeSingle();
      if (data) return { id: data.id, description: data.description, amount: data.amount, status: data.status };
    }
    return readLocal().orders.find(o => o.id === orderId) || null;
  }

  async function addTransaction(order, customer, method, status, contact = '') {
    const tx = {
      id: id(),
      orderId: order.id,
      description: order.description,
      amount: order.amount,
      customer,
      contact,
      method,
      status,
      time: new Date().toISOString()
    };

    const local = readLocal();
    local.transactions.unshift(tx);
    writeLocal(local);

    if (sb) {
      await sb.from('sandbox_transactions').insert({
        id: tx.id,
        order_id: tx.orderId,
        description: tx.description,
        amount: tx.amount,
        customer: tx.customer,
        contact: tx.contact,
        method: tx.method,
        status: tx.status,
        time: tx.time
      });
    }
    return tx;
  }

  async function getAllTransactions() {
    if (sb) {
      const { data, error } = await sb.from('sandbox_transactions').select('*').order('time', { ascending: false });
      if (!error && data) {
        return data.map(r => ({
          id: r.id,
          orderId: r.order_id,
          description: r.description,
          amount: r.amount,
          customer: r.customer,
          contact: r.contact || '',
          method: r.method,
          status: r.status,
          time: r.time
        }));
      }
    }
    return readLocal().transactions;
  }

  async function clearTransactionsOnly() {
    const local = readLocal();
    local.transactions = [];
    writeLocal(local);
    if (sb) {
      await sb.from('sandbox_transactions').delete().neq('id', '');
    }
  }

  async function resetAllSandboxData() {
    localStorage.removeItem(KEY);
    window.dispatchEvent(new Event('vpss-updated'));
    if (sb) {
      await sb.from('sandbox_transactions').delete().neq('id', '');
      await sb.from('sandbox_orders').delete().neq('id', '');
    }
  }

  async function initDashboard() {
    const panel = document.getElementById('createPanel'), form = document.getElementById('linkForm');
    if (sb) {
      const syncStatus = document.getElementById('syncStatusText');
      if (syncStatus) syncStatus.textContent = 'Supabase Realtime active';
    }

    document.getElementById('newLinkBtn').onclick = () => { panel.hidden = false; panel.scrollIntoView({ behavior: 'smooth' }) };
    document.getElementById('closeCreate').onclick = () => panel.hidden = true;

    form.onsubmit = async e => {
      e.preventDefault();
      const amount = Number(document.getElementById('amount').value);
      const description = document.getElementById('description').value.trim();
      if (!description || !Number.isFinite(amount) || amount <= 0) return;

      const order = { id: id(), description, amount, status: 'created', createdAt: new Date().toISOString() };
      await saveOrder(order);

      const url = new URL('checkout.html', location.href);
      url.searchParams.set('order', order.id);

      document.getElementById('createdLink').hidden = false;
      document.getElementById('createdLink').innerHTML = `<b>Test payment link created</b><br><a href="${url.href}" target="_blank" rel="noopener">${escapeHtml(url.href)}</a> <button class="secondary small" id="copyLink">Copy link</button>`;
      document.getElementById('copyLink').onclick = () => navigator.clipboard?.writeText(url.href).then(() => toast('Link copied')).catch(() => toast('Copy unavailable'));
      form.reset();
      await render();
      toast('Sandbox link created');
    };

    document.querySelectorAll('[data-status]').forEach(btn => btn.onclick = async () => {
      const order = { id: id(), description: 'Developer test event', amount: 199, status: 'created', createdAt: new Date().toISOString() };
      await saveOrder(order);
      await addTransaction(order, 'Sandbox Tester', 'Developer tool', btn.dataset.status);
      await render();
      toast('Test event added');
    });

    document.getElementById('exportBtn').onclick = async () => {
      const rows = await getAllTransactions();
      const csv = [
        ['Transaction', 'Order', 'Customer', 'Contact', 'Method', 'Amount', 'Status', 'Time'],
        ...rows.map(t => [t.id, t.orderId, t.customer, t.contact || '', t.method, t.amount, t.status, t.time])
      ].map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'vpss-pay-test-transactions.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    };

    document.getElementById('clearTxBtn').onclick = async () => {
      if (!confirm('Clear transaction history? Existing payment links will remain active.')) return;
      await clearTransactionsOnly();
      await render();
      toast('Transaction history cleared');
    };

    document.getElementById('resetAllBtn').onclick = async () => {
      if (!confirm('Reset ALL test orders and transactions? Existing payment links will stop working.')) return;
      await resetAllSandboxData();
      document.getElementById('createdLink').hidden = true;
      await render();
      toast('All test data reset');
    };

    async function render() {
      const tx = await getAllTransactions();
      document.getElementById('totalCount').textContent = tx.length;
      document.getElementById('successCount').textContent = tx.filter(t => t.status === 'success').length;
      document.getElementById('totalAmount').textContent = money(tx.filter(t => t.status === 'success').reduce((s, t) => s + Number(t.amount), 0));

      const body = document.getElementById('transactions');
      body.innerHTML = tx.length ? tx.map(t => {
        const contactHtml = t.contact ? `<br><small class="muted">${escapeHtml(t.contact)}</small>` : '';
        return `<tr>
          <td><b>${escapeHtml(t.orderId)}</b></td>
          <td>${escapeHtml(t.customer)}${contactHtml}</td>
          <td>${escapeHtml(t.method)}</td>
          <td>${money(t.amount)}</td>
          <td><span class="status ${escapeHtml(t.status)}">${escapeHtml(t.status)}</span></td>
          <td>${new Date(t.time).toLocaleString()}</td>
        </tr>`;
      }).join('') : '<tr><td colspan="6" class="empty">No test transactions yet. Create a link to get started.</td></tr>';
    }

    if (sb) {
      sb.channel('tx-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sandbox_transactions' }, () => render())
        .subscribe();
    }

    window.addEventListener('storage', render);
    window.addEventListener('vpss-updated', render);
    setInterval(render, 3000);
    await render();
  }

  async function initCheckout() {
    const order = await findOrder();
    const desc = document.getElementById('orderDescription');
    if (!desc) return;

    if (!order) {
      document.querySelector('.checkout-card').innerHTML = '<h2>Payment link not found</h2><p class="muted">This test link may be invalid or has been reset. Create a new link from the dashboard.</p>';
      return;
    }

    desc.textContent = order.description;
    document.getElementById('orderAmount').textContent = money(order.amount);
    document.getElementById('orderId').textContent = 'Order ID: ' + order.id;

    const url = new URL('upi-demo.html', location.href);
    url.searchParams.set('order', order.id);

    const qr = document.getElementById('qrcode'), fallback = document.getElementById('qrFallback');
    if (window.QRCode) {
      new QRCode(qr, { text: url.href, width: 168, height: 168, colorDark: '#172033', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      fallback.hidden = true;
    }

    const methods = document.querySelectorAll('.method');
    methods.forEach(b => b.onclick = () => {
      methods.forEach(x => x.classList.toggle('active', x === b));
      ['upi', 'card', 'netbanking'].forEach(m => document.getElementById(m + 'Pane').hidden = m !== b.dataset.method);
    });

    document.getElementById('upiContinue').onclick = () => location.href = url.href;
    document.querySelectorAll('.bank-option').forEach(b => b.onclick = () => {
      const u = new URL('bank-demo.html', location.href);
      u.searchParams.set('order', order.id);
      u.searchParams.set('bank', b.dataset.bank);
      location.href = u.href;
    });

    document.getElementById('cardForm').onsubmit = async e => {
      e.preventDefault();
      const inputs = e.currentTarget.querySelectorAll('input');
      const cardholder = inputs[0].value.trim() || 'Test Customer';
      const digits = inputs[1].value.replace(/\D/g, '');
      const expiry = inputs[2].value.trim();
      const cvv = inputs[3].value.replace(/\D/g, '');

      if (digits.length < 12 || digits.length > 19 || !expiry || cvv.length < 3) {
        showResult('Please enter a valid test card number (12–19 digits), expiry, and CVV.', true);
        return;
      }

      const brand = detectCardBrand(digits);
      const last4 = digits.slice(-4);
      const t = await addTransaction(order, cardholder, `${brand} •••• ${last4}`, 'success');
      showResult(`Test payment successful. Transaction ${t.id} recorded for ${cardholder} (${brand} ending ${last4}).`);
      e.currentTarget.reset();
    };
  }

  function showResult(message, error = false) {
    const el = document.getElementById('checkoutMessage');
    if (!el) return;
    el.hidden = false;
    el.className = 'result' + (error ? ' error' : '');
    el.textContent = message;
  }

  async function initBank() {
    const form = document.getElementById('bankForm');
    if (!form) return;
    const order = await findOrder();
    if (!order) {
      form.hidden = true;
      document.getElementById('bankMessage').hidden = false;
      document.getElementById('bankMessage').textContent = 'Order not found. Please reopen the test link from the dashboard.';
      return;
    }

    const bankName = params.get('bank') || 'Demo Bank';
    document.getElementById('bankDescription').textContent = order.description;
    document.getElementById('bankAmount').textContent = money(order.amount);
    document.getElementById('bankPayAmount').textContent = money(order.amount);
    document.getElementById('bankOrderId').textContent = 'Order ID: ' + order.id + ' · ' + bankName;
    document.getElementById('backToCheckout').href = 'checkout.html?order=' + encodeURIComponent(order.id);

    form.onsubmit = async e => {
      e.preventDefault();
      const name = document.getElementById('bankName').value.trim();
      const email = document.getElementById('bankEmail').value.trim();
      const mobile = document.getElementById('bankMobile').value.trim();
      const contactSummary = `${email} · ${mobile}`;

      const t = await addTransaction(order, name, `Netbanking (${bankName})`, 'success', contactSummary);
      form.hidden = true;
      const box = document.getElementById('bankMessage');
      box.hidden = false;
      box.innerHTML = `<b>Test payment successful</b><br>Reference: ${escapeHtml(t.id)}<br>Customer: ${escapeHtml(name)} (${escapeHtml(contactSummary)})<br>Amount: ${money(order.amount)}<br><br>This is a simulated result only. No bank or payment network was contacted and no money was transferred.`;
    };
  }

  async function initUpi() {
    const order = await findOrder();
    if (!order) {
      document.getElementById('upiTitle').textContent = 'Test order not found';
      document.getElementById('approveUpi').disabled = true;
      return;
    }
    document.getElementById('upiDesc').textContent = order.description;
    document.getElementById('upiAmount').textContent = money(order.amount);
    document.getElementById('upiOrder').textContent = 'Order ID: ' + order.id;

    document.getElementById('approveUpi').onclick = async () => {
      const btn = document.getElementById('approveUpi');
      btn.disabled = true;
      btn.textContent = 'Recording approval...';
      const t = await addTransaction(order, 'UPI Mobile Customer', 'UPI QR (simulated)', 'success');
      document.getElementById('upiResult').hidden = false;
      document.getElementById('upiResult').innerHTML = `<b>UPI test payment approved</b><br>Reference: ${escapeHtml(t.id)}<br>${money(order.amount)} recorded and synced to dashboard.`;
      btn.textContent = 'Test payment recorded';
    };
  }

  if (document.getElementById('transactions')) initDashboard();
  if (document.getElementById('orderDescription')) initCheckout();
  if (document.getElementById('bankForm')) initBank();
  if (document.getElementById('approveUpi')) initUpi();
})();