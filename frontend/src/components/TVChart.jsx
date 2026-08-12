import React, { useEffect, useRef } from 'react';
import { createChart, CrosshairMode, ColorType, CandlestickSeries, LineSeries, HistogramSeries } from 'lightweight-charts';
import { calculateRSI, calculateMACD, calculateSMA } from '../utils/indicators';

export default function TVChart({ data, width, height, setHoveredBar, timeRange }) {
  const priceContainer = useRef();
  const rsiContainer = useRef();
  const macdContainer = useRef();
  
  // Keep refs to chart instances so we can update them without recreating
  const chartsRef = useRef(null);
  
  useEffect(() => {
    if (!data || data.length === 0 || !priceContainer.current || !rsiContainer.current || !macdContainer.current) return;
    
    // Filter out zero-OHLC placeholder rows (no-trade days with corrupt data)
    const rawData = [...data]
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .filter(d => d.close > 0 && d.open > 0);

    const chartData = rawData.map(d => ({
      time: d.date,
      open: d.open,
      high: d.high > 0 ? d.high : d.close,
      low: d.low > 0 ? d.low : d.close,
      close: d.close,
      value: d.volume || 0
    }));

    const commonOptions = {
      width: width,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: '#9aa6a0', fontFamily: "'IBM Plex Mono', monospace" },
      grid: { vertLines: { color: '#1a2420' }, horzLines: { color: '#1a2420' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#22302a' },
      timeScale: { borderColor: '#22302a' },
    };

    // --- MAIN PRICE CHART (60% height) ---
    const priceChart = createChart(priceContainer.current, { ...commonOptions, height: height * 0.6 });
    const candleSeries = priceChart.addSeries(CandlestickSeries, {
      upColor: '#2fd888', downColor: '#e5555a', borderVisible: false,
      wickUpColor: '#2fd888', wickDownColor: '#e5555a', priceFormat: { type: 'price', precision: 2, minMove: 0.01 },
    });
    priceChart.priceScale('right').applyOptions({ mode: 1 }); // 1 = Logarithmic
    candleSeries.setData(chartData);
    
    const sma14Data = calculateSMA(chartData, 14).filter(d => d.value !== null);
    const smaSeries = priceChart.addSeries(LineSeries, { color: '#4b9afb', lineWidth: 1.5, crosshairMarkerVisible: false });
    smaSeries.setData(sma14Data);

    const volumeSeries = priceChart.addSeries(HistogramSeries, {
      color: '#26a69a', priceFormat: { type: 'volume' }, priceScaleId: '',
    });
    priceChart.priceScale('').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeries.setData(chartData.map((d, i) => ({
      time: d.time, value: d.value, color: (i === 0 || d.close >= chartData[i-1].close) ? 'rgba(47, 216, 136, 0.4)' : 'rgba(229, 85, 90, 0.4)'
    })));

    // --- RSI CHART (20% height) ---
    const rsiChart = createChart(rsiContainer.current, { ...commonOptions, height: height * 0.2 });
    const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#9772ea', lineWidth: 1.5 });
    rsiSeries.setData(calculateRSI(chartData, 14).filter(d => d.value !== null));
    
    // Add RSI 30 and 70 lines natively
    rsiSeries.createPriceLine({ price: 70, color: '#5f6b65', lineWidth: 1, lineStyle: 2, title: 'OVERBOUGHT' });
    rsiSeries.createPriceLine({ price: 30, color: '#5f6b65', lineWidth: 1, lineStyle: 2, title: 'OVERSOLD' });

    // --- MACD CHART (20% height) ---
    const macdChart = createChart(macdContainer.current, { ...commonOptions, height: height * 0.2 });
    const macdData = calculateMACD(chartData);
    
    const macdHist = macdChart.addSeries(HistogramSeries, { priceFormat: { type: 'price', precision: 4, minMove: 0.0001 }});
    macdHist.setData(macdData.filter(d => d.histogram !== null).map(d => ({
      time: d.time, value: d.histogram, color: d.histogram >= 0 ? 'rgba(47, 216, 136, 0.8)' : 'rgba(229, 85, 90, 0.8)'
    })));

    const macdLine = macdChart.addSeries(LineSeries, { color: '#4b9afb', lineWidth: 1.5 });
    macdLine.setData(macdData.filter(d => d.macd !== null).map(d => ({ time: d.time, value: d.macd })));
    
    const signalLine = macdChart.addSeries(LineSeries, { color: '#e08a3e', lineWidth: 1.5 });
    signalLine.setData(macdData.filter(d => d.signal !== null).map(d => ({ time: d.time, value: d.signal })));


    // --- SYNC CHARTS ---
    const charts = [priceChart, rsiChart, macdChart];
    chartsRef.current = charts;
    
    // Initial timeframe load
    if (timeRange && timeRange !== 'ALL' && typeof timeRange === 'number') {
      const from = Math.max(0, chartData.length - timeRange);
      charts.forEach(chart => {
        chart.timeScale().setVisibleLogicalRange({ from, to: chartData.length - 1 });
      });
    } else {
      charts.forEach(chart => {
        chart.timeScale().fitContent();
      });
    }

    let isSyncing = false;
    
    const syncTimeRange = (sourceChart) => {
      if (isSyncing) return;
      isSyncing = true;
      const logicalRange = sourceChart.timeScale().getVisibleLogicalRange();
      charts.forEach(c => {
        if (c !== sourceChart && logicalRange !== null) {
          c.timeScale().setVisibleLogicalRange(logicalRange);
        }
      });
      isSyncing = false;
    };

    priceChart.timeScale().subscribeVisibleLogicalRangeChange(() => syncTimeRange(priceChart));
    rsiChart.timeScale().subscribeVisibleLogicalRangeChange(() => syncTimeRange(rsiChart));
    macdChart.timeScale().subscribeVisibleLogicalRangeChange(() => syncTimeRange(macdChart));

    const syncCrosshair = (param, sourceChart) => {
      if (!param.time) {
        charts.forEach(c => { if (c !== sourceChart) c.clearCrosshairPosition() });
        return;
      }
      charts.forEach(c => {
        if (c !== sourceChart) {
          // lightweight-charts crosshair sync is tricky, we can set it by calling setCrosshairPosition but it's not exposed cleanly.
          // However, timeScale syncing is usually enough. For crosshair sync we need a hack, but let's just stick to time syncing for now.
        }
      });
    };
    
    priceChart.subscribeCrosshairMove(param => {
      if (!param.time) {
        setHoveredBar && setHoveredBar(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries);
      const vol = param.seriesData.get(volumeSeries);
      if (bar) {
        setHoveredBar && setHoveredBar({
          time: param.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: vol ? vol.value : null
        });
      }
    });

    return () => {
      charts.forEach(c => c.remove());
      chartsRef.current = null;
    };
  }, [data, width, height]);

  useEffect(() => {
    if (!chartsRef.current || !data || data.length === 0) return;
    
    const charts = chartsRef.current;
    if (timeRange && timeRange !== 'ALL' && typeof timeRange === 'number') {
      const from = Math.max(0, data.length - timeRange);
      charts.forEach(chart => {
        chart.timeScale().setVisibleLogicalRange({ from, to: data.length - 1 });
      });
    } else if (timeRange === 'ALL') {
      charts.forEach(chart => {
        chart.timeScale().fitContent();
      });
    }
  }, [timeRange, data]);

  return (
    <div className="flex flex-col border border-[#22302a] rounded-lg overflow-hidden bg-[#0a0f0c]">
      <div ref={priceContainer} style={{ borderBottom: '1px solid #1a2420' }} />
      <div ref={rsiContainer} style={{ borderBottom: '1px solid #1a2420' }} />
      <div ref={macdContainer} />
    </div>
  );
}
