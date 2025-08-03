import { useState, useEffect } from 'react'

export interface Toast {
  id: string
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'destructive'
  duration?: number
}

interface ToastOptions {
  title?: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'destructive'
  duration?: number
}

let toastCount = 0
const toasts = new Map<string, Toast>()
const listeners = new Set<(toasts: Toast[]) => void>()

function notify() {
  const toastArray = Array.from(toasts.values())
  listeners.forEach(listener => listener(toastArray))
}

function addToast(options: ToastOptions): string {
  const id = `toast-${++toastCount}`
  const toast: Toast = {
    id,
    duration: 5000,
    ...options,
  }
  
  toasts.set(id, toast)
  notify()
  
  if (toast.duration && toast.duration > 0) {
    setTimeout(() => {
      toasts.delete(id)
      notify()
    }, toast.duration)
  }
  
  return id
}

function removeToast(id: string) {
  toasts.delete(id)
  notify()
}

export function useToast() {
  const [toastList, setToastList] = useState<Toast[]>([])
  
  useEffect(() => {
    const updateToasts = (newToasts: Toast[]) => {
      setToastList(newToasts)
    }
    
    listeners.add(updateToasts)
    
    return () => {
      listeners.delete(updateToasts)
    }
  }, [])
  
  return {
    toasts: toastList,
    toast: addToast,
    dismiss: removeToast,
    dismissAll: () => {
      toasts.clear()
      notify()
    },
  }
}