"use client"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ToastProvider"

interface ImportResult {
  total: number
  processed: number
  added: number
  skipped: number
  errors: string[]
  duplicates: string[]
}

interface ImportBooksModalProps {
  isOpen: boolean
  onClose: () => void
  onBooksAdded?: () => void
}

export default function ImportBooksModal({
  isOpen,
  onClose,
  onBooksAdded,
}: ImportBooksModalProps) {
  const { showToast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showResults, setShowResults] = useState(false)

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen && !isProcessing) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, isProcessing])

  const handleClose = () => {
    if (!isProcessing) {
      setFile(null)
      setProgress(0)
      setResult(null)
      setShowResults(false)
      onClose()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (
        selectedFile.type !== "text/csv" &&
        !selectedFile.name.endsWith(".csv")
      ) {
        showToast("Please select a valid CSV file", "error")
        return
      }
      setFile(selectedFile)
      setResult(null)
      setShowResults(false)
    } else {
      setFile(null)
    }
  }

  const handleImport = async () => {
    if (!file) {
      showToast("Please select a CSV file first", "error")
      return
    }

    setIsProcessing(true)
    setProgress(0)
    setShowResults(false)

    try {
      const formData = new FormData()
      formData.append("csvFile", file)

      const response = await fetch("/api/books/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Import failed")
      }

      // Stream the response to show progress
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (reader) {
        const { value, done } = await reader.read()

        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Look for complete JSON objects in the buffer
        const lines = buffer.split("\n")
        buffer = lines.pop() || "" // Keep incomplete line for next iteration

        for (const line of lines) {
          if (line.trim()) {
            try {
              const data = JSON.parse(line)
              if (data.type === "progress") {
                setProgress(data.progress)
              } else if (data.type === "result") {
                setResult(data.result)
                setShowResults(true)
                setProgress(100)
              }
            } catch (e) {
              // Ignore malformed JSON lines
            }
          }
        }
      }

      showToast(
        `Import completed! Added ${result?.added || 0} books`,
        "success"
      )

      if (onBooksAdded) {
        onBooksAdded()
      }
    } catch (error) {
      console.error("Import error:", error)
      showToast(
        error instanceof Error ? error.message : "Failed to import books",
        "error"
      )
    } finally {
      setIsProcessing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-light text-foreground">
            Import Books from CSV
          </h2>
          <button
            onClick={handleClose}
            disabled={isProcessing}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-6 h-6"
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {!showResults ? (
            <>
              {/* Instructions */}
              <div className="mb-6 p-4 bg-muted/50 rounded-sm">
                <h3 className="font-medium text-foreground mb-2">
                  Instructions
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Export your library from Goodreads as a CSV file</li>
                  <li>• Books will be automatically deduplicated by ISBN</li>
                  <li>• Missing cover images and metadata will be enriched</li>
                  <li>• Only new books will be added to your library</li>
                </ul>
              </div>

              {/* File Upload */}
              <div className="mb-6">
                <label
                  htmlFor="csvFile"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Select CSV File
                </label>
                <input
                  type="file"
                  id="csvFile"
                  accept=".csv,text/csv"
                  onChange={handleFileSelect}
                  disabled={isProcessing}
                  className="block w-full text-sm text-foreground
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-sm file:border-0
                    file:text-sm file:font-medium
                    file:bg-muted file:text-foreground
                    hover:file:bg-muted/80
                    file:cursor-pointer cursor-pointer
                    border border-border rounded-sm
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {file && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {/* Progress */}
              {isProcessing && (
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-foreground mb-2">
                    <span>Processing...</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-foreground h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={handleClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!file || isProcessing}
                  className={`px-6 py-2 text-sm font-medium transition-colors rounded-sm ${
                    !file || isProcessing
                      ? "bg-gray-400 text-gray-600 cursor-not-allowed opacity-50"
                      : "bg-[rgba(45,96,45,0.8)] text-white hover:bg-[#3a7a3a] cursor-pointer"
                  }`}
                >
                  {isProcessing ? "Processing..." : "Import Books"}
                </button>
              </div>
            </>
          ) : (
            /* Results */
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-foreground mb-4">
                  Import Results
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-muted/50 rounded-sm">
                    <div className="text-2xl font-bold text-foreground">
                      {result?.total || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Total books in CSV
                    </div>
                  </div>
                  <div className="p-4 bg-green-500/10 rounded-sm">
                    <div className="text-2xl font-bold text-green-600">
                      {result?.added || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Books added
                    </div>
                  </div>
                  <div className="p-4 bg-yellow-500/10 rounded-sm">
                    <div className="text-2xl font-bold text-yellow-600">
                      {result?.skipped || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Duplicates skipped
                    </div>
                  </div>
                  <div className="p-4 bg-red-500/10 rounded-sm">
                    <div className="text-2xl font-bold text-red-600">
                      {result?.errors?.length || 0}
                    </div>
                    <div className="text-sm text-muted-foreground">Errors</div>
                  </div>
                </div>

                {result?.duplicates && result.duplicates.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-foreground mb-2">
                      Duplicates Found (skipped)
                    </h4>
                    <div className="max-h-32 overflow-y-auto bg-muted/50 rounded-sm p-3">
                      {result.duplicates.map((title, index) => (
                        <div
                          key={index}
                          className="text-sm text-muted-foreground"
                        >
                          {title}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result?.errors && result.errors.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-foreground mb-2">Errors</h4>
                    <div className="max-h-32 overflow-y-auto bg-red-500/10 rounded-sm p-3">
                      {result.errors.map((error, index) => (
                        <div key={index} className="text-sm text-red-600">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleClose}
                  className="px-6 py-2 text-sm font-medium bg-foreground text-primary-foreground hover:bg-primary/90 transition-colors rounded-sm"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
