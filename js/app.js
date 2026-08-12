/* ==========================================
   Monthly Budget & Investment Dashboard
   Core application logic (BudgetApp class)

   Data sources — both 100% user-entered, nothing hardcoded:
     - this.config.salaries      -> Config & Salary tab
     - this.transactions         -> Transactions Log tab

   Every dashboard number, table, and chart is DERIVED from those
   two arrays at render time (SUMIFS/QUERY-equivalent aggregation
   in JS). Nothing below is a static/sample figure.
   ========================================== */

class BudgetApp {
    // uid: the signed-in Firebase user's ID. All data is stored/read under
    // this uid in Firestore, so each account only ever sees its own data.
    constructor(uid) {
        this.uid = uid;
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        this.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));

        // Active Month: default to the current real-world month
        const now = new Date();
        const curMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        this.activeMonth = curMonthStr;

        this.chartInstances = {};
    }

    // Loads this user's saved config + transactions from Firestore.
    // Must be awaited before calling init(). If the user has no data yet
    // (first login), this.config/this.transactions stay at their defaults.
    async loadData() {
        try {
            const doc = await db.collection('budgets').doc(this.uid).get();
            if (doc.exists) {
                const data = doc.data();
                this.config = data.config || JSON.parse(JSON.stringify(DEFAULT_CONFIG));
                this.transactions = data.transactions || JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
            }
        } catch (err) {
            console.error('Failed to load data from Firestore:', err);
            alert('Could not load your saved data. Check your internet connection and try reloading the page.');
        }
    }

    init() {
        document.getElementById('globalMonthPicker').value = this.activeMonth;

        this.renderConfig();
        this.renderTransactions();
        this.renderDashboard();
        this.renderSummary();
        this.renderYearlyDashboard();
        this.initCharts();
        this.renderCharts();
    }

    saveData() {
        // Cloud save — scoped to this.uid, so it's private to the signed-in user.
        db.collection('budgets').doc(this.uid).set({
            config: this.config,
            transactions: this.transactions,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(err => {
            console.error('Failed to save data to Firestore:', err);
            alert('Could not save your data — check your internet connection and try again.');
        });
    }

    // Destructive reset — wipes ALL user-entered data back to a blank
    // slate (empty salaries, empty transactions, zeroed thresholds).
    // Requires confirmation since, unlike a "demo reset", this deletes
    // real user data with nothing to restore.
    clearAllData() {
        const ok = confirm('This will permanently delete all salary entries and transactions you have logged. This cannot be undone. Continue?');
        if (!ok) return;
        this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        this.transactions = JSON.parse(JSON.stringify(INITIAL_TRANSACTIONS));
        this.saveData();
        this.init();
    }

    formatINR(amount) {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    handleMonthChange(newMonth) {
        if (!newMonth) return;
        this.activeMonth = newMonth;
        this.renderDashboard();
        this.renderCharts();
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-pane').forEach(el => el.classList.add('hidden'));
        document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

        document.getElementById(`tab-content-${tabName}`).classList.remove('hidden');
        document.getElementById(`tab-btn-${tabName}`).classList.add('active');

        if (tabName === 'charts') {
            this.renderCharts();
        } else if (tabName === 'yearly') {
            this.renderYearlyDashboard();
        } else if (tabName === 'summary') {
            this.renderSummary();
        }
    }

    // ==========================================
    // TAB 1: CONFIG LOGIC
    // ==========================================
    renderConfig() {
        const salaryBody = document.getElementById('salaryHistoryBody');
        salaryBody.innerHTML = '';

        this.config.salaries.sort((a, b) => b.month.localeCompare(a.month));

        if (this.config.salaries.length === 0) {
            salaryBody.innerHTML = `<tr><td colspan="3" class="p-3 text-center text-slate-400 font-sans">No salary entries yet. Click "+ Add Month" to enter your first salary.</td></tr>`;
        }

        this.config.salaries.forEach((item, index) => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="px-3 py-2">
                    <input type="month" value="${item.month}" onchange="app.updateSalaryMonth(${index}, this.value)" class="bg-transparent font-medium text-xs focus:outline-none">
                </td>
                <td class="px-3 py-2 text-right">
                    <input type="number" value="${item.salary}" onchange="app.updateSalaryVal(${index}, this.value)" class="w-28 text-right bg-transparent font-mono text-xs focus:outline-none border-b border-dashed border-slate-300 focus:border-excel-600">
                </td>
                <td class="px-2 py-2 text-center">
                    <button onclick="app.removeSalaryRow(${index})" class="text-slate-400 hover:text-rose-600"><i class="fa-solid fa-trash-can text-xs"></i></button>
                </td>
            `;
            salaryBody.appendChild(tr);
        });

        // Render Category Thresholds
        ['Responsible', 'Bonus', 'Investment'].forEach(group => {
            const container = document.getElementById(`config-list-${group}`);
            container.innerHTML = '';

            this.config.categories[group].forEach((cat, idx) => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between py-1 border-b border-slate-100';
                div.innerHTML = `
                    <span class="font-medium text-slate-700">${cat.name}</span>
                    ${group !== 'Investment' ? `
                        <div class="flex items-center space-x-1">
                            <span class="text-[10px] text-slate-400">Max ₹</span>
                            <input type="number" value="${cat.threshold}" onchange="app.updateThreshold('${group}', ${idx}, this.value)" class="w-16 text-right font-mono text-xs border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:border-excel-600">
                        </div>
                    ` : `<span class="text-[10px] text-slate-400 font-mono">Savings</span>`}
                `;
                container.appendChild(div);
            });
        });
    }

    addSalaryRow() {
        const todayMonth = new Date().toISOString().substring(0, 7);
        // No arbitrary starting salary — user fills in their real figure.
        this.config.salaries.unshift({ month: todayMonth, salary: 0 });
        this.saveData();
        this.renderConfig();
        this.renderDashboard();
    }

    removeSalaryRow(index) {
        this.config.salaries.splice(index, 1);
        this.saveData();
        this.renderConfig();
        this.renderDashboard();
    }

    updateSalaryMonth(index, val) {
        if (!val) return;
        this.config.salaries[index].month = val;
        this.saveData();
        this.renderDashboard();
    }

    updateSalaryVal(index, val) {
        this.config.salaries[index].salary = parseFloat(val) || 0;
        this.saveData();
        this.renderDashboard();
    }

    updateThreshold(group, idx, val) {
        this.config.categories[group][idx].threshold = parseFloat(val) || 0;
        this.saveData();
        this.renderDashboard();
    }

    getSalaryForMonth(monthStr) {
        const found = this.config.salaries.find(s => s.month === monthStr);
        if (found) return found.salary;
        // No entry for this month and nothing configured yet -> 0.
        // (No fallback to a fabricated default salary.)
        return 0;
    }

    // ==========================================
    // TAB 2: TRANSACTIONS LOGIC
    // ==========================================
    renderTransactions() {
        const tbody = document.getElementById('transactionsTableBody');
        tbody.innerHTML = '';

        const search = document.getElementById('txnSearchInput').value.toLowerCase();
        const typeFilter = document.getElementById('txnTypeFilter').value;

        let filtered = this.transactions.filter(t => {
            const matchSearch = t.notes.toLowerCase().includes(search) || t.category.toLowerCase().includes(search);
            const matchType = (typeFilter === 'ALL') || (t.type === typeFilter);
            return matchSearch && matchType;
        });

        filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

        document.getElementById('txnCounterText').innerText = `Showing ${filtered.length} of ${this.transactions.length} entries`;

        if (this.transactions.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400 font-sans">No transactions logged yet. Click "Log Transaction" above to add your first entry.</td></tr>`;
            return;
        }

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400 font-sans">No transactions match your search/filter.</td></tr>`;
            return;
        }

        filtered.forEach((txn, index) => {
            const tr = document.createElement('tr');

            const isHighAmount = txn.amount > 5000;
            tr.className = isHighAmount
                ? 'bg-rose-50/60 hover:bg-rose-100/60 transition-colors'
                : 'hover:bg-slate-50 transition-colors';

            tr.innerHTML = `
                <td class="p-2.5 text-center text-slate-400 text-[11px] font-sans">${index + 1}</td>
                <td class="p-2.5 text-slate-800 font-medium">${txn.date}</td>
                <td class="p-2.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${
                        txn.type === 'Responsible' ? 'bg-blue-100 text-blue-800' :
                        txn.type === 'Bonus' ? 'bg-amber-100 text-amber-800' :
                        'bg-emerald-100 text-emerald-800'
                    }">${txn.type}</span>
                </td>
                <td class="p-2.5 text-slate-700">${txn.category}</td>
                <td class="p-2.5 text-right font-bold ${isHighAmount ? 'text-rose-700' : 'text-slate-800'}">
                    ${this.formatINR(txn.amount)}
                </td>
                <td class="p-2.5 text-slate-500 max-w-xs truncate">${txn.notes || '-'}</td>
                <td class="p-2.5 text-center space-x-1 font-sans">
                    <button onclick="app.editTransaction('${txn.id}')" class="text-slate-400 hover:text-blue-600 p-1" title="Edit"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button onclick="app.deleteTransaction('${txn.id}')" class="text-slate-400 hover:text-rose-600 p-1" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    openTransactionModal(editId = null) {
        const modal = document.getElementById('txnModal');
        const form = document.getElementById('txnForm');
        form.reset();

        if (editId) {
            const txn = this.transactions.find(t => t.id === editId);
            if (txn) {
                document.getElementById('editTxnId').value = txn.id;
                document.getElementById('inputTxnDate').value = txn.date;
                document.getElementById('inputTxnType').value = txn.type;
                this.handleTypeDropdownChange(txn.category);
                document.getElementById('inputTxnAmount').value = txn.amount;
                document.getElementById('inputTxnNotes').value = txn.notes;
                document.getElementById('txnModalTitle').innerText = 'Edit Transaction';
            }
        } else {
            document.getElementById('editTxnId').value = '';
            document.getElementById('inputTxnDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('inputTxnType').value = 'Responsible';
            this.handleTypeDropdownChange();
            document.getElementById('txnModalTitle').innerText = 'Log Daily Transaction';
        }

        modal.classList.remove('hidden');
    }

    closeTransactionModal() {
        document.getElementById('txnModal').classList.add('hidden');
    }

    handleTypeDropdownChange(selectedCategory = null) {
        const type = document.getElementById('inputTxnType').value;
        const catSelect = document.getElementById('inputTxnCategory');
        catSelect.innerHTML = '';

        const categories = this.config.categories[type] || [];
        categories.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.innerText = c.name;
            if (selectedCategory && selectedCategory === c.name) {
                opt.selected = true;
            }
            catSelect.appendChild(opt);
        });
    }

    saveTransaction(e) {
        e.preventDefault();
        const id = document.getElementById('editTxnId').value;
        const date = document.getElementById('inputTxnDate').value;
        const type = document.getElementById('inputTxnType').value;
        const category = document.getElementById('inputTxnCategory').value;
        const amount = parseFloat(document.getElementById('inputTxnAmount').value) || 0;
        const notes = document.getElementById('inputTxnNotes').value;

        if (!date || !amount) return;

        if (id) {
            const idx = this.transactions.findIndex(t => t.id === id);
            if (idx !== -1) {
                this.transactions[idx] = { id, date, type, category, amount, notes };
            }
        } else {
            const newTxn = {
                id: Date.now().toString(),
                date,
                type,
                category,
                amount,
                notes
            };
            this.transactions.push(newTxn);
        }

        this.saveData();
        this.closeTransactionModal();
        this.renderTransactions();
        this.renderDashboard();
        this.renderSummary();
        this.renderYearlyDashboard();
        this.renderCharts();
    }

    editTransaction(id) {
        this.openTransactionModal(id);
    }

    deleteTransaction(id) {
        this.transactions = this.transactions.filter(t => t.id !== id);
        this.saveData();
        this.renderTransactions();
        this.renderDashboard();
        this.renderSummary();
        this.renderYearlyDashboard();
        this.renderCharts();
    }

    // ==========================================
    // TAB 3: DASHBOARD AUTO-CALCULATIONS
    // ==========================================
    renderDashboard() {
        const month = this.activeMonth;
        document.getElementById('dashMonthLabel').innerText = month;

        const salary = this.getSalaryForMonth(month);
        document.getElementById('kpiSalary').innerText = this.formatINR(salary);

        const alertBadge = document.getElementById('salaryAlertBadge');
        if (salary === 0) {
            alertBadge.innerHTML = `<span class="text-[11px] font-semibold px-2 py-1 rounded empty-state-banner">No salary set for ${month} — add it in Config & Salary</span>`;
        } else {
            alertBadge.innerHTML = '';
        }

        const monthTxns = this.transactions.filter(t => t.date.startsWith(month));

        let totalResp = 0;
        let totalBonus = 0;
        let totalInvest = 0;

        const catTotals = { Responsible: {}, Bonus: {}, Investment: {} };

        monthTxns.forEach(t => {
            if (t.type === 'Responsible') {
                totalResp += t.amount;
                catTotals.Responsible[t.category] = (catTotals.Responsible[t.category] || 0) + t.amount;
            } else if (t.type === 'Bonus') {
                totalBonus += t.amount;
                catTotals.Bonus[t.category] = (catTotals.Bonus[t.category] || 0) + t.amount;
            } else if (t.type === 'Investment') {
                totalInvest += t.amount;
                catTotals.Investment[t.category] = (catTotals.Investment[t.category] || 0) + t.amount;
            }
        });

        const totalSpent = totalResp + totalBonus;
        const remaining = salary - totalSpent - totalInvest;

        document.getElementById('kpiSpent').innerText = this.formatINR(totalSpent);
        document.getElementById('kpiSpentPct').innerText = `${((totalSpent / (salary || 1)) * 100).toFixed(1)}% of salary`;

        document.getElementById('kpiInvested').innerText = this.formatINR(totalInvest);
        document.getElementById('kpiInvestedPct').innerText = `${((totalInvest / (salary || 1)) * 100).toFixed(1)}% of salary`;

        document.getElementById('kpiBalance').innerText = this.formatINR(remaining);

        const remPct = (remaining / (salary || 1)) * 100;
        const balStatus = document.getElementById('kpiBalanceStatus');
        const balBar = document.getElementById('kpiBalanceBar');

        if (remaining < 0) {
            balStatus.innerText = 'Overdrawn (<0%)';
            balStatus.className = 'text-[11px] mt-1 font-bold text-rose-600';
            balBar.className = 'absolute bottom-0 left-0 right-0 h-1 bg-rose-600';
            document.getElementById('kpiBalance').className = 'mt-2 text-2xl font-bold font-mono text-rose-600';
        } else if (remPct < 5) {
            balStatus.innerText = 'Critical Warning (<5%)';
            balStatus.className = 'text-[11px] mt-1 font-bold text-rose-500';
            balBar.className = 'absolute bottom-0 left-0 right-0 h-1 bg-rose-500';
            document.getElementById('kpiBalance').className = 'mt-2 text-2xl font-bold font-mono text-rose-600';
        } else if (remPct <= 20) {
            balStatus.innerText = 'Moderate Alert (5%-20%)';
            balStatus.className = 'text-[11px] mt-1 font-bold text-amber-600';
            balBar.className = 'absolute bottom-0 left-0 right-0 h-1 bg-amber-500';
            document.getElementById('kpiBalance').className = 'mt-2 text-2xl font-bold font-mono text-amber-600';
        } else {
            balStatus.innerText = 'Healthy (>20%)';
            balStatus.className = 'text-[11px] mt-1 font-bold text-emerald-600';
            balBar.className = 'absolute bottom-0 left-0 right-0 h-1 bg-emerald-500';
            document.getElementById('kpiBalance').className = 'mt-2 text-2xl font-bold font-mono text-emerald-700';
        }

        document.getElementById('sumResponsibleHeader').innerText = this.formatINR(totalResp);
        document.getElementById('sumBonusHeader').innerText = this.formatINR(totalBonus);
        document.getElementById('sumInvestHeader').innerText = this.formatINR(totalInvest);

        this.renderDashboardTable('dashRespTable', 'Responsible', catTotals.Responsible, salary);
        this.renderDashboardTable('dashBonusTable', 'Bonus', catTotals.Bonus, salary);
        this.renderDashboardTable('dashInvestTable', 'Investment', catTotals.Investment, salary, false);

        this.renderDailyBurnRate(monthTxns, salary);
    }

    renderDashboardTable(elementId, groupType, catSpendMap, salary, checkThreshold = true) {
        const tbody = document.getElementById(elementId);
        tbody.innerHTML = '';

        const categories = this.config.categories[groupType] || [];

        categories.forEach(cat => {
            const mtdAmount = catSpendMap[cat.name] || 0;
            const pctOfSalary = salary > 0 ? ((mtdAmount / salary) * 100).toFixed(1) : '0.0';

            const tr = document.createElement('tr');

            let statusHtml = '';
            if (checkThreshold) {
                const threshold = cat.threshold || 0;
                const isExceeded = threshold > 0 && mtdAmount > threshold;
                if (isExceeded) {
                    tr.className = 'bg-rose-50/80 font-semibold';
                    statusHtml = `<span class="px-1.5 py-0.5 text-[9px] bg-rose-200 text-rose-800 rounded">Exceeded</span>`;
                } else if (threshold > 0 && mtdAmount > threshold * 0.8) {
                    tr.className = 'bg-amber-50/80';
                    statusHtml = `<span class="px-1.5 py-0.5 text-[9px] bg-amber-200 text-amber-800 rounded">Near Limit</span>`;
                } else if (threshold === 0) {
                    tr.className = 'hover:bg-slate-50';
                    statusHtml = `<span class="px-1.5 py-0.5 text-[9px] bg-slate-100 text-slate-400 rounded">No limit set</span>`;
                } else {
                    tr.className = 'hover:bg-slate-50';
                    statusHtml = `<span class="px-1.5 py-0.5 text-[9px] bg-slate-100 text-slate-500 rounded">OK</span>`;
                }
            } else {
                tr.className = 'hover:bg-slate-50';
            }

            tr.innerHTML = `
                <td class="p-2 text-slate-800 font-sans">${cat.name}</td>
                <td class="p-2 text-right font-bold text-slate-800">${this.formatINR(mtdAmount)}</td>
                <td class="p-2 text-right text-slate-500 text-[11px]">${pctOfSalary}%</td>
                ${checkThreshold ? `<td class="p-2 text-center font-sans">${statusHtml}</td>` : ''}
            `;
            tbody.appendChild(tr);
        });
    }

    renderDailyBurnRate(monthTxns, salary) {
        const tbody = document.getElementById('dailyBurnTableBody');
        tbody.innerHTML = '';

        const dateMap = {};
        monthTxns.forEach(t => {
            if (t.type === 'Responsible' || t.type === 'Bonus') {
                dateMap[t.date] = (dateMap[t.date] || 0) + t.amount;
            }
        });

        const sortedDates = Object.keys(dateMap).sort();
        let cumulativeSpent = 0;

        if (sortedDates.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400 font-sans">No expense transactions logged for this month.</td></tr>`;
            return;
        }

        sortedDates.forEach(date => {
            const dailySpend = dateMap[date];
            cumulativeSpent += dailySpend;
            const runningBal = salary - cumulativeSpent;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-2 text-slate-700">${date}</td>
                <td class="p-2 text-right font-medium text-rose-600">${this.formatINR(dailySpend)}</td>
                <td class="p-2 text-right font-bold text-slate-800">${this.formatINR(cumulativeSpent)}</td>
                <td class="p-2 text-right font-medium ${runningBal < 0 ? 'text-rose-600' : 'text-emerald-700'}">${this.formatINR(runningBal)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ==========================================
    // TAB 4: MONTHLY SUMMARY TABLE
    // ==========================================
    getHistoricalMonthlyData() {
        const monthSet = new Set(this.config.salaries.map(s => s.month));
        this.transactions.forEach(t => monthSet.add(t.date.substring(0, 7)));

        const months = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

        return months.map(m => {
            const salary = this.getSalaryForMonth(m);
            const txns = this.transactions.filter(t => t.date.startsWith(m));

            let resp = 0, bonus = 0, invest = 0;
            txns.forEach(t => {
                if (t.type === 'Responsible') resp += t.amount;
                else if (t.type === 'Bonus') bonus += t.amount;
                else if (t.type === 'Investment') invest += t.amount;
            });

            const totalSpent = resp + bonus;
            const remaining = salary - totalSpent - invest;
            const totalSaved = invest + Math.max(0, remaining);
            const savingsRate = salary > 0 ? (totalSaved / salary) * 100 : 0;

            return { month: m, salary, resp, bonus, invest, totalSpent, remaining, savingsRate };
        });
    }

    renderSummary() {
        const tbody = document.getElementById('monthlySummaryTableBody');
        tbody.innerHTML = '';

        const summaryData = this.getHistoricalMonthlyData();

        if (summaryData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400 font-sans">No data yet. Add a salary and log some transactions to see monthly history here.</td></tr>`;
            return;
        }

        summaryData.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50 transition-colors';
            tr.innerHTML = `
                <td class="p-3 font-bold text-slate-800">${row.month}</td>
                <td class="p-3 text-right">${this.formatINR(row.salary)}</td>
                <td class="p-3 text-right text-slate-700">${this.formatINR(row.resp)}</td>
                <td class="p-3 text-right text-slate-700">${this.formatINR(row.bonus)}</td>
                <td class="p-3 text-right text-emerald-600 font-medium">${this.formatINR(row.invest)}</td>
                <td class="p-3 text-right text-rose-600 font-medium">${this.formatINR(row.totalSpent)}</td>
                <td class="p-3 text-right font-bold ${row.remaining < 0 ? 'text-rose-600' : 'text-slate-800'}">${this.formatINR(row.remaining)}</td>
                <td class="p-3 text-right font-bold text-emerald-700">${row.savingsRate.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // ==========================================
    // TAB 5: YEARLY DASHBOARD
    // ==========================================
    renderYearlyDashboard() {
        const yearSelect = document.getElementById('yearlyYearSelect');

        const summaryData = this.getHistoricalMonthlyData();
        const yearSet = new Set(summaryData.map(d => d.month.substring(0, 4)));
        const years = Array.from(yearSet).sort((a, b) => b.localeCompare(a));

        if (years.length === 0) years.push(new Date().getFullYear().toString());

        const currentSel = yearSelect.value || years[0];
        yearSelect.innerHTML = '';
        years.forEach(y => {
            const opt = document.createElement('option');
            opt.value = y;
            opt.innerText = `Year ${y}`;
            if (y === currentSel) opt.selected = true;
            yearSelect.appendChild(opt);
        });

        const selectedYear = yearSelect.value || years[0];

        const yearMonths = summaryData.filter(d => d.month.startsWith(selectedYear));

        let ySalary = 0, ySpent = 0, yInvested = 0, yRemaining = 0;
        yearMonths.forEach(m => {
            ySalary += m.salary;
            ySpent += m.totalSpent;
            yInvested += m.invest;
            yRemaining += m.remaining;
        });

        const ySaved = yInvested + Math.max(0, yRemaining);
        const ySavingsRate = ySalary > 0 ? (ySaved / ySalary) * 100 : 0;

        document.getElementById('yKpiSalary').innerText = this.formatINR(ySalary);
        document.getElementById('yKpiSpent').innerText = this.formatINR(ySpent);
        document.getElementById('yKpiInvested').innerText = this.formatINR(yInvested);
        document.getElementById('yKpiSaved').innerText = this.formatINR(ySaved);
        document.getElementById('yKpiRate').innerText = `${ySavingsRate.toFixed(1)}%`;

        const monthGrid = document.getElementById('yearlyMonthGrid');
        monthGrid.innerHTML = '';

        for (let m = 1; m <= 12; m++) {
            const monthStr = `${selectedYear}-${String(m).padStart(2, '0')}`;
            const monthData = yearMonths.find(d => d.month === monthStr) || {
                month: monthStr, salary: 0, resp: 0, bonus: 0, invest: 0, remaining: 0, savingsRate: 0
            };

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-2 font-medium text-slate-800">${monthStr}</td>
                <td class="p-2 text-right">${this.formatINR(monthData.salary)}</td>
                <td class="p-2 text-right text-slate-600">${this.formatINR(monthData.resp)}</td>
                <td class="p-2 text-right text-slate-600">${this.formatINR(monthData.bonus)}</td>
                <td class="p-2 text-right text-emerald-600">${this.formatINR(monthData.invest)}</td>
                <td class="p-2 text-right font-medium">${this.formatINR(monthData.remaining)}</td>
                <td class="p-2 text-right font-bold text-emerald-700">${monthData.savingsRate.toFixed(1)}%</td>
            `;
            monthGrid.appendChild(tr);
        }

        const yoyBody = document.getElementById('yoyTableBody');
        yoyBody.innerHTML = '';

        years.forEach(yr => {
            const yrMonths = summaryData.filter(d => d.month.startsWith(yr));
            let yrSal = 0, yrSp = 0, yrInv = 0, yrRem = 0;
            yrMonths.forEach(m => {
                yrSal += m.salary;
                yrSp += m.totalSpent;
                yrInv += m.invest;
                yrRem += m.remaining;
            });
            const yrSaved = yrInv + Math.max(0, yrRem);
            const yrRate = yrSal > 0 ? (yrSaved / yrSal) * 100 : 0;

            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-50';
            tr.innerHTML = `
                <td class="p-2.5 font-bold text-slate-800">${yr}</td>
                <td class="p-2.5 text-right font-medium">${this.formatINR(yrSal)}</td>
                <td class="p-2.5 text-right text-rose-600">${this.formatINR(yrSp)}</td>
                <td class="p-2.5 text-right text-emerald-600">${this.formatINR(yrInv)}</td>
                <td class="p-2.5 text-right font-bold text-emerald-700">${yrRate.toFixed(1)}%</td>
            `;
            yoyBody.appendChild(tr);
        });
    }

    // ==========================================
    // TAB 6: VISUAL CHARTS (CHART.JS)
    // ==========================================
    initCharts() {
        Object.keys(this.chartInstances).forEach(k => {
            if (this.chartInstances[k]) this.chartInstances[k].destroy();
        });

        const ctx1 = document.getElementById('chartMonthSplit').getContext('2d');
        this.chartInstances.chartMonthSplit = new Chart(ctx1, {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'] }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });

        const ctx2 = document.getElementById('chartTypePct').getContext('2d');
        this.chartInstances.chartTypePct = new Chart(ctx2, {
            type: 'bar',
            data: { labels: ['Responsible', 'Bonus', 'Investment'], datasets: [{ label: '% of Salary', data: [], backgroundColor: ['#3b82f6', '#f59e0b', '#10b981'] }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });

        const ctx3 = document.getElementById('chartSavingsTrend').getContext('2d');
        this.chartInstances.chartSavingsTrend = new Chart(ctx3, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Savings Rate %', data: [], borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.3 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });

        const ctx4 = document.getElementById('chartStackedTrend').getContext('2d');
        this.chartInstances.chartStackedTrend = new Chart(ctx4, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    { label: 'Responsible', data: [], backgroundColor: '#3b82f6' },
                    { label: 'Bonus', data: [], backgroundColor: '#f59e0b' },
                    { label: 'Investment', data: [], backgroundColor: '#10b981' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true } } }
        });

        const ctx5 = document.getElementById('chartYearlyTotals').getContext('2d');
        this.chartInstances.chartYearlyTotals = new Chart(ctx5, {
            type: 'bar',
            data: {
                labels: [],
                datasets: [
                    { label: 'Total Spent', data: [], backgroundColor: '#ef4444' },
                    { label: 'Total Invested', data: [], backgroundColor: '#10b981' }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });

        const ctx6 = document.getElementById('chartYoYSavings').getContext('2d');
        this.chartInstances.chartYoYSavings = new Chart(ctx6, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'YoY Savings Rate %', data: [], borderColor: '#059669', borderWidth: 3, pointRadius: 5 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } } }
        });
    }

    renderCharts() {
        if (!this.chartInstances.chartMonthSplit) this.initCharts();

        const summaryData = this.getHistoricalMonthlyData().slice().reverse();
        const curMonth = this.activeMonth;
        const curSummary = summaryData.find(d => d.month === curMonth) || { salary: 0, resp: 0, bonus: 0, invest: 0 };

        this.chartInstances.chartMonthSplit.data.labels = ['Responsible Expenses', 'Bonus Expenses', 'Investments'];
        this.chartInstances.chartMonthSplit.data.datasets[0].data = [curSummary.resp, curSummary.bonus, curSummary.invest];
        this.chartInstances.chartMonthSplit.update();

        const sal = curSummary.salary || 1;
        this.chartInstances.chartTypePct.data.datasets[0].data = [
            ((curSummary.resp / sal) * 100).toFixed(1),
            ((curSummary.bonus / sal) * 100).toFixed(1),
            ((curSummary.invest / sal) * 100).toFixed(1)
        ];
        this.chartInstances.chartTypePct.update();

        this.chartInstances.chartSavingsTrend.data.labels = summaryData.map(d => d.month);
        this.chartInstances.chartSavingsTrend.data.datasets[0].data = summaryData.map(d => d.savingsRate.toFixed(1));
        this.chartInstances.chartSavingsTrend.update();

        const last6 = summaryData.slice(-6);
        this.chartInstances.chartStackedTrend.data.labels = last6.map(d => d.month);
        this.chartInstances.chartStackedTrend.data.datasets[0].data = last6.map(d => d.resp);
        this.chartInstances.chartStackedTrend.data.datasets[1].data = last6.map(d => d.bonus);
        this.chartInstances.chartStackedTrend.data.datasets[2].data = last6.map(d => d.invest);
        this.chartInstances.chartStackedTrend.update();

        const yearMap = {};
        summaryData.forEach(d => {
            const yr = d.month.substring(0, 4);
            if (!yearMap[yr]) yearMap[yr] = { salary: 0, spent: 0, invest: 0, remaining: 0 };
            yearMap[yr].salary += d.salary;
            yearMap[yr].spent += d.totalSpent;
            yearMap[yr].invest += d.invest;
            yearMap[yr].remaining += d.remaining;
        });

        const yrs = Object.keys(yearMap).sort();

        this.chartInstances.chartYearlyTotals.data.labels = yrs;
        this.chartInstances.chartYearlyTotals.data.datasets[0].data = yrs.map(y => yearMap[y].spent);
        this.chartInstances.chartYearlyTotals.data.datasets[1].data = yrs.map(y => yearMap[y].invest);
        this.chartInstances.chartYearlyTotals.update();

        this.chartInstances.chartYoYSavings.data.labels = yrs;
        this.chartInstances.chartYoYSavings.data.datasets[0].data = yrs.map(y => {
            const yrSal = yearMap[y].salary;
            const yrSaved = yearMap[y].invest + Math.max(0, yearMap[y].remaining);
            return yrSal > 0 ? ((yrSaved / yrSal) * 100).toFixed(1) : 0;
        });
        this.chartInstances.chartYoYSavings.update();
    }

    // ==========================================
    // EXPORT UTILITIES
    // ==========================================
    exportToCSV() {
        if (this.transactions.length === 0) {
            alert('No transactions to export yet.');
            return;
        }
        let csv = 'Date,Type,Category,Amount,Notes\n';
        this.transactions.forEach(t => {
            csv += `"${t.date}","${t.type}","${t.category}",${t.amount},"${(t.notes || '').replace(/"/g, '""')}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.setAttribute('href', url);
        a.setAttribute('download', `Budget_Transactions_${this.activeMonth}.csv`);
        a.click();
    }
}

// App initialization is now driven by Firebase auth state — see js/auth.js.
// `app` is created there (as window.app) once a user is signed in, after
// their data has been loaded from Firestore.
