"use client"

import { useEffect, useState } from "react"

export interface ToastProps {
  id: string
  message: string
  type: "success" | "error" | "info"
  duration?: number
  onRemove: (id: string) => void
}

export function Toast({
  id,
  message,
  type,
  duration = 4000,
  onRemove,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    setTimeout(() => setIsVisible(true), 10)

    // Auto remove after duration
    const timer = setTimeout(() => {
      setIsLeaving(true)
      setTimeout(() => onRemove(id), 300) // Wait for exit animation
    }, duration)

    return () => clearTimeout(timer)
  }, [id, duration, onRemove])

  const handleClose = () => {
    setIsLeaving(true)
    setTimeout(() => onRemove(id), 300)
  }

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return "bg-green-600 text-white border-green-500"
      case "error":
        return "bg-red-600 text-white border-red-500"
      case "info":
      default:
        return "bg-blue-600 text-white border-blue-500"
    }
  }

  const getIcon = () => {
    switch (type) {
      case "success":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        )
      case "error":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )
      case "info":
      default:
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )
    }
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center space-x-3 px-4 py-3 rounded-lg border shadow-lg min-w-[300px] max-w-[400px] transition-all duration-300 ease-in-out ${getTypeStyles()} ${
        isVisible && !isLeaving
          ? "opacity-100 translate-x-0"
          : "opacity-0 translate-x-full"
      }`}
    >
      <div className="flex-shrink-0">{getIcon()}</div>

      <div className="flex-1 text-sm font-medium">{message}</div>

      <button
        onClick={handleClose}
        className="flex-shrink-0 text-white/70 hover:text-white transition-colors cursor-pointer"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  )
}
