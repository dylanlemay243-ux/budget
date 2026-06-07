import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  StatusBar,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Calendar} from 'react-native-calendars';

const {width: SCREEN_W} = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
type EntryType = 'income' | 'expense';
type TabName = 'calendar' | 'reports';
type ReportView = 'monthly' | 'yearly' | 'all';

const CATEGORIES = [
  'Food & Dining',
  'Transport',
  'Shopping',
  'Housing',
  'Health',
  'Entertainment',
  'Utilities',
  'Salary',
  'Freelance',
  'Other',
] as const;
type Category = (typeof CATEGORIES)[number];

interface Entry {
  id: string;
  type: EntryType;
  amount: number;
  label: string;
  category: Category;
  date: string; // YYYY-MM-DD
  timestamp: number;
}

// ─── Storage helpers ──────────────────────────────────────────────────────────
const STORAGE_KEY = '@budget_entries_v2';

async function loadEntries(): Promise<Entry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveEntries(entries: Entry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function today(): string {
  return new Date().toISOString().split('T')[0];
}

function fmt(n: number, showSign = false): string {
  const s = Math.abs(n).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
  if (showSign) return (n >= 0 ? '+' : '-') + s;
  return s;
}

function monthLabel(yyyy: number, mm: number): string {
  return new Date(yyyy, mm - 1, 1).toLocaleString('default', {
    month: 'long',
    year: 'numeric',
  });
}

const MONTH_NAMES = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

// ─── Mini bar component ───────────────────────────────────────────────────────
function MiniBar({value, max, color}: {value: number; max: number; color: string}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={barStyles.track}>
      <View style={[barStyles.fill, {width: `${pct}%` as any, backgroundColor: color}]} />
    </View>
  );
}
const barStyles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#1E3248',
    flex: 1,
    marginLeft: 8,
  },
  fill: {height: 6, borderRadius: 3},
});

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({label, value, color, sub}: {label: string; value: string; color: string; sub?: string}) {
  return (
    <View style={[cardStyles.card, {borderTopColor: color}]}>
      <Text style={cardStyles.label}>{label}</Text>
      <Text style={[cardStyles.value, {color}]}>{value}</Text>
      {sub ? <Text style={cardStyles.sub}>{sub}</Text> : null}
    </View>
  );
}
const cardStyles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#1A2A3A',
    borderRadius: 12,
    padding: 12,
    borderTopWidth: 3,
    margin: 4,
  },
  label: {color: '#8BAFC9', fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5},
  value: {fontSize: 18, fontWeight: '900'},
  sub: {color: '#5A7A94', fontSize: 11, marginTop: 2},
});

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [activeTab, setActiveTab] = useState<TabName>('calendar');
  const [reportView, setReportView] = useState<ReportView>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return {yyyy: d.getFullYear(), mm: d.getMonth() + 1};
  });
  const [reportYear, setReportYear] = useState(new Date().getFullYear());
  const [modalVisible, setModalVisible] = useState(false);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [formType, setFormType] = useState<EntryType>('expense');
  const [formAmount, setFormAmount] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formCategory, setFormCategory] = useState<Category>('Other');
  const [formDate, setFormDate] = useState(today());
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  useEffect(() => {loadEntries().then(setEntries);}, []);
  useEffect(() => {saveEntries(entries);}, [entries]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const balance = useMemo(
    () => entries.reduce((s, e) => (e.type === 'income' ? s + e.amount : s - e.amount), 0),
    [entries],
  );

  const markedDates = useMemo(() => {
    const m: Record<string, any> = {};
    entries.forEach(e => {
      const ex = m[e.date] || {dots: []};
      m[e.date] = {...ex, dots: [...ex.dots, {key: e.id, color: e.type === 'income' ? '#4CAF50' : '#F44336'}]};
    });
    if (selectedDate) {
      m[selectedDate] = {...(m[selectedDate] || {}), selected: true, selectedColor: '#1A73E8'};
    }
    return m;
  }, [entries, selectedDate]);

  const dayEntries = useMemo(
    () => entries.filter(e => e.date === selectedDate).sort((a, b) => b.timestamp - a.timestamp),
    [entries, selectedDate],
  );

  // ── Report data ───────────────────────────────────────────────────────────
  const monthlyEntries = useMemo(() => {
    const pfx = `${reportMonth.yyyy}-${String(reportMonth.mm).padStart(2, '0')}`;
    return entries.filter(e => e.date.startsWith(pfx));
  }, [entries, reportMonth]);

  const yearlyEntries = useMemo(
    () => entries.filter(e => e.date.startsWith(String(reportYear))),
    [entries, reportYear],
  );

  function summarize(list: Entry[]) {
    const income = list.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = list.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return {income, expense, net: income - expense, count: list.length};
  }

  // Category breakdown
  function catBreakdown(list: Entry[]) {
    const map: Record<string, {income: number; expense: number}> = {};
    list.forEach(e => {
      if (!map[e.category]) map[e.category] = {income: 0, expense: 0};
      if (e.type === 'income') map[e.category].income += e.amount;
      else map[e.category].expense += e.amount;
    });
    return Object.entries(map)
      .map(([cat, v]) => ({cat, ...v, total: v.income + v.expense}))
      .sort((a, b) => b.total - a.total);
  }

  // Monthly breakdown for yearly view (12 months)
  const monthlyBreakdown = useMemo(() => {
    return Array.from({length: 12}, (_, i) => {
      const mm = i + 1;
      const pfx = `${reportYear}-${String(mm).padStart(2, '0')}`;
      const list = entries.filter(e => e.date.startsWith(pfx));
      return {mm, ...summarize(list)};
    });
  }, [entries, reportYear]);

  // All-time: per-year
  const allYears = useMemo(() => {
    const years = new Set(entries.map(e => e.date.slice(0, 4)));
    return Array.from(years).sort().reverse().map(y => {
      const list = entries.filter(e => e.date.startsWith(y));
      return {year: Number(y), ...summarize(list)};
    });
  }, [entries]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const openAdd = useCallback((type: EntryType = 'expense') => {
    setEditEntry(null);
    setFormType(type);
    setFormAmount('');
    setFormLabel('');
    setFormCategory('Other');
    setFormDate(selectedDate);
    setModalVisible(true);
  }, [selectedDate]);

  const openEdit = useCallback((entry: Entry) => {
    setEditEntry(entry);
    setFormType(entry.type);
    setFormAmount(String(entry.amount));
    setFormLabel(entry.label);
    setFormCategory(entry.category || 'Other');
    setFormDate(entry.date);
    setModalVisible(true);
  }, []);

  const handleSave = useCallback(() => {
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {Alert.alert('Invalid amount', 'Enter a positive number.'); return;}
    if (!formLabel.trim()) {Alert.alert('Missing label', 'Add a description.'); return;}
    if (editEntry) {
      setEntries(prev => prev.map(e => e.id === editEntry.id
        ? {...e, type: formType, amount, label: formLabel.trim(), category: formCategory, date: formDate}
        : e));
    } else {
      setEntries(prev => [{
        id: Date.now().toString(), type: formType, amount,
        label: formLabel.trim(), category: formCategory,
        date: formDate, timestamp: Date.now(),
      }, ...prev]);
    }
    setModalVisible(false);
  }, [editEntry, formType, formAmount, formLabel, formCategory, formDate]);

  const handleDelete = useCallback((id: string) => {
    Alert.alert('Delete entry', 'Remove this entry?', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Delete', style: 'destructive', onPress: () => setEntries(prev => prev.filter(e => e.id !== id))},
    ]);
  }, []);

  // ── Render: Monthly Report ────────────────────────────────────────────────
  function renderMonthly() {
    const {income, expense, net} = summarize(monthlyEntries);
    const cats = catBreakdown(monthlyEntries);
    const maxCat = cats.reduce((m, c) => Math.max(m, c.total), 0);
    const topExpenses = [...monthlyEntries].filter(e => e.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
    const topIncome = [...monthlyEntries].filter(e => e.type === 'income').sort((a, b) => b.amount - a.amount).slice(0, 5);

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Month navigator */}
        <View style={s.navRow}>
          <TouchableOpacity style={s.navBtn} onPress={() => setReportMonth(p => {
            const d = new Date(p.yyyy, p.mm - 2, 1);
            return {yyyy: d.getFullYear(), mm: d.getMonth() + 1};
          })}>
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>{monthLabel(reportMonth.yyyy, reportMonth.mm)}</Text>
          <TouchableOpacity style={s.navBtn} onPress={() => setReportMonth(p => {
            const d = new Date(p.yyyy, p.mm, 1);
            return {yyyy: d.getFullYear(), mm: d.getMonth() + 1};
          })}>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={s.cardRow}>
          <StatCard label="Income" value={fmt(income)} color="#4CAF50" sub={`${monthlyEntries.filter(e=>e.type==='income').length} entries`} />
          <StatCard label="Expenses" value={fmt(expense)} color="#F44336" sub={`${monthlyEntries.filter(e=>e.type==='expense').length} entries`} />
        </View>
        <View style={s.cardRow}>
          <StatCard label="Net" value={fmt(net, true)} color={net >= 0 ? '#4CAF50' : '#F44336'} sub={net >= 0 ? 'surplus' : 'deficit'} />
          <StatCard label="Savings Rate" value={income > 0 ? `${Math.round((net / income) * 100)}%` : '—'} color="#1A73E8" />
        </View>

        {/* Spending bar */}
        {income > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>BUDGET UTILIZATION</Text>
            <View style={s.utilizationRow}>
              <View style={[s.utilizationFill, {
                width: `${Math.min((expense / income) * 100, 100)}%` as any,
                backgroundColor: expense > income ? '#F44336' : expense > income * 0.8 ? '#FF9800' : '#4CAF50',
              }]} />
            </View>
            <Text style={s.utilizationLabel}>
              {fmt(expense)} spent of {fmt(income)} earned ({income > 0 ? Math.round((expense/income)*100) : 0}%)
            </Text>
          </View>
        )}

        {/* Categories */}
        {cats.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>BY CATEGORY</Text>
            {cats.map(c => (
              <View key={c.cat} style={s.catRow}>
                <View style={s.catLeft}>
                  <Text style={s.catName}>{c.cat}</Text>
                  <Text style={s.catSub}>
                    {c.income > 0 ? `+${fmt(c.income)}` : ''}
                    {c.income > 0 && c.expense > 0 ? '  ' : ''}
                    {c.expense > 0 ? `-${fmt(c.expense)}` : ''}
                  </Text>
                </View>
                <MiniBar value={c.total} max={maxCat} color={c.expense >= c.income ? '#F44336' : '#4CAF50'} />
                <Text style={s.catAmount}>{fmt(c.total)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top expenses */}
        {topExpenses.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>TOP EXPENSES</Text>
            {topExpenses.map((e, i) => (
              <View key={e.id} style={s.topRow}>
                <Text style={s.topRank}>#{i + 1}</Text>
                <View style={s.topMid}>
                  <Text style={s.topLabel}>{e.label}</Text>
                  <Text style={s.topCat}>{e.category} · {e.date}</Text>
                </View>
                <Text style={s.topAmt}>{fmt(e.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Top income */}
        {topIncome.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>TOP INCOME</Text>
            {topIncome.map((e, i) => (
              <View key={e.id} style={s.topRow}>
                <Text style={s.topRank}>#{i + 1}</Text>
                <View style={s.topMid}>
                  <Text style={s.topLabel}>{e.label}</Text>
                  <Text style={s.topCat}>{e.category} · {e.date}</Text>
                </View>
                <Text style={[s.topAmt, {color: '#4CAF50'}]}>{fmt(e.amount)}</Text>
              </View>
            ))}
          </View>
        )}

        {monthlyEntries.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No entries this month.</Text>
          </View>
        )}
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  // ── Render: Yearly Report ─────────────────────────────────────────────────
  function renderYearly() {
    const {income, expense, net} = summarize(yearlyEntries);
    const cats = catBreakdown(yearlyEntries);
    const maxCat = cats.reduce((m, c) => Math.max(m, c.total), 0);
    const maxMonth = monthlyBreakdown.reduce((m, b) => Math.max(m, b.income, b.expense), 0);

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Year navigator */}
        <View style={s.navRow}>
          <TouchableOpacity style={s.navBtn} onPress={() => setReportYear(y => y - 1)}>
            <Text style={s.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={s.navTitle}>{reportYear}</Text>
          <TouchableOpacity style={s.navBtn} onPress={() => setReportYear(y => y + 1)}>
            <Text style={s.navArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View style={s.cardRow}>
          <StatCard label="Total Income" value={fmt(income)} color="#4CAF50" sub={`${yearlyEntries.filter(e=>e.type==='income').length} entries`} />
          <StatCard label="Total Expenses" value={fmt(expense)} color="#F44336" sub={`${yearlyEntries.filter(e=>e.type==='expense').length} entries`} />
        </View>
        <View style={s.cardRow}>
          <StatCard label="Net Savings" value={fmt(net, true)} color={net >= 0 ? '#4CAF50' : '#F44336'} />
          <StatCard label="Avg/Month" value={fmt(expense / 12)} color="#FF9800" sub="expenses" />
        </View>

        {/* Monthly chart (bar) */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MONTHLY OVERVIEW — {reportYear}</Text>
          <View style={s.chartArea}>
            {monthlyBreakdown.map(mb => (
              <View key={mb.mm} style={s.chartCol}>
                <View style={s.chartBars}>
                  {mb.income > 0 && (
                    <View style={[s.chartBar, {
                      height: maxMonth > 0 ? Math.max(4, (mb.income / maxMonth) * 80) : 0,
                      backgroundColor: '#4CAF50',
                    }]} />
                  )}
                  {mb.expense > 0 && (
                    <View style={[s.chartBar, {
                      height: maxMonth > 0 ? Math.max(4, (mb.expense / maxMonth) * 80) : 0,
                      backgroundColor: '#F44336',
                    }]} />
                  )}
                  {mb.income === 0 && mb.expense === 0 && (
                    <View style={[s.chartBar, {height: 4, backgroundColor: '#1E3248'}]} />
                  )}
                </View>
                <Text style={s.chartLabel}>{MONTH_NAMES[mb.mm - 1]}</Text>
              </View>
            ))}
          </View>
          <View style={s.chartLegend}>
            <View style={s.legendItem}><View style={[s.legendDot, {backgroundColor: '#4CAF50'}]} /><Text style={s.legendText}>Income</Text></View>
            <View style={s.legendItem}><View style={[s.legendDot, {backgroundColor: '#F44336'}]} /><Text style={s.legendText}>Expenses</Text></View>
          </View>
        </View>

        {/* Monthly table */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MONTH-BY-MONTH</Text>
          {monthlyBreakdown.filter(mb => mb.count > 0).map(mb => (
            <View key={mb.mm} style={s.tableRow}>
              <Text style={s.tableMonth}>{MONTH_NAMES[mb.mm - 1]}</Text>
              <Text style={[s.tableVal, {color: '#4CAF50'}]}>{fmt(mb.income)}</Text>
              <Text style={[s.tableVal, {color: '#F44336'}]}>{fmt(mb.expense)}</Text>
              <Text style={[s.tableNet, {color: mb.net >= 0 ? '#4CAF50' : '#F44336'}]}>
                {fmt(mb.net, true)}
              </Text>
            </View>
          ))}
          {yearlyEntries.length === 0 && (
            <Text style={s.emptyText}>No entries for {reportYear}.</Text>
          )}
        </View>

        {/* Category breakdown */}
        {cats.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>BY CATEGORY</Text>
            {cats.map(c => (
              <View key={c.cat} style={s.catRow}>
                <View style={s.catLeft}>
                  <Text style={s.catName}>{c.cat}</Text>
                  <Text style={s.catSub}>
                    {c.income > 0 ? `+${fmt(c.income)}` : ''}
                    {c.income > 0 && c.expense > 0 ? '  ' : ''}
                    {c.expense > 0 ? `-${fmt(c.expense)}` : ''}
                  </Text>
                </View>
                <MiniBar value={c.total} max={maxCat} color={c.expense >= c.income ? '#F44336' : '#4CAF50'} />
                <Text style={s.catAmount}>{fmt(c.total)}</Text>
              </View>
            ))}
          </View>
        )}
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  // ── Render: All-time Report ───────────────────────────────────────────────
  function renderAllTime() {
    const allIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const allExpense = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    const allNet = allIncome - allExpense;
    const cats = catBreakdown(entries);
    const maxCat = cats.reduce((m, c) => Math.max(m, c.total), 0);

    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={[s.navRow, {justifyContent: 'center'}]}>
          <Text style={s.navTitle}>All Time</Text>
        </View>

        <View style={s.cardRow}>
          <StatCard label="Total Income" value={fmt(allIncome)} color="#4CAF50" sub={`${entries.filter(e=>e.type==='income').length} entries`} />
          <StatCard label="Total Expenses" value={fmt(allExpense)} color="#F44336" sub={`${entries.filter(e=>e.type==='expense').length} entries`} />
        </View>
        <View style={s.cardRow}>
          <StatCard label="Net Worth Delta" value={fmt(allNet, true)} color={allNet >= 0 ? '#4CAF50' : '#F44336'} />
          <StatCard label="Total Entries" value={String(entries.length)} color="#1A73E8" />
        </View>

        {/* Year-by-year */}
        {allYears.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>YEAR BY YEAR</Text>
            <View style={s.tableHeader}>
              <Text style={s.tableHeaderCell}>Year</Text>
              <Text style={s.tableHeaderCell}>Income</Text>
              <Text style={s.tableHeaderCell}>Expenses</Text>
              <Text style={s.tableHeaderCell}>Net</Text>
            </View>
            {allYears.map(y => (
              <View key={y.year} style={s.tableRow}>
                <Text style={s.tableMonth}>{y.year}</Text>
                <Text style={[s.tableVal, {color: '#4CAF50'}]}>{fmt(y.income)}</Text>
                <Text style={[s.tableVal, {color: '#F44336'}]}>{fmt(y.expense)}</Text>
                <Text style={[s.tableNet, {color: y.net >= 0 ? '#4CAF50' : '#F44336'}]}>{fmt(y.net, true)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Category breakdown */}
        {cats.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>ALL CATEGORIES</Text>
            {cats.map(c => (
              <View key={c.cat} style={s.catRow}>
                <View style={s.catLeft}>
                  <Text style={s.catName}>{c.cat}</Text>
                  <Text style={s.catSub}>
                    {c.income > 0 ? `+${fmt(c.income)}` : ''}
                    {c.income > 0 && c.expense > 0 ? '  ' : ''}
                    {c.expense > 0 ? `-${fmt(c.expense)}` : ''}
                  </Text>
                </View>
                <MiniBar value={c.total} max={maxCat} color={c.expense >= c.income ? '#F44336' : '#4CAF50'} />
                <Text style={s.catAmount}>{fmt(c.total)}</Text>
              </View>
            ))}
          </View>
        )}

        {entries.length === 0 && (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No entries yet. Start tracking!</Text>
          </View>
        )}
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  // ── Render: Calendar Tab ──────────────────────────────────────────────────
  function renderCalendar() {
    const dayTotal = dayEntries.reduce((sum, e) => (e.type === 'income' ? sum + e.amount : sum - e.amount), 0);
    return (
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={s.calendarCard}>
          <Calendar
            onDayPress={day => setSelectedDate(day.dateString)}
            markedDates={markedDates}
            markingType="multi-dot"
            theme={{
              backgroundColor: '#1A2A3A',
              calendarBackground: '#1A2A3A',
              textSectionTitleColor: '#8BAFC9',
              selectedDayBackgroundColor: '#1A73E8',
              selectedDayTextColor: '#fff',
              todayTextColor: '#1A73E8',
              dayTextColor: '#E0EAF4',
              textDisabledColor: '#3A5068',
              arrowColor: '#1A73E8',
              monthTextColor: '#E0EAF4',
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
            }}
          />
        </View>
        <View style={s.daySummaryRow}>
          <Text style={s.daySummaryDate}>{selectedDate}</Text>
          <Text style={[s.daySummaryTotal, {color: dayTotal >= 0 ? '#4CAF50' : '#F44336'}]}>
            {dayTotal !== 0 ? fmt(dayTotal, true) : '—'}
          </Text>
        </View>
        <View style={s.quickAddRow}>
          <TouchableOpacity style={[s.quickBtn, s.quickIncome]} onPress={() => openAdd('income')}>
            <Text style={s.quickBtnText}>＋ Income</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.quickBtn, s.quickExpense]} onPress={() => openAdd('expense')}>
            <Text style={s.quickBtnText}>－ Expense</Text>
          </TouchableOpacity>
        </View>
        {dayEntries.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyText}>No entries for this day.</Text>
            <Text style={s.emptySub}>Tap + Income or − Expense to add one.</Text>
          </View>
        ) : (
          dayEntries.map(entry => (
            <View key={entry.id} style={s.entryCard}>
              <View style={s.entryLeft}>
                <Text style={s.entryIcon}>{entry.type === 'income' ? '📈' : '📉'}</Text>
                <View>
                  <Text style={s.entryLabel}>{entry.label}</Text>
                  <Text style={s.entryCat}>{entry.category}</Text>
                </View>
              </View>
              <View style={s.entryRight}>
                <Text style={[s.entryAmount, {color: entry.type === 'income' ? '#4CAF50' : '#F44336'}]}>
                  {entry.type === 'income' ? '+' : '-'}{fmt(entry.amount)}
                </Text>
                <View style={s.entryActions}>
                  <TouchableOpacity onPress={() => openEdit(entry)} style={s.actionBtn}><Text style={s.actionBtnText}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(entry.id)} style={s.actionBtn}><Text style={s.actionBtnText}>🗑️</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
        <View style={{height: 40}} />
      </ScrollView>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#0D1B2A" />

      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>💰 Budget Tracker</Text>
        <View style={s.balanceRow}>
          <Text style={s.balanceLabel}>Current Balance</Text>
          <Text style={[s.balanceAmount, {color: balance >= 0 ? '#4CAF50' : '#F44336'}]}>
            {fmt(balance)}
          </Text>
        </View>
      </View>

      {/* Tab Bar */}
      <View style={s.tabBar}>
        <TouchableOpacity style={[s.tab, activeTab === 'calendar' && s.tabActive]} onPress={() => setActiveTab('calendar')}>
          <Text style={[s.tabText, activeTab === 'calendar' && s.tabTextActive]}>📅 Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tab, activeTab === 'reports' && s.tabActive]} onPress={() => setActiveTab('reports')}>
          <Text style={[s.tabText, activeTab === 'reports' && s.tabTextActive]}>📊 Reports</Text>
        </TouchableOpacity>
      </View>

      {/* Reports sub-tabs */}
      {activeTab === 'reports' && (
        <View style={s.subTabBar}>
          {(['monthly', 'yearly', 'all'] as ReportView[]).map(v => (
            <TouchableOpacity key={v} style={[s.subTab, reportView === v && s.subTabActive]} onPress={() => setReportView(v)}>
              <Text style={[s.subTabText, reportView === v && s.subTabTextActive]}>
                {v === 'monthly' ? 'Monthly' : v === 'yearly' ? 'Yearly' : 'All Time'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      <View style={s.content}>
        {activeTab === 'calendar' ? renderCalendar() :
          reportView === 'monthly' ? renderMonthly() :
          reportView === 'yearly' ? renderYearly() :
          renderAllTime()}
      </View>

      {/* Entry modal */}
      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{editEntry ? 'Edit Entry' : 'New Entry'}</Text>

            {/* Type toggle */}
            <View style={s.typeRow}>
              <TouchableOpacity style={[s.typeBtn, formType === 'income' && s.typeBtnIncome]} onPress={() => setFormType('income')}>
                <Text style={[s.typeBtnText, formType === 'income' && s.typeBtnTextActive]}>📈 Income</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.typeBtn, formType === 'expense' && s.typeBtnExpense]} onPress={() => setFormType('expense')}>
                <Text style={[s.typeBtnText, formType === 'expense' && s.typeBtnTextActive]}>📉 Expense</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.inputLabel}>Amount ($)</Text>
            <TextInput style={s.input} value={formAmount} onChangeText={setFormAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#5A7A94" />

            <Text style={s.inputLabel}>Description</Text>
            <TextInput style={s.input} value={formLabel} onChangeText={setFormLabel} placeholder="e.g. Groceries, Salary..." placeholderTextColor="#5A7A94" maxLength={50} />

            {/* Category picker */}
            <Text style={s.inputLabel}>Category</Text>
            <TouchableOpacity style={s.catPickerBtn} onPress={() => setCatPickerOpen(true)}>
              <Text style={s.catPickerText}>{formCategory}</Text>
              <Text style={s.catPickerArrow}>▾</Text>
            </TouchableOpacity>

            <Text style={s.inputLabel}>Date (YYYY-MM-DD)</Text>
            <TextInput style={s.input} value={formDate} onChangeText={setFormDate} placeholder="2024-01-15" placeholderTextColor="#5A7A94" maxLength={10} />

            <View style={s.modalBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, {backgroundColor: formType === 'income' ? '#4CAF50' : '#1A73E8'}]} onPress={handleSave}>
                <Text style={s.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Category picker modal */}
      <Modal visible={catPickerOpen} animationType="slide" transparent onRequestClose={() => setCatPickerOpen(false)}>
        <TouchableOpacity style={s.catOverlay} activeOpacity={1} onPress={() => setCatPickerOpen(false)}>
          <View style={s.catSheet}>
            <Text style={s.catSheetTitle}>Select Category</Text>
            <ScrollView>
              {CATEGORIES.map(cat => (
                <TouchableOpacity key={cat} style={[s.catOption, formCategory === cat && s.catOptionActive]}
                  onPress={() => {setFormCategory(cat); setCatPickerOpen(false);}}>
                  <Text style={[s.catOptionText, formCategory === cat && s.catOptionTextActive]}>{cat}</Text>
                  {formCategory === cat && <Text style={s.catCheck}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {flex: 1, backgroundColor: '#0D1B2A'},
  content: {flex: 1},

  // Header
  header: {backgroundColor: '#0D1B2A', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#1A2A3A'},
  headerTitle: {color: '#E0EAF4', fontSize: 20, fontWeight: '800', letterSpacing: 0.3, marginBottom: 6},
  balanceRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  balanceLabel: {color: '#8BAFC9', fontSize: 13, fontWeight: '500'},
  balanceAmount: {fontSize: 24, fontWeight: '900', letterSpacing: -0.5},

  // Tabs
  tabBar: {flexDirection: 'row', backgroundColor: '#0D1B2A', borderBottomWidth: 1, borderBottomColor: '#1A2A3A'},
  tab: {flex: 1, paddingVertical: 11, alignItems: 'center'},
  tabActive: {borderBottomWidth: 2, borderBottomColor: '#1A73E8'},
  tabText: {color: '#5A7A94', fontWeight: '600', fontSize: 14},
  tabTextActive: {color: '#1A73E8'},
  subTabBar: {flexDirection: 'row', backgroundColor: '#111E2C', paddingVertical: 6, paddingHorizontal: 12, gap: 8},
  subTab: {paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1A2A3A'},
  subTabActive: {backgroundColor: '#1A73E8'},
  subTabText: {color: '#8BAFC9', fontSize: 13, fontWeight: '600'},
  subTabTextActive: {color: '#fff'},

  // Calendar
  calendarCard: {margin: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: '#1A2A3A'},
  daySummaryRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 12, marginBottom: 8},
  daySummaryDate: {color: '#8BAFC9', fontSize: 13, fontWeight: '600'},
  daySummaryTotal: {fontSize: 15, fontWeight: '700'},
  quickAddRow: {flexDirection: 'row', gap: 10, marginHorizontal: 12, marginBottom: 12},
  quickBtn: {flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center'},
  quickIncome: {backgroundColor: '#1B3A2A', borderWidth: 1, borderColor: '#4CAF50'},
  quickExpense: {backgroundColor: '#3A1B1B', borderWidth: 1, borderColor: '#F44336'},
  quickBtnText: {color: '#E0EAF4', fontWeight: '700', fontSize: 15},

  // Entries
  entryCard: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1A2A3A', marginHorizontal: 12, marginBottom: 8, borderRadius: 12, padding: 14},
  entryLeft: {flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1},
  entryIcon: {fontSize: 22},
  entryLabel: {color: '#E0EAF4', fontWeight: '600', fontSize: 15},
  entryCat: {color: '#8BAFC9', fontSize: 11, marginTop: 2},
  entryRight: {alignItems: 'flex-end', gap: 4},
  entryAmount: {fontWeight: '800', fontSize: 16},
  entryActions: {flexDirection: 'row', gap: 8},
  actionBtn: {padding: 4},
  actionBtnText: {fontSize: 16},

  // Empty
  emptyState: {alignItems: 'center', paddingVertical: 32},
  emptyText: {color: '#8BAFC9', fontSize: 15, fontWeight: '600'},
  emptySub: {color: '#3A5068', fontSize: 13, marginTop: 4},

  // Reports
  navRow: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12},
  navBtn: {padding: 8},
  navArrow: {color: '#1A73E8', fontSize: 28, fontWeight: '300'},
  navTitle: {color: '#E0EAF4', fontSize: 17, fontWeight: '800'},
  cardRow: {flexDirection: 'row', marginHorizontal: 8, marginBottom: 2},

  section: {backgroundColor: '#1A2A3A', marginHorizontal: 12, marginBottom: 12, borderRadius: 14, padding: 14},
  sectionTitle: {color: '#5A7A94', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12},

  // Utilization bar
  utilizationRow: {height: 10, borderRadius: 5, backgroundColor: '#1E3248', overflow: 'hidden', marginBottom: 6},
  utilizationFill: {height: 10, borderRadius: 5},
  utilizationLabel: {color: '#8BAFC9', fontSize: 12},

  // Category rows
  catRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 10},
  catLeft: {width: 130},
  catName: {color: '#E0EAF4', fontSize: 13, fontWeight: '600'},
  catSub: {color: '#5A7A94', fontSize: 11},
  catAmount: {color: '#E0EAF4', fontSize: 13, fontWeight: '700', width: 72, textAlign: 'right'},

  // Top entries
  topRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8},
  topRank: {color: '#5A7A94', fontSize: 13, fontWeight: '700', width: 24},
  topMid: {flex: 1},
  topLabel: {color: '#E0EAF4', fontSize: 13, fontWeight: '600'},
  topCat: {color: '#5A7A94', fontSize: 11},
  topAmt: {color: '#F44336', fontSize: 14, fontWeight: '800'},

  // Yearly chart
  chartArea: {flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 2, marginBottom: 8},
  chartCol: {flex: 1, alignItems: 'center'},
  chartBars: {flexDirection: 'row', alignItems: 'flex-end', gap: 1, marginBottom: 4},
  chartBar: {width: 8, borderRadius: 2},
  chartLabel: {color: '#5A7A94', fontSize: 8, fontWeight: '600'},
  chartLegend: {flexDirection: 'row', gap: 16, justifyContent: 'center'},
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  legendDot: {width: 8, height: 8, borderRadius: 4},
  legendText: {color: '#8BAFC9', fontSize: 11},

  // Table
  tableHeader: {flexDirection: 'row', marginBottom: 6},
  tableHeaderCell: {flex: 1, color: '#5A7A94', fontSize: 11, fontWeight: '700', textAlign: 'right'},
  tableRow: {flexDirection: 'row', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#1E3248'},
  tableMonth: {flex: 1, color: '#8BAFC9', fontSize: 13, fontWeight: '600'},
  tableVal: {flex: 1, fontSize: 12, fontWeight: '600', textAlign: 'right'},
  tableNet: {flex: 1, fontSize: 12, fontWeight: '800', textAlign: 'right'},

  // Modal
  modalOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end'},
  modalCard: {backgroundColor: '#1A2A3A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36},
  modalTitle: {color: '#E0EAF4', fontSize: 20, fontWeight: '800', marginBottom: 20, textAlign: 'center'},
  typeRow: {flexDirection: 'row', gap: 10, marginBottom: 16},
  typeBtn: {flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: '#2A3A4A'},
  typeBtnIncome: {backgroundColor: '#1B3A2A', borderColor: '#4CAF50'},
  typeBtnExpense: {backgroundColor: '#3A1B1B', borderColor: '#F44336'},
  typeBtnText: {color: '#8BAFC9', fontWeight: '600', fontSize: 14},
  typeBtnTextActive: {color: '#E0EAF4'},
  inputLabel: {color: '#8BAFC9', fontSize: 13, fontWeight: '600', marginBottom: 6},
  input: {backgroundColor: '#0D1B2A', color: '#E0EAF4', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 14, borderWidth: 1, borderColor: '#2A3A4A'},
  catPickerBtn: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#0D1B2A', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#2A3A4A'},
  catPickerText: {color: '#E0EAF4', fontSize: 16},
  catPickerArrow: {color: '#8BAFC9', fontSize: 16},
  modalBtns: {flexDirection: 'row', gap: 12, marginTop: 4},
  cancelBtn: {flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center', backgroundColor: '#0D1B2A', borderWidth: 1, borderColor: '#2A3A4A'},
  cancelBtnText: {color: '#8BAFC9', fontWeight: '700', fontSize: 16},
  saveBtn: {flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center'},
  saveBtnText: {color: '#fff', fontWeight: '800', fontSize: 16},

  // Category picker sheet
  catOverlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end'},
  catSheet: {backgroundColor: '#1A2A3A', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '70%'},
  catSheetTitle: {color: '#E0EAF4', fontSize: 17, fontWeight: '800', marginBottom: 12, textAlign: 'center'},
  catOption: {paddingVertical: 14, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#1E3248', flexDirection: 'row', justifyContent: 'space-between'},
  catOptionActive: {backgroundColor: '#0D1B2A'},
  catOptionText: {color: '#8BAFC9', fontSize: 15},
  catOptionTextActive: {color: '#E0EAF4', fontWeight: '700'},
  catCheck: {color: '#1A73E8', fontSize: 16},
});
