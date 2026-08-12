export function calculateSMA(data, period) {
  const sma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sma.push({ time: data[i].time, value: null });
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    sma.push({ time: data[i].time, value: sum / period });
  }
  return sma;
}

export function calculateEMA(data, period) {
  const ema = [];
  const multiplier = 2 / (period + 1);
  let previousEma = null;

  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      ema.push({ time: data[i].time, value: null });
      if (i === period - 2) {
        // Calculate SMA for the first EMA value
        let sum = 0;
        for (let j = 0; j <= i; j++) {
          sum += data[j].close;
        }
        previousEma = sum / (period - 1);
      }
      continue;
    }

    if (previousEma === null) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        sum += data[i - j].close;
      }
      previousEma = sum / period;
    } else {
      previousEma = (data[i].close - previousEma) * multiplier + previousEma;
    }
    ema.push({ time: data[i].time, value: previousEma });
  }
  return ema;
}

export function calculateRSI(data, period = 14) {
  const rsi = [];
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      rsi.push({ time: data[i].time, value: null });
      continue;
    }

    const change = data[i].close - data[i - 1].close;
    
    if (i <= period) {
      if (change > 0) gains += change;
      else losses -= change;
      
      if (i === period) {
        let avgGain = gains / period;
        let avgLoss = losses / period;
        let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        rsi.push({ time: data[i].time, value: avgLoss === 0 ? 100 : 100 - (100 / (1 + rs)) });
        data[i]._avgGain = avgGain;
        data[i]._avgLoss = avgLoss;
      } else {
        rsi.push({ time: data[i].time, value: null });
      }
      continue;
    }

    const prevAvgGain = data[i - 1]._avgGain;
    const prevAvgLoss = data[i - 1]._avgLoss;
    
    const currentGain = change > 0 ? change : 0;
    const currentLoss = change < 0 ? -change : 0;
    
    const avgGain = (prevAvgGain * (period - 1) + currentGain) / period;
    const avgLoss = (prevAvgLoss * (period - 1) + currentLoss) / period;
    
    data[i]._avgGain = avgGain;
    data[i]._avgLoss = avgLoss;
    
    if (avgLoss === 0) {
      rsi.push({ time: data[i].time, value: 100 });
    } else {
      const rs = avgGain / avgLoss;
      rsi.push({ time: data[i].time, value: 100 - (100 / (1 + rs)) });
    }
  }
  return rsi;
}

export function calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const macd = [];
  const fastEma = calculateEMA(data, fastPeriod);
  const slowEma = calculateEMA(data, slowPeriod);
  
  const macdLine = [];
  
  for (let i = 0; i < data.length; i++) {
    if (fastEma[i].value !== null && slowEma[i].value !== null) {
      macdLine.push({ time: data[i].time, close: fastEma[i].value - slowEma[i].value }); // use 'close' so EMA function can read it
    } else {
      macdLine.push({ time: data[i].time, close: null });
    }
  }
  
  // calculate signal line (EMA of MACD line)
  // We need to filter out nulls for the EMA calculation to work properly
  const validMacdData = macdLine.filter(d => d.close !== null);
  const signalEma = calculateEMA(validMacdData, signalPeriod);
  
  // map signal back to original indices
  let signalIndex = 0;
  
  for (let i = 0; i < data.length; i++) {
    const ml = macdLine[i].close;
    if (ml === null) {
      macd.push({ time: data[i].time, macd: null, signal: null, histogram: null });
    } else {
      const sig = signalEma[signalIndex] ? signalEma[signalIndex].value : null;
      signalIndex++;
      
      const hist = sig !== null ? ml - sig : null;
      
      macd.push({
        time: data[i].time,
        macd: ml,
        signal: sig,
        histogram: hist
      });
    }
  }
  
  return macd;
}
