"use client"
import { useState, useRef, useCallback } from "react"
import { UploadDropzone } from "@uploadthing/react"
import type { OurFileRouter } from "@/app/api/uploadthing/core"

type Book = {
  id?: string
  isbn?: string
  title: string
  author: string
  type?: string
  coverUrl?: string
  notes?: string
  price?: string
  publisher?: string
  year?: string
  url?: string
  edition?: string
  language?: string
  sellingprice?: string
  notforsale?: boolean
  rowIndex: number
}

interface EditBookModalProps {
  book: Book
  isOpen: boolean
  onClose: () => void
  onSave: (updatedBook: Book) => Promise<void>
}

// Image resizing utility function
const resizeImage = (
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    const img = new Image()

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img

      if (width > height) {
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }
      } else {
        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }
      }

      canvas.width = width
      canvas.height = height

      // Draw and resize image
      ctx?.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            const resizedFile = new File([blob], file.name, {
              type: file.type,
              lastModified: Date.now(),
            })
            resolve(resizedFile)
          }
        },
        file.type,
        0.9
      )
    }

    img.src = URL.createObjectURL(file)
  })
}

export default function EditBookModal({
  book,
  isOpen,
  onClose,
  onSave,
}: EditBookModalProps) {
  const [formData, setFormData] = useState<Book>(book)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleInputChange = (field: keyof Book, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    // If upload is in progress, wait for it to complete
    if (isUploading) {
      alert("Please wait for the image upload to complete before saving.")
      return
    }

    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error("Error saving book:", error)
      alert("Failed to save book changes. Please try again.")
    } finally {
      setIsSaving(false)
    }
  }

  const handleImageUpload = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    const file = files[0]
    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Resize image if needed
      const resizedFile = await resizeImage(file, 400, 400)

      // Create FormData for upload
      const formData = new FormData()
      formData.append("file", resizedFile)

      // Upload to uploadthing
      const response = await fetch("/api/uploadthing", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setFormData((prev) => ({ ...prev, coverUrl: result.url }))
      }
    } catch (error) {
      console.error("Upload failed:", error)
      alert("Image upload failed. Please try again.")
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-light text-foreground">Edit Book</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
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
        <div className="p-6 space-y-6">
          {/* Cover Image Section */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Cover Image
            </label>
            <div className="flex items-start space-x-4">
              {formData.coverUrl && (
                <div className="flex-shrink-0">
                  <img
                    src={formData.coverUrl}
                    alt={formData.title}
                    className="w-24 h-32 object-cover rounded border border-border"
                  />
                </div>
              )}
              <div className="flex-1">
                <UploadDropzone<OurFileRouter, "bookCoverUploader">
                  endpoint="bookCoverUploader"
                  onClientUploadComplete={(res) => {
                    if (res?.[0]?.url) {
                      setFormData((prev) => ({ ...prev, coverUrl: res[0].url }))
                    }
                  }}
                  onUploadError={(error: Error) => {
                    alert(`Upload error: ${error.message}`)
                  }}
                  onUploadBegin={() => {
                    setIsUploading(true)
                  }}
                  className="ut-label:text-foreground ut-allowed-content:text-muted-foreground ut-button:bg-[rgba(96,96,96,0.5)] ut-button:ut-readying:bg-[rgba(96,96,96,0.3)]"
                />
                {isUploading && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    Uploading and resizing image...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Author
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => handleInputChange("author", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                ISBN
              </label>
              <input
                type="text"
                value={formData.isbn || ""}
                onChange={(e) => handleInputChange("isbn", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Publisher
              </label>
              <input
                type="text"
                value={formData.publisher || ""}
                onChange={(e) => handleInputChange("publisher", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Year
              </label>
              <input
                type="text"
                value={formData.year || ""}
                onChange={(e) => handleInputChange("year", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Edition
              </label>
              <input
                type="text"
                value={formData.edition || ""}
                onChange={(e) => handleInputChange("edition", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Price
              </label>
              <input
                type="text"
                value={formData.price || ""}
                onChange={(e) => handleInputChange("price", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                placeholder="€19.99"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Language
              </label>
              <select
                value={formData.language || ""}
                onChange={(e) => handleInputChange("language", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              >
                <option value="">Select language</option>
                <option value="English">English</option>
                <option value="Dutch">Dutch</option>
                <option value="German">German</option>
                <option value="French">French</option>
                <option value="Spanish">Spanish</option>
                <option value="Italian">Italian</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Japanese">Japanese</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Selling Price
              </label>
              <input
                type="text"
                value={formData.sellingprice || ""}
                onChange={(e) =>
                  handleInputChange("sellingprice", e.target.value)
                }
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                placeholder="€25.00 (price you sell for)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                URL
              </label>
              <input
                type="url"
                value={formData.url || ""}
                onChange={(e) => handleInputChange("url", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                placeholder="https://..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes || ""}
              onChange={(e) => handleInputChange("notes", e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors resize-vertical"
              placeholder="Add your notes about this book..."
            />
          </div>

          <div>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notforsale || false}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    notforsale: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-blue-600 bg-background border-border rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-foreground">
                Not for sale (hide from public library)
              </span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isUploading || isSaving}
            className="px-6 py-2 text-sm bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm disabled:opacity-50"
          >
            {isUploading
              ? "Uploading..."
              : isSaving
              ? "Saving..."
              : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  )
}
