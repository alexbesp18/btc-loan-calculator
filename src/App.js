import React, { useState, useEffect, useRef } from 'react';
import { Calculator } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine, // Added for LTV chart thresholds
} from 'recharts';

// --- Constants ---
const MARGIN_CALL_LTV_THRESHOLD = 0.80; // Liquidation LTV (e.g., 80%)
const LTV_WARNING_THRESHOLD = 0.70;    // LTV for warning color (e.g., 70%)
const BTC_PRICE_SIMULATION_VOLATILITY = 0.02;
const MIN_SIMULATED_BTC_PRICE = 1000;
const CHART_DATA_POINTS_LIMIT = 30; // Increased for a bit more history
const BTC_PRICE_SIMULATION_INTERVAL_MS = 5000; // Faster simulation for demo (5 seconds)
const DAYS_PER_SIMULATION_TICK = 1; // Each simulation tick represents 1 day for loan term

// --- Main App Component ---
export default function App() {
  // User input states
  const [btcAmount, setBtcAmount] = useState(1);
  const [loanAmount, setLoanAmount] = useState(25000);
  const [targetLTV, setTargetLTV] = useState(0.5);
  const [interestRate, setInterestRate] = useState(0.05); // Annual
  const [loanTerm, setLoanTerm] = useState(30); // Days
  const [collateralReplenish, setCollateralReplenish] = useState('manual'); // UI only for now
  const [borrowCeiling, setBorrowCeiling] = useState(100000);
  const [reborrowStrategy, setReborrowStrategy] = useState(0.4); // Re-borrow if LTV < this

  // Market data
  const [btcPrice, setBtcPrice] = useState(45000);
  const [priceHistory, setPriceHistory] = useState([]);

  // Calculated & simulation-driven metrics
  const [currentLTV, setCurrentLTV] = useState(0);
  const [availableBorrow, setAvailableBorrow] = useState(0);
  const [liquidationPrice, setLiquidationPrice] = useState(0);
  const [interestAccrued, setInterestAccrued] = useState(0); // Dynamically accrued
  const [chartData, setChartData] = useState([]);
  const [elapsedDays, setElapsedDays] = useState(0); // For loan term simulation

  const prevElapsedDaysRef = useRef(elapsedDays);

  // --- BTC Price Simulation & Day Advancement ---
  const simulateDayPassageAndPrice = () => {
    // Simulate BTC Price Change
    setBtcPrice((prevBtcPrice) => {
      const randomChange = (Math.random() - 0.5) * BTC_PRICE_SIMULATION_VOLATILITY;
      const newPrice = prevBtcPrice * (1 + randomChange);
      const clampedNewPrice = Math.max(newPrice, MIN_SIMULATED_BTC_PRICE);

      const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setPriceHistory((prevHistory) => {
        const newHistory = [...prevHistory, { time: currentTime, price: clampedNewPrice }];
        return newHistory.slice(-CHART_DATA_POINTS_LIMIT);
      });
      return clampedNewPrice;
    });

    // Advance day if loan is ongoing
    setElapsedDays(prevDays => {
      if (prevDays < loanTerm) {
        return prevDays + DAYS_PER_SIMULATION_TICK;
      }
      return prevDays; // Cap at loanTerm
    });
  };

  // --- Core Calculations & Logic (triggered by changes in inputs or simulation) ---
  useEffect(() => {
    let tempLoanAmount = loanAmount; // Use this for calculations within this effect if loanAmount is changed by re-borrowing

    const collateralValue = btcAmount * btcPrice;
    const ltv = collateralValue > 0 ? tempLoanAmount / collateralValue : 0;
    setCurrentLTV(parseFloat(ltv.toFixed(4)));

    // Daily Interest Accrual (if a new day has passed)
    if (elapsedDays > prevElapsedDaysRef.current && elapsedDays <= loanTerm) {
      const dailyRate = interestRate / 365;
      // Interest is calculated on loanAmount *before* potential re-borrowing in this tick
      const interestForThisDay = loanAmount * dailyRate;
      setInterestAccrued(prev => parseFloat((prev + interestForThisDay).toFixed(2)));
    }
    prevElapsedDaysRef.current = elapsedDays;

    // Re-borrowing Logic
    if (
      ltv < reborrowStrategy &&
      ltv > 0 && // Ensure LTV is positive
      tempLoanAmount < borrowCeiling &&
      elapsedDays < loanTerm // Only re-borrow if loan is active
    ) {
      const potentialLoanToReachTargetLTV = collateralValue * targetLTV;
      let amountToReborrow = potentialLoanToReachTargetLTV - tempLoanAmount;

      if (amountToReborrow > 0) {
        if (tempLoanAmount + amountToReborrow > borrowCeiling) {
          amountToReborrow = borrowCeiling - tempLoanAmount;
        }
        if (amountToReborrow > 0.01) { // Only re-borrow if significant enough
          const newLoanAmount = parseFloat((tempLoanAmount + amountToReborrow).toFixed(2));
          setLoanAmount(newLoanAmount); // This will trigger a re-render and this effect will run again
                                        // For current tick, use newLoanAmount in subsequent calculations
          tempLoanAmount = newLoanAmount; // Update tempLoanAmount for current tick's calculations
        }
      }
    }

    // Update dependent metrics using potentially updated tempLoanAmount
    const currentCollateralValue = btcAmount * btcPrice; // Re-calculate if needed, though only BTC price changes it primarily
    const maxBorrowBasedOnTargetLTV = currentCollateralValue * targetLTV;
    setAvailableBorrow(
      parseFloat(Math.max(maxBorrowBasedOnTargetLTV - tempLoanAmount, 0).toFixed(2))
    );

    const liquidationThresholdValue = tempLoanAmount / MARGIN_CALL_LTV_THRESHOLD;
    const liqPrice = btcAmount > 0 ? liquidationThresholdValue / btcAmount : 0;
    setLiquidationPrice(parseFloat(liqPrice.toFixed(2)));

    // Update LTV Chart Data
    const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setChartData((prevData) => {
      const currentActualLtv = currentCollateralValue > 0 ? tempLoanAmount / currentCollateralValue : 0;
      const newLtvDataPoint = { time: currentTime, ltv: parseFloat((currentActualLtv * 100).toFixed(2)) };
      const newData = [...prevData, newLtvDataPoint];
      return newData.slice(-CHART_DATA_POINTS_LIMIT);
    });

  }, [btcAmount, loanAmount, targetLTV, interestRate, loanTerm, btcPrice, elapsedDays, borrowCeiling, reborrowStrategy]);


  // --- Initial Setup & Simulation Interval ---
  useEffect(() => {
    const initialTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setPriceHistory([{ time: initialTime, price: btcPrice }]);

    const initialCollateralValue = btcAmount * btcPrice;
    const initialLtvValue = initialCollateralValue > 0 ? loanAmount / initialCollateralValue : 0;
    setChartData([{ time: initialTime, ltv: parseFloat((initialLtvValue * 100).toFixed(2)) }]);
    
    setElapsedDays(0);
    setInterestAccrued(0);
    prevElapsedDaysRef.current = 0;


    const intervalId = setInterval(simulateDayPassageAndPrice, BTC_PRICE_SIMULATION_INTERVAL_MS);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btcAmount, loanAmount, targetLTV, interestRate, loanTerm]); // Re-init if core loan params change by user for a "new" loan simulation.

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <header className="flex items-center mb-6">
        <Calculator className="h-8 w-8 text-blue-600" />
        <h1 className="text-2xl font-semibold ml-2">Advanced BTC Collateral Loan Calculator</h1>
      </header>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6"> {/* Changed to 3 columns for better layout */}
        {/* Input Form Card (takes 1 column on large screens) */}
        <div className="lg:col-span-1 bg-white p-6 rounded-2xl shadow-md">
          <InputForm
            btcAmount={btcAmount} setBtcAmount={setBtcAmount}
            loanAmount={loanAmount} setLoanAmount={setLoanAmount}
            targetLTV={targetLTV} setTargetLTV={setTargetLTV}
            interestRate={interestRate} setInterestRate={setInterestRate}
            loanTerm={loanTerm} setLoanTerm={setLoanTerm}
            collateralReplenish={collateralReplenish} setCollateralReplenish={setCollateralReplenish}
            borrowCeiling={borrowCeiling} setBorrowCeiling={setBorrowCeiling}
            reborrowStrategy={reborrowStrategy} setReborrowStrategy={setReborrowStrategy}
            elapsedDays={elapsedDays} // Pass for display
          />
        </div>

        {/* Dashboard Card (takes 2 columns on large screens) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-md">
          <Dashboard
            btcPrice={btcPrice}
            currentLTV={currentLTV}
            availableBorrow={availableBorrow}
            liquidationPrice={liquidationPrice}
            interestAccrued={interestAccrued}
            priceHistory={priceHistory}
            chartData={chartData}
            targetLTV={targetLTV} // Pass for chart reference line
            elapsedDays={elapsedDays}
            loanTerm={loanTerm}
          />
        </div>
      </div>
    </div>
  );
}

// --- Input Form Component ---
function InputForm({
  btcAmount, setBtcAmount, loanAmount, setLoanAmount, targetLTV, setTargetLTV,
  interestRate, setInterestRate, loanTerm, setLoanTerm, collateralReplenish, setCollateralReplenish,
  borrowCeiling, setBorrowCeiling, reborrowStrategy, setReborrowStrategy, elapsedDays
}) {
  const handleResetSimulation = () => {
    // This is a bit of a hack. To properly reset, we'd need to lift reset logic to App
    // For now, just reload, or App would need a key prop to force remount, or setters for all states.
    window.location.reload();
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-medium">Loan Parameters</h2>
        <button 
          onClick={handleResetSimulation}
          className="text-sm bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-md"
        >
          Reset Sim
        </button>
      </div>
      <div className="space-y-3"> {/* Reduced space-y */}
        <div>
          <label className="block text-xs font-medium text-gray-700">BTC Collateral</label>
          <input type="number" step="0.01" min="0" value={btcAmount}
            onChange={(e) => setBtcAmount(parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Loan Amount (USD)</label>
          <input type="number" step="100" min="0" value={loanAmount}
            onChange={(e) => setLoanAmount(parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Target LTV (%)</label>
          <input type="number" step="1" min="0" max="90" value={targetLTV * 100}
            onChange={(e) => setTargetLTV((parseFloat(e.target.value) || 0) / 100)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Interest Rate (Annual %)</label>
          <input type="number" step="0.1" min="0" value={interestRate * 100}
            onChange={(e) => setInterestRate((parseFloat(e.target.value) || 0) / 100)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Loan Term (Days: {elapsedDays}/{loanTerm})</label>
          <input type="number" step="1" min="1" value={loanTerm}
            onChange={(e) => setLoanTerm(parseInt(e.target.value, 10) || 1)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Collateral Replenish</label>
          <select value={collateralReplenish} onChange={(e) => setCollateralReplenish(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm">
            <option value="manual">Manual</option>
            <option value="auto" disabled>Auto (Not Implemented)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Borrowing Ceiling (USD)</label>
          <input type="number" step="1000" min="0" value={borrowCeiling}
            onChange={(e) => setBorrowCeiling(parseFloat(e.target.value) || 0)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700">Re-borrow if LTV &lt; (%)</label>
          <input type="number" step="1" min="0" max="90" value={reborrowStrategy * 100}
            onChange={(e) => setReborrowStrategy((parseFloat(e.target.value) || 0) / 100)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm" />
        </div>
      </div>
    </div>
  );
}

// --- Dashboard Component ---
function Dashboard({
  btcPrice, currentLTV, availableBorrow, liquidationPrice, interestAccrued,
  priceHistory, chartData, targetLTV, elapsedDays, loanTerm
}) {
  const getLtvStyle = (ltvDecimal) => {
    if (ltvDecimal >= MARGIN_CALL_LTV_THRESHOLD) return { color: '#ef4444' }; // red-600
    if (ltvDecimal >= LTV_WARNING_THRESHOLD) return { color: '#f97316' }; // orange-500
    return {};
  };

  const loanStatus = elapsedDays >= loanTerm ? " (Term Ended)" : ` (Day ${elapsedDays}/${loanTerm})`;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">Live Dashboard {loanStatus}</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3"> {/* More metrics per row */}
        <MetricCard label="BTC Price (USD)" value={`$${btcPrice.toFixed(2)}`} />
        <MetricCard
          label="Current LTV (%)"
          value={`${(currentLTV * 100).toFixed(2)}%`}
          valueStyle={getLtvStyle(currentLTV)}
        />
        <MetricCard label="Available to Borrow" value={`$${availableBorrow.toFixed(2)}`} />
        <MetricCard
          label="Liquidation Price"
          value={`$${liquidationPrice.toFixed(2)}`}
          valueStyle={btcPrice <= liquidationPrice * 1.1 && liquidationPrice > 0 ? getLtvStyle(MARGIN_CALL_LTV_THRESHOLD) : {}} // Warn if close
        />
        <MetricCard label="Interest Accrued" value={`$${interestAccrued.toFixed(2)}`} />
        <MetricCard label="Elapsed Days" value={`${elapsedDays} / ${loanTerm}`} />

      </div>

      <div className="h-56"> {/* Reduced height for charts */}
        <h3 className="text-base font-medium mb-1">LTV Over Time (%)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis domain={[0, 'autoMax']} tick={{ fontSize: 10 }} tickFormatter={(tick) => `${tick}%`} />
            <Tooltip formatter={(value) => [`${value.toFixed(2)}%`, 'LTV']} />
            <ReferenceLine y={targetLTV * 100} label={{ value: "Target", position: 'insideTopLeft', fontSize: 9, fill: '#4ade80', dy: -2 }} stroke="#4ade80" strokeDasharray="2 2" />
            <ReferenceLine y={MARGIN_CALL_LTV_THRESHOLD * 100} label={{ value: "Margin Call", position: 'insideTopLeft', fontSize: 9, fill: '#ef4444', dy: 10 }} stroke="#ef4444" strokeDasharray="2 2" />
            <Line type="monotone" dataKey="ltv" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="h-56">
        <h3 className="text-base font-medium mb-1">BTC Price History</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={priceHistory} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} tickFormatter={(tick) => `$${Math.round(tick/100)*100}`} /> {/* Rounded ticks */}
            <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, 'Price']} />
            <Line type="monotone" dataKey="price" stroke="#10b981" strokeWidth={2} dot={false} isAnimationActive={false}/>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Metric Card Component (slightly restyled) ---
function MetricCard({ label, value, className = "", valueStyle = {} }) {
  return (
    <div className={`bg-slate-50 p-3 rounded-lg shadow-sm ${className}`}> {/* Changed bg and padding */}
      <p className="text-xs text-slate-500 truncate">{label}</p> {/* Smaller label */}
      <p className="text-lg font-semibold truncate" style={valueStyle}>{value}</p> {/* Larger value */}
    </div>
  );
}