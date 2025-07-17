# AI Performance Refactoring Documentation

## Overview

This refactoring separates AI workload from the main game rendering loop to prevent AI computations from blocking the 60fps render loop. The AI now runs asynchronously with dynamic throttling based on processing performance.

## Architecture

### 1. Main Rendering Loop (60fps target)
- **File**: `src/game/gameLoop.js`
- **Purpose**: Handles rendering, user input, and time-critical game updates
- **Performance**: Always targets 60fps, never blocked by AI

### 2. AI Processing Loop (Dynamic interval)
- **Files**: 
  - `src/ai/aiManager.js` - Main AI coordination
  - `src/ai/aiWorker.js` - Web worker for timing coordination
- **Purpose**: Handles all AI computations asynchronously
- **Performance**: Dynamically adjusts interval based on processing time

## Key Components

### AIManager Class
**Location**: `src/ai/aiManager.js`

**Responsibilities**:
- Coordinates AI processing timing
- Manages web worker communication
- Handles fallback to main thread processing
- Provides performance monitoring

**Key Methods**:
- `startAILoop()` - Start asynchronous AI processing
- `stopAILoop()` - Stop AI processing
- `processAIAsync()` - Process AI with time slicing
- `getPerformanceData()` - Get AI timing metrics

### AI Worker
**Location**: `src/ai/aiWorker.js`

**Responsibilities**:
- Timing coordination without blocking main thread
- Dynamic interval adjustment based on performance
- Performance metric collection

**Features**:
- Base interval: 300ms
- Dynamic scaling when AI takes longer than base interval
- Performance history tracking
- Automatic throttling to prevent overload

### AI Performance Display
**Location**: `src/ui/aiPerformanceDisplay.js`

**Features**:
- Real-time AI performance metrics
- Visual performance history graph
- Toggle with 'J' key
- Shows interval, iteration times, and status

## Dynamic Throttling Algorithm

The AI system automatically adjusts its update frequency based on processing performance:

1. **Base Interval**: 300ms (target for AI updates)
2. **Performance Monitoring**: Tracks last 10 iteration times
3. **Dynamic Adjustment**: 
   - If average iteration time > 300ms: Increase interval
   - Multiplier = ceil(averageTime / baseInterval)
   - Example: 450ms average → 600ms interval (2x)
4. **Limits**:
   - Minimum: 300ms (base interval)
   - Maximum: 2000ms (prevents AI from becoming too slow)

## Integration Points

### GameLoop Integration
```javascript
// In src/game/gameLoop.js
this.aiManager = new AIManager()
this.aiPerformanceDisplay = new AIPerformanceDisplay()

// Start AI when game loop starts
this.startAI()

// Render AI performance metrics
this.aiPerformanceDisplay.render(gameCtx, gameCanvas, aiPerformanceData)
```

### Removed from Main Update Loop
```javascript
// REMOVED from src/updateGame.js
// updateEnemyAI(units, factories, bullets, mapGrid, gameState)

// REPLACED with async AI processing
// AI updates are now handled by AIManager
```

## Controls

### Keyboard Shortcuts
- **J Key**: Toggle AI performance display
- **P Key**: Toggle FPS display (existing)
- **I Key**: Show help/controls (existing)

### Console Commands
Access via browser console:

```javascript
// Check AI performance
debugAI.getPerformance()

// Toggle AI debug mode
debugAI.toggleDebug()

// Show/hide AI performance display
debugAI.showDisplay()
debugAI.hideDisplay()

// Check AI status
debugAI.isAIActive()
debugAI.getCurrentInterval()
```

## Performance Benefits

### Before Refactoring
- AI processing could take 50-200ms per frame
- Caused frame drops when many AI units active
- Rendering locked at AI processing speed
- No way to monitor AI performance impact

### After Refactoring
- Rendering always targets 60fps
- AI runs independently at optimal interval
- Automatic throttling prevents overload
- Real-time performance monitoring
- Graceful degradation under high load

## Performance Monitoring

### Metrics Displayed
1. **Current Interval**: How often AI updates (ms)
2. **Base Interval**: Target interval (300ms)
3. **Average Iteration Time**: Rolling average of last 10 iterations
4. **Last Iteration Time**: Most recent AI processing time
5. **Total Iterations**: Counter of AI updates
6. **AI Loop Status**: Running/Stopped
7. **Processing Status**: Processing/Idle
8. **Performance Graph**: Visual history of iteration times

### Performance Graph
- Shows last 10 iteration times
- Yellow baseline at 300ms (base interval)
- Green line shows actual performance
- Helps identify performance trends

## Fallback Mechanism

If Web Worker fails to initialize:
1. Falls back to main thread processing
2. Still uses time slicing with `requestIdleCallback`
3. Maintains asynchronous behavior
4. Logs warning about suboptimal performance

## Testing

### Development Server
```bash
npm run dev
```

### Manual Testing
1. Start game and observe FPS (should be stable 60fps)
2. Press 'J' to show AI performance display
3. Spawn many AI units to test throttling
4. Monitor interval adjustment under load
5. Verify rendering remains smooth

### Console Testing
```javascript
// Monitor AI performance in real-time
setInterval(() => console.log(debugAI.getPerformance()), 1000)

// Test AI debug mode
debugAI.toggleDebug()

// Check if AI is running
console.log('AI Active:', debugAI.isAIActive())
console.log('Current Interval:', debugAI.getCurrentInterval())
```

## Technical Notes

### Web Worker Limitations
- Cannot directly import ES6 modules (some browsers)
- Limited access to DOM and main thread objects
- Requires structured cloning for data transfer
- Falls back to main thread if worker fails

### Time Slicing Implementation
- Uses `requestIdleCallback` when available
- Falls back to `setTimeout` for compatibility
- Processes AI in small chunks to avoid blocking
- Maintains responsive user interface

### Memory Considerations
- Performance history limited to 10 entries
- Minimal data copying between threads
- Efficient cleanup of references
- No memory leaks in worker communication

## Future Improvements

1. **Enhanced Worker Support**: Full ES6 module support in workers
2. **Smarter Throttling**: Consider game state for interval adjustment
3. **AI Priority System**: Different intervals for different AI tasks
4. **Performance Profiling**: More detailed breakdown of AI operations
5. **Multi-threading**: Separate workers for different AI systems

## Troubleshooting

### Common Issues

1. **AI Not Running**
   - Check console for worker errors
   - Verify `debugAI.isAIActive()` returns true
   - Restart game loop if needed

2. **Poor AI Performance**
   - Check current interval with `debugAI.getCurrentInterval()`
   - Enable debug mode: `debugAI.toggleDebug()`
   - Monitor performance: `debugAI.getPerformance()`

3. **Worker Fails to Load**
   - Check browser console for errors
   - System automatically falls back to main thread
   - Performance may be reduced but game still playable

### Debug Information
- AI performance display shows all key metrics
- Console debug commands provide programmatic access
- Error messages logged to browser console
- Fallback mechanisms ensure game remains playable
