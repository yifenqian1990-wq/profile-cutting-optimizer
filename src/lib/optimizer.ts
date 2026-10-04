export * from './optimizer.server.ts';

/**
 * Frontend placeholder for execution. 
 * The actual implementation is shifted to optimizer.server.ts for Node compatibility.
 */
export async function optimizeCutting(...args: any[]): Promise<any> {
  throw new Error("Local optimization is disabled. Please use the API.");
}
