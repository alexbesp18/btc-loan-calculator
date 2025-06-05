import React, { useState, useEffect, useCallback } from 'react';

// --- Constants ---
const DEFAULT_TARGET_LTV = 0.50; // 50%
const DEFAULT_MARGIN_CALL_LTV = 0.70; // 70%
const DEFAULT_LIQUIDATION_LTV = 0.80; // 80%

// --- Helper Functions ---
const formatCurrency = (value, decimals = 2) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '$0.00';
    return `$${num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

const formatBTC = (value, decimals = 6) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.000000 BTC';
    return `${num.toFixed(decimals)} BTC`;
};

const formatPercent = (value, decimals = 1) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '0.0%';
    return `${(num * 100).toFixed(decimals)}%`;
};

// --- Main Application Component ---
function App() {
    // --- PASSWORD PROTECTION ---
    const [authorized, setAuthorized] = useState(
        localStorage.getItem('authorized') === 'true'
    );
    const [password, setPassword] = useState('');

    const handlePasswordSubmit = (e) => {
        e.preventDefault();
        if (password === 'btcvegas2025') {
            localStorage.setItem('authorized', 'true');
            setAuthorized(true);
        } else {
            alert('Incorrect password');
        }
    };

    // --- I. INPUTS & CONTROLS State ---
    // A. My Assets & Market View
    const [collateralInputMode, setCollateralInputMode] = useState('btc'); // 'btc' or 'usd'
    const [btcCollateralAmount, setBtcCollateralAmount] = useState(0.05);
    const [usdCollateralAmount, setUsdCollateralAmount] = useState(3250);
    const [currentBtcPrice, setCurrentBtcPrice] = useState(65000);
    const [annualBtcGrowth, setAnnualBtcGrowth] = useState(20); // Percentage

    // B. Loan Configuration
    const [loanAmountUSD, setLoanAmountUSD] = useState(0);
    const [annualInterestRate, setAnnualInterestRate] = useState(5); // Percentage
    const [targetLtv, setTargetLtv] = useState(DEFAULT_TARGET_LTV);
    const [marginCallLtv, setMarginCallLtv] = useState(DEFAULT_MARGIN_CALL_LTV);
    const [liquidationLtv, setLiquidationLtv] = useState(DEFAULT_LIQUIDATION_LTV);

    // --- II. DASHBOARD State (Calculated) ---
    const [collateralValueUSD, setCollateralValueUSD] = useState(0);
    const [actualBtcAmount, setActualBtcAmount] = useState(0); // Stores the true BTC amount from inputs
    const [currentLtvState, setCurrentLtvState] = useState(0);
    const [liquidationPriceState, setLiquidationPriceState] = useState(0);
    const [bufferToMarginCallUSD, setBufferToMarginCallUSD] = useState(0);
    const [bufferToMarginCallPercent, setBufferToMarginCallPercent] = useState(0);
    const [bufferToLiquidationUSD, setBufferToLiquidationUSD] = useState(0);
    const [bufferToLiquidationPercent, setBufferToLiquidationPercent] = useState(0);
    const [dailyInterestCost, setDailyInterestCost] = useState(0);
    const [monthlyInterestCost, setMonthlyInterestCost] = useState(0);
    const [availableToBorrowUSD, setAvailableToBorrowUSD] = useState(0);
    const [withdrawableCollateralUSD, setWithdrawableCollateralUSD] = useState(0);
    const [withdrawableCollateralBTC, setWithdrawableCollateralBTC] = useState(0);

    // --- III. SCENARIO LAB State ---
    // Tab 1: Price Shock
    const [shockPriceChangeType, setShockPriceChangeType] = useState('percent'); // 'percent' or 'absolute'
    const [shockPriceChangeValue, setShockPriceChangeValue] = useState(-20); // % or new price
    const [shockScenarioResult, setShockScenarioResult] = useState(null);

    // Tab 2: Future Projection
    const [projectionTimeframe, setProjectionTimeframe] = useState(1); // Years
    const [projectionResult, setProjectionResult] = useState(null);
    
    const [activeScenarioTab, setActiveScenarioTab] = useState('priceShock');


    // --- Auto-conversion for Collateral Inputs ---
    useEffect(() => {
        const price = parseFloat(currentBtcPrice) || 0;
        if (collateralInputMode === 'btc') {
            const btc = parseFloat(btcCollateralAmount) || 0;
            if (price > 0) {
                setUsdCollateralAmount(btc * price);
            } else {
                setUsdCollateralAmount(0);
            }
            setActualBtcAmount(btc);
        } else { // mode === 'usd'
            const usd = parseFloat(usdCollateralAmount) || 0;
            if (price > 0) {
                const btc = usd / price;
                setBtcCollateralAmount(btc);
                setActualBtcAmount(btc);
            } else {
                setBtcCollateralAmount(0);
                setActualBtcAmount(0);
            }
        }
    }, [collateralInputMode, btcCollateralAmount, usdCollateralAmount, currentBtcPrice]);


    // --- Calculate Dashboard Data (useEffect for Column 2) ---
    useEffect(() => {
        const price = parseFloat(currentBtcPrice) || 0;
        const btc = parseFloat(actualBtcAmount) || 0;
        const loan = parseFloat(loanAmountUSD) || 0;
        const interest = parseFloat(annualInterestRate) / 100 || 0;

        const currentCollateralValueUSD = btc * price;
        setCollateralValueUSD(currentCollateralValueUSD);

        let ltv = 0;
        if (currentCollateralValueUSD > 0 && loan > 0) {
            ltv = loan / currentCollateralValueUSD;
        }
        setCurrentLtvState(ltv);

        let liqPrice = 0;
        if (btc > 0 && loan > 0 && liquidationLtv > 0) {
            liqPrice = loan / (btc * liquidationLtv);
        }
        setLiquidationPriceState(liqPrice);

        // Buffers
        if (loan > 0 && btc > 0) {
            const priceAtMarginCall = marginCallLtv > 0 ? loan / (btc * marginCallLtv) : 0;
            const priceAtLiquidation = liquidationLtv > 0 ? loan / (btc * liquidationLtv) : 0;

            if (priceAtMarginCall > 0 && price > priceAtMarginCall) {
                const dropToMarginUSD = price - priceAtMarginCall;
                setBufferToMarginCallUSD(dropToMarginUSD);
                setBufferToMarginCallPercent(dropToMarginUSD / price);
            } else {
                setBufferToMarginCallUSD(0);
                setBufferToMarginCallPercent(0);
            }

            if (priceAtLiquidation > 0 && price > priceAtLiquidation) {
                const dropToLiqUSD = price - priceAtLiquidation;
                setBufferToLiquidationUSD(dropToLiqUSD);
                setBufferToLiquidationPercent(dropToLiqUSD / price);
            } else {
                setBufferToLiquidationUSD(0);
                setBufferToLiquidationPercent(0);
            }
        } else {
            setBufferToMarginCallUSD(0);
            setBufferToMarginCallPercent(0);
            setBufferToLiquidationUSD(0);
            setBufferToLiquidationPercent(0);
        }


        // Interest Cost
        const dailyInt = (loan * interest) / 365;
        setDailyInterestCost(dailyInt);
        setMonthlyInterestCost(dailyInt * 30); // Approximate

        // Borrowing Power / Withdrawable Collateral
        const potentialLoanAtTargetLTV = currentCollateralValueUSD * targetLtv;
        if (loan < potentialLoanAtTargetLTV) {
            setAvailableToBorrowUSD(potentialLoanAtTargetLTV - loan);
            setWithdrawableCollateralUSD(0);
            setWithdrawableCollateralBTC(0);
        } else {
            setAvailableToBorrowUSD(0);
            // How much collateral can be withdrawn while maintaining target LTV for the current loan
            // NewCollateralValue * targetLTV = loan  => NewCollateralValue = loan / targetLTV
            // WithdrawableCollateralUSD = currentCollateralValueUSD - (loan / targetLTV)
            if (targetLtv > 0) {
                const minCollateralForTargetLTV = loan / targetLtv;
                const withdrawableUSD = currentCollateralValueUSD - minCollateralForTargetLTV;
                setWithdrawableCollateralUSD(withdrawableUSD > 0 ? withdrawableUSD : 0);
                setWithdrawableCollateralBTC(price > 0 && withdrawableUSD > 0 ? withdrawableUSD / price : 0);
            } else {
                setWithdrawableCollateralUSD(currentCollateralValueUSD - loan > 0 ? currentCollateralValueUSD - loan : 0); // Withdraw all surplus if target LTV is 0
                setWithdrawableCollateralBTC(price > 0 && currentCollateralValueUSD - loan > 0 ? (currentCollateralValueUSD - loan) / price : 0);
            }
        }

    }, [actualBtcAmount, currentBtcPrice, loanAmountUSD, annualInterestRate, targetLtv, marginCallLtv, liquidationLtv]);

    // --- Scenario Lab Logic ---
    const handleRunPriceShock = () => {
        const basePrice = parseFloat(currentBtcPrice) || 0;
        const btc = parseFloat(actualBtcAmount) || 0;
        const currentLoan = parseFloat(loanAmountUSD) || 0;

        let newPrice;
        if (shockPriceChangeType === 'percent') {
            const changePercent = parseFloat(shockPriceChangeValue) / 100 || 0;
            newPrice = basePrice * (1 + changePercent);
        } else { // absolute
            newPrice = parseFloat(shockPriceChangeValue) || 0;
        }
        newPrice = Math.max(0, newPrice); // Price can't be negative

        const newCollateralValue = btc * newPrice;
        const newLtv = newCollateralValue > 0 && currentLoan > 0 ? currentLoan / newCollateralValue : 0;
        const newLiquidationPrice = btc > 0 && currentLoan > 0 && liquidationLtv > 0 ? currentLoan / (btc * liquidationLtv) : 0;

        let suggestions = [];
        if (newLtv >= marginCallLtv && currentLoan > 0) {
            suggestions.push({ type: 'warning', text: `Your LTV is ${formatPercent(newLtv)}, reaching or exceeding margin call LTV of ${formatPercent(marginCallLtv)}.` });
            
            // Collateral needed to avoid margin call
            const collateralNeededForMarginCallLtv = currentLoan / marginCallLtv;
            const topUpToAvoidMargin = collateralNeededForMarginCallLtv - newCollateralValue;
            if (topUpToAvoidMargin > 0) {
                suggestions.push({
                    type: 'action',
                    text: `To avoid margin call (at ${formatPercent(marginCallLtv)}): Add ${formatCurrency(topUpToAvoidMargin)} (${formatBTC(newPrice > 0 ? topUpToAvoidMargin / newPrice : 0)}) collateral.`
                });
            }
            
            // Collateral needed to return to target LTV
            const collateralNeededForTargetLtv = currentLoan / targetLtv;
            const topUpToTarget = collateralNeededForTargetLtv - newCollateralValue;
             if (topUpToTarget > 0) {
                suggestions.push({
                    type: 'action',
                    text: `To return to Target LTV (at ${formatPercent(targetLtv)}): Add ${formatCurrency(topUpToTarget)} (${formatBTC(newPrice > 0 ? topUpToTarget / newPrice : 0)}) collateral.`
                });
            }
            
            // Repay loan to return to target LTV
            // newCollateralValue * targetLTV = newLoanAmount
            const loanToReachTargetLTV = newCollateralValue * targetLtv;
            const repayAmount = currentLoan - loanToReachTargetLTV;
            if (repayAmount > 0) {
                 suggestions.push({
                    type: 'action',
                    text: `Alternatively, to return to Target LTV: Repay ${formatCurrency(repayAmount)} of your loan.`
                });
            }

        } else if (newLtv < targetLtv && newLtv > 0 && currentLoan > 0) {
             suggestions.push({ type: 'opportunity', text: `Your LTV is ${formatPercent(newLtv)}.` });
            const potentialLoanAtTarget = newCollateralValue * targetLtv;
            const additionalBorrow = potentialLoanAtTarget - currentLoan;
            if (additionalBorrow > 0) {
                suggestions.push({
                    type: 'action',
                    text: `You could borrow an additional ${formatCurrency(additionalBorrow)} to reach your Target LTV (${formatPercent(targetLtv)}).`
                });
            }
            // Withdrawable collateral
            if (targetLtv > 0) {
                const minCollateralForTarget = currentLoan / targetLtv;
                const withdrawableUSDShock = newCollateralValue - minCollateralForTarget;
                if (withdrawableUSDShock > 0) {
                    suggestions.push({
                        type: 'action',
                        text: `Alternatively, you could withdraw ${formatCurrency(withdrawableUSDShock)} (${formatBTC(newPrice > 0 ? withdrawableUSDShock / newPrice : 0)}) of collateral and maintain Target LTV.`
                    });
                }
            }
        } else if (currentLoan === 0 && newCollateralValue > 0) {
            const potentialLoanAtTarget = newCollateralValue * targetLtv;
            suggestions.push({ type: 'opportunity', text: `With no current loan and collateral at ${formatCurrency(newCollateralValue)}, you could borrow up to ${formatCurrency(potentialLoanAtTarget)} at your target LTV (${formatPercent(targetLtv)}).` });
        }


        if (newLtv >= liquidationLtv && currentLoan > 0) {
            suggestions.unshift({ type: 'danger', text: `DANGER! Your LTV is ${formatPercent(newLtv)}, at or exceeding Liquidation LTV of ${formatPercent(liquidationLtv)}. Liquidation imminent without immediate action!` });
        }

        setShockScenarioResult({
            newPrice,
            originalPrice: basePrice,
            newCollateralValue,
            newLtv,
            newLiquidationPrice,
            suggestions,
        });
    };

    const handleRunProjection = () => {
        const years = parseFloat(projectionTimeframe) || 0;
        const growth = parseFloat(annualBtcGrowth) / 100 || 0;
        const P = parseFloat(currentBtcPrice) || 0; // Principal BTC price
        const loan = parseFloat(loanAmountUSD) || 0;
        const btc = parseFloat(actualBtcAmount) || 0;
        const currentInterestRate = parseFloat(annualInterestRate) / 100 || 0;


        const projectedBtcPrice = P * Math.pow((1 + growth), years);
        const projectedCollateralValue = btc * projectedBtcPrice;
        const projectedLtv = projectedCollateralValue > 0 && loan > 0 ? loan / projectedCollateralValue : 0;
        
        let projectedAvailableToBorrow = 0;
        if (projectedCollateralValue > 0) {
            const potentialLoanAtTarget = projectedCollateralValue * targetLtv;
            if (loan < potentialLoanAtTarget) {
                projectedAvailableToBorrow = potentialLoanAtTarget - loan;
            }
        }

        // Simplified total interest paid (assumes loan amount is constant)
        const totalInterestPaid = loan * currentInterestRate * years;


        setProjectionResult({
            years,
            annualBtcGrowth,
            projectedBtcPrice,
            projectedCollateralValue,
            projectedLtv,
            projectedAvailableToBorrow,
            totalInterestPaid,
        });
    };
    
    const resetInputs = () => {
        setCollateralInputMode('btc');
        setBtcCollateralAmount(0.05);
        // setUsdCollateralAmount(3250); // will be auto-calculated
        setCurrentBtcPrice(65000);
        setAnnualBtcGrowth(20);
        setLoanAmountUSD(0);
        setAnnualInterestRate(5);
        setTargetLtv(DEFAULT_TARGET_LTV);
        setMarginCallLtv(DEFAULT_MARGIN_CALL_LTV);
        setLiquidationLtv(DEFAULT_LIQUIDATION_LTV);
        setShockScenarioResult(null);
        setProjectionResult(null);
    };


    // --- JSX Structure ---
    // Basic styling for layout - replace with your preferred CSS framework/classes
    const styles = {
        container: { display: 'flex', flexDirection: 'row', padding: '20px', gap: '20px', fontFamily: 'Arial, sans-serif' },
        column: { flex: 1, padding: '15px', border: '1px solid #eee', borderRadius: '8px', backgroundColor: '#f9f9f9' },
        inputGroup: { marginBottom: '15px' },
        label: { display: 'block', marginBottom: '5px', fontSize: '0.9em', color: '#555' },
        input: { width: 'calc(100% - 10px)', padding: '8px', border: '1px solid #ddd', borderRadius: '4px', marginBottom: '5px' },
        button: { padding: '10px 15px', border: 'none', borderRadius: '4px', backgroundColor: '#007bff', color: 'white', cursor: 'pointer', marginRight: '10px' },
        tabs: { display: 'flex', marginBottom: '10px', borderBottom: '1px solid #ddd' },
        tabButton: (isActive) => ({
            padding: '10px 15px',
            border: 'none',
            borderBottom: isActive ? '2px solid #007bff' : '2px solid transparent',
            cursor: 'pointer',
            backgroundColor: isActive ? '#e7f3ff' : 'transparent',
            fontWeight: isActive ? 'bold' : 'normal'
        }),
        metric: { marginBottom: '10px', padding: '8px', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #eee' },
        metricLabel: { fontSize: '0.85em', color: '#777' },
        metricValue: { fontSize: '1.1em', fontWeight: 'bold', color: '#333' },
        suggestion: (type) => ({
            padding: '10px',
            margin: '10px 0',
            borderRadius: '4px',
            borderLeft: `5px solid ${type === 'danger' ? 'red' : type === 'warning' ? 'orange' : type === 'opportunity' ? 'green' : 'blue'}`,
            backgroundColor: type === 'danger' ? '#ffebee' : type === 'warning' ? '#fff3e0' : type === 'opportunity' ? '#e8f5e9' : '#e3f2fd',
        }),
        ltvGaugeContainer: { width: '100%', backgroundColor: '#e0e0e0', borderRadius: '4px', height: '20px', overflow: 'hidden', marginBottom: '5px' },
        ltvGaugeBar: (ltv, marginLtv, liqLtv) => {
            let color = '#4caf50'; // Green
            if (ltv >= liqLtv) color = '#f44336'; // Red
            else if (ltv >= marginLtv) color = '#ff9800'; // Orange
            return { width: `${Math.min(ltv * 100, 100)}%`, backgroundColor: color, height: '100%', transition: 'width 0.3s ease, background-color 0.3s ease' };
        }
    };
    
    // Responsive adjustments (conceptual - real responsiveness needs CSS media queries)
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    if (isMobile) {
        styles.container.flexDirection = 'column';
    }


    if (!authorized) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <h2>Please Enter Password</h2>
                <form onSubmit={handlePasswordSubmit} style={{ marginBottom: '20px' }}>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ padding: '8px', fontSize: '16px' }}
                    />
                    <button type="submit" style={{ marginLeft: '10px', padding: '8px 12px' }}>
                        Enter
                    </button>
                </form>
                <a
                    href="https://paypal.me/AlexanderBespalov440/20"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    <button>Request Password ($20 lifetime access)</button>
                </a>
            </div>
        );
    }

    return (
        <div style={styles.container}>
            {/* --- Column 1: INPUTS & CONTROLS --- */}
            <div style={styles.column}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <h2>Inputs & Controls</h2>
                    <button onClick={resetInputs} style={{...styles.button, backgroundColor: '#6c757d', fontSize: '0.8em'}}>Reset All</button>
                </div>

                <div style={{borderBottom: '1px solid #ccc', marginBottom: '15px', paddingBottom: '10px'}}>
                    <h4>A. My Assets & Market View</h4>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Collateral Input Mode:</label>
                        <select value={collateralInputMode} onChange={e => setCollateralInputMode(e.target.value)} style={styles.input}>
                            <option value="btc">BTC Amount</option>
                            <option value="usd">USD Value</option>
                        </select>
                    </div>
                    {collateralInputMode === 'btc' ? (
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>BTC Collateral Amount:</label>
                            <input type="number" step="0.000001" value={btcCollateralAmount} onChange={e => setBtcCollateralAmount(parseFloat(e.target.value) || 0)} style={styles.input} />
                            <span style={{fontSize: '0.8em'}}>Equals: {formatCurrency(usdCollateralAmount)} (at current price)</span>
                        </div>
                    ) : (
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>USD Collateral Value:</label>
                            <input type="number" step="0.01" value={usdCollateralAmount} onChange={e => setUsdCollateralAmount(parseFloat(e.target.value) || 0)} style={styles.input} />
                            <span style={{fontSize: '0.8em'}}>Equals: {formatBTC(btcCollateralAmount)} (at current price)</span>
                        </div>
                    )}
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Current BTC Price (USD):</label>
                        <input type="number" step="0.01" value={currentBtcPrice} onChange={e => setCurrentBtcPrice(parseFloat(e.target.value) || 0)} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Projected Annual BTC Price Growth (%):</label>
                        <input type="number" step="1" value={annualBtcGrowth} onChange={e => setAnnualBtcGrowth(parseFloat(e.target.value) || 0)} style={styles.input} />
                    </div>
                </div>

                <div style={{borderBottom: '1px solid #ccc', marginBottom: '15px', paddingBottom: '10px'}}>
                    <h4>B. Loan Configuration</h4>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Current Loan Amount (USD):</label>
                        <input type="number" step="0.01" value={loanAmountUSD} onChange={e => setLoanAmountUSD(parseFloat(e.target.value) || 0)} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Annual Interest Rate (%):</label>
                        <input type="number" step="0.1" value={annualInterestRate} onChange={e => setAnnualInterestRate(parseFloat(e.target.value) || 0)} style={styles.input} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Target LTV for Borrowing: {formatPercent(targetLtv)}</label>
                        <input type="range" min="0" max="0.9" step="0.01" value={targetLtv} onChange={e => setTargetLtv(parseFloat(e.target.value))} style={{...styles.input, padding: 0}} />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Margin Call LTV: {formatPercent(marginCallLtv)}</label>
                        <input type="range" min="0" max="0.95" step="0.01" value={marginCallLtv} onChange={e => setMarginCallLtv(parseFloat(e.target.value))} style={{...styles.input, padding: 0}} />
                    </div>
                     <div style={styles.inputGroup}>
                        <label style={styles.label}>Liquidation LTV: {formatPercent(liquidationLtv)}</label>
                        <input type="range" min="0" max="0.99" step="0.01" value={liquidationLtv} onChange={e => setLiquidationLtv(parseFloat(e.target.value))} style={{...styles.input, padding: 0}} />
                    </div>
                </div>
            </div>

            {/* --- Column 2: DASHBOARD --- */}
            <div style={styles.column}>
                <h2>Dashboard: Current Position</h2>
                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Collateral Value:</div>
                    <div style={styles.metricValue}>{formatCurrency(collateralValueUSD)} ({formatBTC(actualBtcAmount)})</div>
                </div>
                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Current LTV:</div>
                    <div style={styles.metricValue}>{formatPercent(currentLtvState)}</div>
                    <div style={styles.ltvGaugeContainer}>
                        <div style={styles.ltvGaugeBar(currentLtvState, marginCallLtv, liquidationLtv)}></div>
                    </div>
                    <div style={{fontSize: '0.75em', display: 'flex', justifyContent: 'space-between'}}>
                        <span>Target: {formatPercent(targetLtv)}</span>
                        <span>Margin Call: {formatPercent(marginCallLtv)}</span>
                        <span>Liq: {formatPercent(liquidationLtv)}</span>
                    </div>
                </div>
                 <div style={styles.metric}>
                    <div style={styles.metricLabel}>Liquidation Price (BTC):</div>
                    <div style={styles.metricValue}>{loanAmountUSD > 0 ? formatCurrency(liquidationPriceState) : 'N/A'}</div>
                </div>
                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Price Buffer to Margin Call:</div>
                    <div style={styles.metricValue}>{loanAmountUSD > 0 ? `${formatCurrency(bufferToMarginCallUSD)} (${formatPercent(bufferToMarginCallPercent)})` : 'N/A'}</div>
                </div>
                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Price Buffer to Liquidation:</div>
                    <div style={styles.metricValue}>{loanAmountUSD > 0 ? `${formatCurrency(bufferToLiquidationUSD)} (${formatPercent(bufferToLiquidationPercent)})` : 'N/A'}</div>
                </div>
                 <div style={styles.metric}>
                    <div style={styles.metricLabel}>Current Loan (USD):</div>
                    <div style={styles.metricValue}>{formatCurrency(loanAmountUSD)}</div>
                </div>
                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Est. Interest Cost:</div>
                    <div style={styles.metricValue}>{formatCurrency(dailyInterestCost)}/day ({formatCurrency(monthlyInterestCost)}/month)</div>
                </div>
                <div style={styles.metric}>
                    <div style={styles.metricLabel}>Borrowing Power:</div>
                    {availableToBorrowUSD > 0.01 ? (
                        <div style={styles.metricValue}>Available to Borrow (to Target LTV): {formatCurrency(availableToBorrowUSD)}</div>
                    ) : withdrawableCollateralUSD > 0.01 && loanAmountUSD > 0 ? (
                        <div style={styles.metricValue}>Collateral Surplus: Withdraw {formatCurrency(withdrawableCollateralUSD)} ({formatBTC(withdrawableCollateralBTC)}) to maintain Target LTV.</div>
                    ) : loanAmountUSD === 0 ? (
                         <div style={styles.metricValue}>Can borrow up to {formatCurrency(collateralValueUSD * targetLtv)} at Target LTV.</div>
                    ): (
                        <div style={styles.metricValue}>LTV at or above target. No immediate additional borrowing at target LTV.</div>
                    )}
                </div>
            </div>

            {/* --- Column 3: SCENARIO LAB & PROJECTIONS --- */}
            <div style={styles.column}>
                <h2>Scenario Lab & Projections</h2>
                <div style={styles.tabs}>
                    <button style={styles.tabButton(activeScenarioTab === 'priceShock')} onClick={() => setActiveScenarioTab('priceShock')}>Price Shock Scenarios</button>
                    <button style={styles.tabButton(activeScenarioTab === 'growthProjection')} onClick={() => setActiveScenarioTab('growthProjection')}>Future Growth Projection</button>
                </div>

                {activeScenarioTab === 'priceShock' && (
                    <div>
                        <h4>Price Shock Scenario</h4>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Simulate BTC Price Change By:</label>
                            <select value={shockPriceChangeType} onChange={e => setShockPriceChangeType(e.target.value)} style={styles.input}>
                                <option value="percent">% Change</option>
                                <option value="absolute">New Absolute Price (USD)</option>
                            </select>
                        </div>
                        <div style={styles.inputGroup}>
                             <label style={styles.label}>Value ({shockPriceChangeType === 'percent' ? '%' : 'USD'}):</label>
                            <input type="number" value={shockPriceChangeValue} onChange={e => setShockPriceChangeValue(parseFloat(e.target.value))} style={styles.input} />
                        </div>
                        <button onClick={handleRunPriceShock} style={styles.button}>Analyze Price Shock</button>
                        {shockScenarioResult && (
                            <div style={{marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '15px'}}>
                                <h5>Scenario Result: BTC price from {formatCurrency(shockScenarioResult.originalPrice)} to {formatCurrency(shockScenarioResult.newPrice)}</h5>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>New Collateral Value:</div>
                                    <div style={styles.metricValue}>{formatCurrency(shockScenarioResult.newCollateralValue)}</div>
                                </div>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>New LTV:</div>
                                    <div style={styles.metricValue}>{formatPercent(shockScenarioResult.newLtv)}</div>
                                </div>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>New Liquidation Price:</div>
                                    <div style={styles.metricValue}>{loanAmountUSD > 0 ? formatCurrency(shockScenarioResult.newLiquidationPrice) : 'N/A'}</div>
                                </div>
                                <h6>Suggestions:</h6>
                                {shockScenarioResult.suggestions.length > 0 ? shockScenarioResult.suggestions.map((s, i) => (
                                    <div key={i} style={styles.suggestion(s.type)}>{s.text}</div>
                                )) : <p>No specific actions suggested based on this change and your LTV targets.</p>}
                            </div>
                        )}
                    </div>
                )}

                {activeScenarioTab === 'growthProjection' && (
                     <div>
                        <h4>Future Growth Projection</h4>
                        <div style={styles.inputGroup}>
                            <label style={styles.label}>Project for Timeframe (Years):</label>
                             <input type="number" step="0.25" min="0.25" value={projectionTimeframe} onChange={e => setProjectionTimeframe(parseFloat(e.target.value) || 0)} style={styles.input} />
                        </div>
                         <button onClick={handleRunProjection} style={styles.button}>Run Projection</button>
                        {projectionResult && (
                            <div style={{marginTop: '15px', borderTop: '1px dashed #ccc', paddingTop: '15px'}}>
                                <h5>Projection for {projectionResult.years} Years at {formatPercent(projectionResult.annualBtcGrowth/100)} annual growth</h5>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>Projected BTC Price:</div>
                                    <div style={styles.metricValue}>{formatCurrency(projectionResult.projectedBtcPrice)}</div>
                                </div>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>Projected Collateral Value:</div>
                                    <div style={styles.metricValue}>{formatCurrency(projectionResult.projectedCollateralValue)}</div>
                                </div>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>Projected LTV (if loan unchanged):</div>
                                    <div style={styles.metricValue}>{loanAmountUSD > 0 ? formatPercent(projectionResult.projectedLtv) : 'N/A (No Loan)'}</div>
                                </div>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>Projected Additional Borrowing Power (to Target LTV):</div>
                                    <div style={styles.metricValue}>{formatCurrency(projectionResult.projectedAvailableToBorrow)}</div>
                                </div>
                                <div style={styles.metric}>
                                    <div style={styles.metricLabel}>Est. Total Interest Paid (if loan unchanged):</div>
                                    <div style={styles.metricValue}>{loanAmountUSD > 0 ? formatCurrency(projectionResult.totalInterestPaid) : '$0.00'}</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;