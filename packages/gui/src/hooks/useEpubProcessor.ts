/**
 * EPUB 处理 Hook
 */
import { useState } from 'react';

export interface Task {
  id: string;
  fileName: string;
  action: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  progress: number;
  message?: string;
}

export function useEpubProcessor() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const addTask = (fileName: string, action: string) => {
    const task: Task = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      fileName,
      action,
      status: 'pending',
      progress: 0,
    };
    setTasks((prev) => [...prev, task]);
    return task.id;
  };

  const clearTasks = () => {
    setTasks([]);
  };

  // TODO: Sprint 6 — 对接 Tauri 后端
  const startProcessing = async () => {
    setIsProcessing(true);
    // TODO: 实现
    setIsProcessing(false);
  };

  return { tasks, isProcessing, addTask, clearTasks, startProcessing };
}
