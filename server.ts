
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import { optimizeCutting } from './src/lib/optimizer.server.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.API_PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Task storage
const tasks = new Map<string, {
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  result?: any;
  error?: string;
  startTime: number;
  worker?: Worker;
  timeoutHandle?: NodeJS.Timeout;
}>();

// API Routes

// Authentication endpoint for transparent device check
app.post('/api/auth/verify', (req, res) => {
  const { deviceId } = req.body;
  
  if (!deviceId) {
    return res.status(400).json({ success: false, message: '机器码缺失' });
  }

  try {
    const dbDir = path.join(process.cwd(), 'database');
    const dbPath = path.join(dbDir, 'licenses.json');
    
    // Ensure directory exists
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    // Ensure file exists, create with dummy example if not
    if (!fs.existsSync(dbPath)) {
      const defaultExample = {
        "EXAMPLE-DEV": {
          "remark": "张三的电脑",
          "expireDate": "2099-12-31"
        }
      };
      fs.writeFileSync(dbPath, JSON.stringify(defaultExample, null, 2));
    }
    
    const dbContent = fs.readFileSync(dbPath, 'utf-8');
    
    let licenses = {};
    try {
      if (dbContent.trim()) {
        licenses = JSON.parse(dbContent);
      }
    } catch (parseErr) {
       console.error("JSON Parse Error on licenses.json:", parseErr);
       return res.status(500).json({ success: false, message: '后端数据库 JSON 格式错误，请检查 licenses.json 的标点和括号是否成对出现。' });
    }

    const licenseInfo = licenses[deviceId];
    
    // Check if deviceId simply exists in the database
    if (licenseInfo !== undefined) {
      // Validate expiration date if present
      if (typeof licenseInfo === 'object' && licenseInfo !== null && licenseInfo.expireDate) {
        let expDateStr = licenseInfo.expireDate;
        
        // Handle potentially missing leading zeros (e.g., 2026-4-21 -> 2026-04-21)
        const parts = expDateStr.split('-');
        if (parts.length === 3) {
          const year = parts[0];
          const month = parts[1].padStart(2, '0');
          const day = parts[2].padStart(2, '0');
          expDateStr = `${year}-${month}-${day}`;
        }
        
        // Construct date and set to very end of that day (local server time)
        const expDate = new Date(expDateStr + 'T23:59:59.999'); 
        
        // If the date string is malformed or invalid
        if (!isNaN(expDate.getTime()) && new Date() > expDate) {
          return res.json({ success: false, message: `设备授权已于 ${licenseInfo.expireDate} 到期。` });
        }
      }
      res.json({ success: true, license: licenseInfo });
    } else {
      res.json({ success: false, message: `设备 ${deviceId} 未授权，请联系管理员。` });
    }
  } catch (err) {
    console.error("Auth DB Error:", err);
    res.status(500).json({ success: false, error: '验证服务器故障' });
  }
});

app.post('/api/optimize', async (req, res) => {
  const { demands, stocks, fixedPlans, settings, purchases = [] } = req.body;
  const taskId = uuidv4();
  
  console.log(`[Optimizer] Starting task ${taskId} (Worker Mode)`);
  res.json({ taskId });

  try {
    const workerOptions: any = {
      workerData: { demands, stocks, fixedPlans, settings, purchases }
    };
    if (process.execArgv && process.execArgv.length > 0) {
      workerOptions.execArgv = process.execArgv;
    }
    const worker = new Worker(new URL('./optimizer-worker.ts', import.meta.url), workerOptions);

    const timeoutMinutes = (settings && typeof settings.timeoutMinutes === 'number' && settings.timeoutMinutes > 0)
      ? Number(settings.timeoutMinutes)
      : 10;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const timeoutHandle = setTimeout(() => {
      const task = tasks.get(taskId);
      if (task && task.status === 'processing') {
        console.log(`[Optimizer] Task ${taskId} timed out (${timeoutMinutes} minute limit), terminating worker`);
        task.status = 'error';
        task.error = `Optimization timed out (${timeoutMinutes} minute limit)`;
        if (task.worker) {
          task.worker.terminate();
        }
      }
    }, timeoutMs);

    tasks.set(taskId, {
      status: 'processing',
      progress: 5, 
      startTime: Date.now(),
      worker,
      timeoutHandle
    });

    worker.on('message', (message) => {
      const task = tasks.get(taskId);
      if (!task) return;

      if (message.type === 'progress') {
        task.progress = message.progress;
      } else if (message.type === 'completed') {
        console.log(`[Optimizer] Task ${taskId} completed`);
        task.status = 'completed';
        task.progress = 100;
        task.result = message.result;
        if (task.timeoutHandle) clearTimeout(task.timeoutHandle);
        worker.terminate();
      } else if (message.type === 'error') {
        console.error(`[Optimizer] Task ${taskId} worker error:`, message.error);
        task.status = 'error';
        task.error = message.error;
        if (task.timeoutHandle) clearTimeout(task.timeoutHandle);
        worker.terminate();
      }
    });

    worker.on('error', (err) => {
      console.error(`[Optimizer] Task ${taskId} worker fatal error:`, err);
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'error';
        task.error = err.message;
        if (task.timeoutHandle) clearTimeout(task.timeoutHandle);
      }
    });

    worker.on('exit', (code) => {
      if (code !== 0) {
        console.log(`[Optimizer] Task ${taskId} worker exited with code ${code}`);
      }
    });

  } catch (err) {
    console.error(`[Optimizer] Task ${taskId} failed to spawn worker, fallback to main thread:`, err);
    tasks.set(taskId, {
      status: 'processing',
      progress: 5,
      startTime: Date.now()
    });
    optimizeCutting(demands, stocks, fixedPlans, settings, purchases, (p) => {
      const task = tasks.get(taskId);
      if (task && task.status === 'processing') task.progress = p;
    }).then(result => {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'completed';
        task.progress = 100;
        task.result = result;
      }
    }).catch(error => {
      const task = tasks.get(taskId);
      if (task) {
        task.status = 'error';
        task.error = error instanceof Error ? error.message : String(error);
      }
    });
  }
});

app.get('/api/status/:taskId', (req, res) => {
  const task = tasks.get(req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  // Return task info but exclude worker and timeoutHandle to avoid JSON serialization error
  const { worker, timeoutHandle, ...safeTask } = task;
  res.json(safeTask);
});

app.post('/api/cancel/:taskId', (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (task.status === 'processing') {
    console.log(`[Optimizer] Task ${taskId} cancelled by user`);
    task.status = 'error';
    task.error = 'Optimization cancelled by user';
    task.progress = 0;
    if (task.timeoutHandle) {
      clearTimeout(task.timeoutHandle);
    }
    if (task.worker) {
      task.worker.terminate();
    }
    return res.json({ success: true, message: 'Optimization stopped' });
  }
  res.json({ success: false, message: 'Task is not running' });
});

// 1. 让 Express 能够识别并提供 dist 文件夹里的静态资源（js, css, 图片等）
const distPath = path.join(process.cwd(), 'dist'); 
app.use(express.static(distPath));

// 2. 兜底路由：把所有非 API 的请求，全部重定向到 dist/index.html，交给前端 React 路由处理
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// Start explicitly as backend only API server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API Server running on http://localhost:${PORT}`);
});
