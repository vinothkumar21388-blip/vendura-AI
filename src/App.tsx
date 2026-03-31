import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  TrendingUp, 
  Calendar, 
  PlusCircle, 
  BrainCircuit, 
  AlertTriangle, 
  ChevronRight,
  Utensils,
  IndianRupee,
  ShoppingBag,
  Smartphone,
  Info,
  FileUp,
  Trash2,
  ArrowUpCircle,
  Settings
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, addDays, startOfToday, isSameDay, parseISO } from 'date-fns';
import { SaleEntry, BusinessAlert, AIInsight, ItemSale, MenuInsight } from './types.ts';
import { getSalesAnalysis, getUpcomingAlerts, getGrowthPlan, getMenuAnalysis } from './services/gemini.ts';
import * as XLSX from 'xlsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mock initial data
const INITIAL_SALES: SaleEntry[] = [];

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sales' | 'ai'>('dashboard');
  const [selectedLocation, setSelectedLocation] = useState<string>('Saravanampatti');
  const [sales, setSales] = useState<SaleEntry[]>(INITIAL_SALES);
  const [alerts, setAlerts] = useState<BusinessAlert[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [menuInsights, setMenuInsights] = useState<MenuInsight[]>([]);
  const [growthPlan, setGrowthPlan] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [analyzingMenu, setAnalyzingMenu] = useState(false);
  const [uploadingSales, setUploadingSales] = useState(false);
  const [newSale, setNewSale] = useState({ amount: '', orders: '', notes: '' });
  const [isQuickSaleOpen, setIsQuickSaleOpen] = useState(false);

  const filteredSales = useMemo(() => 
    sales.filter(s => s.location === selectedLocation),
    [sales, selectedLocation]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const today = format(startOfToday(), 'yyyy-MM-dd');
      const [alertData, analysisData] = await Promise.all([
        getUpcomingAlerts(today),
        getSalesAnalysis(filteredSales)
      ]);
      setAlerts(alertData.alerts);
      setInsights(analysisData.insights);
      setLoading(false);
    };
    fetchData();
  }, [filteredSales]);

  const handleSalesDataUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      setUploadingSales(true);
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        const newSales: SaleEntry[] = data.map(row => {
          let dateStr = row.Date || row.date || row.Day || row.day || '';
          // Simple date normalization if it's a number (Excel date)
          if (typeof dateStr === 'number') {
            const date = new Date((dateStr - 25569) * 86400 * 1000);
            dateStr = format(date, 'yyyy-MM-dd');
          }
          
          return {
            date: dateStr,
            amount: Number(row.Amount || row.amount || row.Revenue || row.revenue || row.Sales || row.sales || 0),
            orders: Number(row.Orders || row.orders || row.Qty || row.qty || row.Count || row.count || 0),
            location: row.Location || row.location || selectedLocation,
            notes: row.Notes || row.notes || ''
          };
        }).filter(s => s.date && !isNaN(s.amount) && s.amount > 0);

        if (newSales.length > 0) {
          setSales(prev => {
            const combined = [...prev, ...newSales];
            const unique = combined.reduce((acc, curr) => {
              const key = `${curr.date}_${curr.location}`;
              acc[key] = curr;
              return acc;
            }, {} as Record<string, SaleEntry>);
            return (Object.values(unique) as SaleEntry[]).sort((a, b) => a.date.localeCompare(b.date));
          });
        }
      } catch (error) {
        console.error("Error parsing sales excel:", error);
      } finally {
        setUploadingSales(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      setAnalyzingMenu(true);
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as any[];
        
        // Map common column names to ItemSale
        const itemSales: ItemSale[] = data.map(row => ({
          itemName: row.Item || row['Item Name'] || row.Name || row.item_name || '',
          category: row.Category || row.category || 'General',
          quantity: Number(row.Quantity || row.Qty || row.quantity || 0),
          revenue: Number(row.Revenue || row.Sales || row.Amount || row.revenue || 0),
          location: row.Location || row.location || selectedLocation
        })).filter(item => item.itemName);

        if (itemSales.length > 0) {
          const result = await getMenuAnalysis(itemSales);
          const localizedInsights = result.menuInsights.map(insight => ({
            ...insight,
            location: selectedLocation
          }));
          setMenuInsights(prev => {
            const filtered = prev.filter(i => i.location !== selectedLocation);
            return [...filtered, ...localizedInsights];
          });
        }
      } catch (error) {
        console.error("Error parsing excel:", error);
      } finally {
        setAnalyzingMenu(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddSale = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const entry: SaleEntry = {
      date: format(startOfToday(), 'yyyy-MM-dd'),
      amount: Number(newSale.amount),
      orders: Number(newSale.orders),
      location: selectedLocation,
      notes: newSale.notes
    };
    setSales([...sales, entry]);
    setNewSale({ amount: '', orders: '', notes: '' });
    setIsQuickSaleOpen(false);
  };

  const generatePlan = async () => {
    setLoading(true);
    const plan = await getGrowthPlan(filteredSales, `Focus on weekend dinner crowds and local office lunch deliveries for ${selectedLocation}.`);
    setGrowthPlan(plan);
    setLoading(false);
  };

  const totalSales = useMemo(() => filteredSales.reduce((acc, curr) => acc + curr.amount, 0), [filteredSales]);
  const totalOrders = useMemo(() => filteredSales.reduce((acc, curr) => acc + curr.orders, 0), [filteredSales]);
  const avgOrderValue = useMemo(() => totalOrders > 0 ? totalSales / totalOrders : 0, [totalSales, totalOrders]);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-100 font-sans">
      {/* Sidebar / Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-zinc-800 px-6 py-3 flex justify-around items-center z-50 md:top-0 md:bottom-auto md:flex-col md:w-64 md:h-screen md:border-t-0 md:border-r md:justify-start md:pt-12 md:gap-8">
        <div className="hidden md:flex items-center gap-3 mb-12 px-4">
          <div className="bg-white p-2 rounded-xl">
            <Utensils className="text-black w-6 h-6" />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-white">Vendura AI</h1>
        </div>
        
        <NavItem 
          active={activeTab === 'dashboard'} 
          onClick={() => setActiveTab('dashboard')}
          icon={<LayoutDashboard size={20} />}
          label="Dashboard"
        />
        <NavItem 
          active={activeTab === 'sales'} 
          onClick={() => setActiveTab('sales')}
          icon={<TrendingUp size={20} />}
          label="Sales Report"
        />
        <NavItem 
          active={activeTab === 'ai'} 
          onClick={() => setActiveTab('ai')}
          icon={<BrainCircuit size={20} />}
          label="AI Strategist"
        />
      </nav>

      {/* Quick Sale FAB (Mobile Only) */}
      <button 
        onClick={() => setIsQuickSaleOpen(true)}
        className="fixed bottom-20 right-6 z-50 bg-white text-black p-4 rounded-full shadow-2xl md:hidden hover:scale-110 active:scale-95 transition-all"
      >
        <PlusCircle size={28} />
      </button>

      {/* Quick Sale Modal */}
      {isQuickSaleOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Quick Sale Entry</h3>
              <button onClick={() => setIsQuickSaleOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <PlusCircle className="rotate-45" size={24} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Amount (₹)</label>
                <input 
                  type="number" 
                  autoFocus
                  value={newSale.amount}
                  onChange={e => setNewSale({...newSale, amount: e.target.value})}
                  className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-lg font-bold text-white focus:ring-2 focus:ring-white outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Orders</label>
                <input 
                  type="number" 
                  value={newSale.orders}
                  onChange={e => setNewSale({...newSale, orders: e.target.value})}
                  className="w-full bg-zinc-800 border-none rounded-xl px-4 py-3 text-lg font-bold text-white focus:ring-2 focus:ring-white outline-none"
                  placeholder="0"
                />
              </div>
              <button 
                onClick={() => handleAddSale()}
                className="w-full bg-white text-black font-bold py-4 rounded-xl shadow-lg mt-4 hover:bg-zinc-200 transition-colors"
              >
                Save Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pb-24 pt-6 px-4 md:pl-72 md:pt-12 md:pr-12 max-w-7xl mx-auto">
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-1">
              {format(startOfToday(), 'EEEE, MMMM do')}
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-white">
              {activeTab === 'dashboard' && "Business Overview"}
              {activeTab === 'sales' && "Daily Sales Entry"}
              {activeTab === 'ai' && "AI Growth Strategy"}
            </h2>
          </div>
          
          <div className="flex items-center bg-zinc-900 p-1 rounded-2xl border border-zinc-800 shadow-sm w-fit">
            {['Saravanampatti', 'Hopes College'].map((loc) => (
              <button
                key={loc}
                onClick={() => setSelectedLocation(loc)}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap",
                  selectedLocation === loc 
                    ? "bg-white text-black shadow-lg" 
                    : "text-zinc-500 hover:bg-zinc-800"
                )}
              >
                {loc}
              </button>
            ))}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Stats */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard 
                label="Total Revenue" 
                value={`₹${totalSales.toLocaleString()}`} 
                icon={<IndianRupee className="text-emerald-400" />}
                trend="+12%"
              />
              <StatCard 
                label="Total Orders" 
                value={filteredSales.reduce((acc, curr) => acc + curr.orders, 0).toString()} 
                icon={<ShoppingBag className="text-blue-400" />}
                trend="+5%"
              />
              <StatCard 
                label="Avg. Order" 
                value={`₹${Math.round(avgOrderValue)}`} 
                icon={<TrendingUp className="text-zinc-400" />}
                trend="+2%"
              />
            </div>

            {/* Alerts Section */}
            <div id="upcoming-alerts-section" className="lg:row-span-2 bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-lg flex items-center gap-2 text-white">
                  <Calendar className="text-white" size={20} />
                  Upcoming Alerts
                </h3>
                <span className="text-xs font-bold bg-zinc-800 text-zinc-300 px-2 py-1 rounded-full">
                  {alerts.length} New
                </span>
              </div>
              <div className="space-y-4">
                {loading ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-20 bg-zinc-800 rounded-xl" />)}
                  </div>
                ) : alerts.length > 0 ? (
                  alerts.map((alert, idx) => (
                    <div key={idx}>
                      <AlertItem alert={alert} />
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <div className="bg-zinc-800 p-4 rounded-full mb-4">
                      <Calendar className="text-zinc-600" size={32} />
                    </div>
                    <p className="text-sm font-bold text-zinc-300 mb-1">Checking for Special Days...</p>
                    <p className="text-xs text-zinc-500">We're scanning for upcoming Tamil festivals and holidays. If none appear, there are no major events in the next 14 days.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="lg:col-span-2 bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-sm h-[400px]">
              <h3 className="font-bold text-lg mb-6 text-white">Sales Performance</h3>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredSales}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FFFFFF" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#FFFFFF" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1F2937" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#6B7280'}}
                    tickFormatter={(str) => format(parseISO(str), 'MMM d')}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fontSize: 12, fill: '#6B7280'}}
                    tickFormatter={(val) => `₹${val/1000}k`}
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', borderRadius: '12px', border: '1px solid #333', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                    itemStyle={{ color: '#FFF' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#FFFFFF" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorSales)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* AI Insights Summary */}
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.map((insight, idx) => (
                <div key={idx} className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 shadow-sm flex gap-4">
                  <div className={cn(
                    "p-3 rounded-xl h-fit",
                    insight.type === 'growth' && "bg-emerald-500/10 text-emerald-400",
                    insight.type === 'efficiency' && "bg-blue-500/10 text-blue-400",
                    insight.type === 'marketing' && "bg-purple-500/10 text-purple-400"
                  )}>
                    <BrainCircuit size={20} />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm mb-1 text-white">{insight.title}</h4>
                    <p className="text-xs text-zinc-500 leading-relaxed">{insight.content}</p>
                  </div>
                </div>
              ))}
              
              {/* Mobile App Card */}
              <div className="bg-white p-5 rounded-2xl shadow-lg flex gap-4 text-black">
                <div className="p-3 bg-black/10 rounded-xl h-fit">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h4 className="font-bold text-sm mb-1">Install as Mobile App</h4>
                  <p className="text-xs text-black/70 leading-relaxed">
                    Tap your browser's "Share" or "Menu" button and select <strong>"Add to Home Screen"</strong> to use Vendura AI as a dedicated mobile app.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sales' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                  <PlusCircle className="text-white" />
                  Add Today's Sales
                </h3>
                <label className={cn(
                  "cursor-pointer px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
                  uploadingSales ? "bg-zinc-800 text-zinc-600" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}>
                  <FileUp size={14} />
                  {uploadingSales ? "Uploading..." : "Bulk Upload Excel"}
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleSalesDataUpload} disabled={uploadingSales} />
                </label>
              </div>
              <form onSubmit={handleAddSale} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2">Total Sales Amount (₹)</label>
                  <input 
                    type="number" 
                    required
                    value={newSale.amount}
                    onChange={e => setNewSale({...newSale, amount: e.target.value})}
                    className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                    placeholder="e.g. 15000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2">Number of Orders</label>
                  <input 
                    type="number" 
                    required
                    value={newSale.orders}
                    onChange={e => setNewSale({...newSale, orders: e.target.value})}
                    className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all"
                    placeholder="e.g. 50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-400 mb-2">Notes (Optional)</label>
                  <textarea 
                    value={newSale.notes}
                    onChange={e => setNewSale({...newSale, notes: e.target.value})}
                    className="w-full bg-zinc-800 text-white px-4 py-3 rounded-xl border border-zinc-700 focus:ring-2 focus:ring-white focus:border-transparent outline-none transition-all h-24"
                    placeholder="Any special events or reasons for high/low sales?"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-zinc-200 transition-colors shadow-lg"
                >
                  Save Entry
                </button>
              </form>
            </div>

            <div className="space-y-4">
              <h3 className="font-bold text-lg px-2 text-white">Recent History</h3>
              {filteredSales.slice().reverse().map((sale, idx) => (
                <div key={idx} className="bg-zinc-900 p-4 rounded-2xl border border-zinc-800 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-zinc-500 uppercase">{format(parseISO(sale.date), 'EEE, MMM d')}</p>
                    <p className="font-bold text-white">₹{sale.amount.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">{sale.orders} orders</p>
                    <p className="text-xs font-medium text-emerald-400">₹{Math.round(sale.amount/sale.orders)} avg</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="space-y-8">
            <div className="bg-white text-black p-8 rounded-3xl relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-2xl font-bold mb-4">Strategic Growth Planning</h3>
                <p className="text-zinc-600 max-w-xl mb-6">
                  Our AI agent analyzes your sales patterns, local holidays, and Tamil special days to create a customized roadmap for your restaurant's success.
                </p>
                <button 
                  onClick={generatePlan}
                  disabled={loading}
                  className="bg-black hover:bg-zinc-800 text-white px-8 py-3 rounded-xl font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Analyzing..." : "Generate New Growth Plan"}
                  <ChevronRight size={18} />
                </button>
              </div>
              <BrainCircuit className="absolute right-[-20px] bottom-[-20px] w-64 h-64 text-black/5" />
            </div>

            {/* Menu Optimization Section */}
            <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-sm">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 text-white">
                    <Utensils className="text-white" size={24} />
                    Menu Optimization
                  </h3>
                  <p className="text-sm text-zinc-500 mt-1">Upload your item-wise sales Excel to identify winners and losers.</p>
                </div>
                <label className="cursor-pointer bg-white text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all text-center justify-center">
                  <FileUp size={20} />
                  {analyzingMenu ? "Analyzing..." : "Upload Excel"}
                  <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} disabled={analyzingMenu} />
                </label>
              </div>

              {menuInsights.filter(i => i.location === selectedLocation).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {menuInsights.filter(i => i.location === selectedLocation).map((item, idx) => (
                    <div key={idx} className="border border-zinc-800 rounded-2xl p-5 hover:bg-zinc-800/50 transition-all">
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="font-bold text-lg text-white">{item.itemName}</h4>
                        <span className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          item.action === 'promote' && "bg-emerald-500/10 text-emerald-400",
                          item.action === 'remove' && "bg-red-500/10 text-red-400",
                          item.action === 'optimize' && "bg-blue-500/10 text-blue-400"
                        )}>
                          {item.action}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <Info size={14} className="text-zinc-500 mt-0.5 shrink-0" />
                          <p className="text-xs text-zinc-400">{item.reason}</p>
                        </div>
                        <div className="bg-zinc-800 p-3 rounded-xl border border-zinc-700">
                          <p className="text-[10px] font-bold text-zinc-500 uppercase mb-1">AI Suggestion</p>
                          <p className="text-xs font-medium text-zinc-300">{item.suggestion}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-zinc-950 rounded-2xl border border-dashed border-zinc-800">
                  <div className="bg-zinc-900 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-zinc-800">
                    <FileUp className="text-zinc-600" size={24} />
                  </div>
                  <p className="text-zinc-500 font-medium">No menu analysis yet. Upload an Excel file to start.</p>
                  <p className="text-xs text-zinc-600 mt-1">Expected columns: Item Name, Quantity, Revenue</p>
                </div>
              )}
            </div>

            {growthPlan && (
              <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-sm prose prose-invert prose-zinc max-w-none">
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-zinc-800">
                  <div className="bg-zinc-800 p-2 rounded-lg">
                    <Info className="text-white" size={20} />
                  </div>
                  <h4 className="text-xl font-bold m-0 text-white">AI Recommendations</h4>
                </div>
                <div className="whitespace-pre-wrap text-zinc-400 leading-relaxed">
                  {growthPlan}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col md:flex-row items-center gap-1 md:gap-4 px-4 py-2 rounded-xl transition-all w-full md:justify-start",
        active ? "text-white md:bg-zinc-800" : "text-zinc-500 hover:text-zinc-300"
      )}
    >
      {icon}
      <span className="text-[10px] md:text-sm font-bold uppercase tracking-wider md:capitalize md:tracking-normal">{label}</span>
    </button>
  );
}

function StatCard({ label, value, icon, trend }: { label: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800 shadow-sm">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-zinc-800 rounded-lg">{icon}</div>
        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">{trend}</span>
      </div>
      <p className="text-sm font-medium text-zinc-500 mb-1">{label}</p>
      <p className="text-2xl font-bold tracking-tight text-white">{value}</p>
    </div>
  );
}

function AlertItem({ alert }: { alert: BusinessAlert }) {
  const isTamilSpecial = alert.type === 'tamil-special';
  
  return (
    <div className={cn(
      "p-4 rounded-2xl border flex gap-4 transition-all hover:bg-zinc-800/50",
      isTamilSpecial ? "bg-amber-500/5 border-amber-500/20" : "bg-blue-500/5 border-blue-500/20"
    )}>
      <div className={cn(
        "p-2 rounded-xl h-fit",
        isTamilSpecial ? "bg-amber-500/10 text-amber-400" : "bg-blue-500/10 text-blue-400"
      )}>
        {isTamilSpecial ? <AlertTriangle size={18} /> : <Calendar size={18} />}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-sm text-white">{alert.title}</h4>
          <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-500">
            {format(parseISO(alert.date), 'MMM d')}
          </span>
        </div>
        <p className="text-xs text-zinc-400 mb-2 leading-tight">{alert.description}</p>
        <div className="bg-black/20 p-2 rounded-lg border border-white/5">
          <p className="text-[10px] font-bold uppercase text-zinc-600 mb-1">Recommendation</p>
          <p className="text-xs font-medium text-zinc-300">{alert.recommendation}</p>
        </div>
      </div>
    </div>
  );
}
