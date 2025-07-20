window.performanceStatistics = {};

// logs the performance of a function
// Usage: wrap your function with logPerformance(fnName)
// Example: const myFunction = logPerformance(myFunction);
export function logPerformance(functionToWrap, printEachCall = false) {
  return function(...args) {
    const start = performance.now();
    const result = functionToWrap(...args);
    const end = performance.now();
    const duration = end - start;

    // Store performance statistics
    if (!window.performanceStatistics[functionToWrap.name]) {
      window.performanceStatistics[functionToWrap.name] = {
        durationMax: duration,
        durationAvg: duration,
        callCount: 1,
      };
    }
    window.performanceStatistics[functionToWrap.name] = {
      durationMax: Math.max(window.performanceStatistics[functionToWrap.name].durationMax, duration),
      durationAvg: (window.performanceStatistics[functionToWrap.name].durationAvg * window.performanceStatistics[functionToWrap.name].callCount + duration) / (window.performanceStatistics[functionToWrap.name].callCount + 1),
      callCount: window.performanceStatistics[functionToWrap.name].callCount + 1,
    };

    if (printEachCall) {
      console.log(`${functionToWrap.name} took ${JSON.stringify(window.performanceStatistics[functionToWrap.name])}, args: ${JSON.stringify(args)}, `);
    }

    return result;
  };
}