"use client"

import { createContext, useContext, useState, ReactNode } from "react"
import { Toast, ToastProps } from "./Toast"

interface ToastContextType {
  showToast: (
    message: string,
    type: "success" | "error" | "info",
    duration?: number
  ) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastProps[]>([])

  const showToast = (
    message: string,
    type: "success" | "error" | "info",
    duration = 4000
  ) => {
    const id = Math.random().toString(36).substr(2, 9)
    const toast: ToastProps = {
      id,
      message,
      type,
      duration,
      onRemove: removeToast,
    }
    setToasts((prev) => [...prev, toast])
  }

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Render all toasts */}
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            top: `${1 + index * 5}rem`, // Stack toasts vertically
            zIndex: 50 + index,
          }}
          className="fixed right-4"
        >
          <Toast {...toast} />
        </div>
      ))}
    </ToastContext.Provider>
  )
}
