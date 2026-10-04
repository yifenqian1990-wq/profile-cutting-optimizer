
import { parentPort, workerData } from 'worker_threads';
import { optimizeCutting } from './src/lib/optimizer.server.ts';

async function run() {
  console.log('[Worker] Worker thread started');
  try {
    const { demands, stocks, fixedPlans, settings, purchases = [] } = workerData;
    console.log(`[Worker] Starting optimization for ${demands.length} demands`);
    
    const result = await optimizeCutting(
      demands, 
      stocks, 
      fixedPlans, 
      settings,
      purchases,
      (progress) => {
        parentPort?.postMessage({ type: 'progress', progress });
      }
    );
    
    parentPort?.postMessage({ type: 'completed', result });
  } catch (error) {
    parentPort?.postMessage({ 
      type: 'error', 
      error: error instanceof Error ? `${error.message}\n${error.stack}` : String(error) 
    });
  }
}

run();
