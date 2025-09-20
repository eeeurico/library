"use client"
import { useState, useCallback } from "react"
import { UploadDropzone } from "@uploadthing/react"
import type { OurFileRouter } from "@/app/api/uploadthing/core"

type NewBook = {
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
}

interface AddBookModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (newBook: NewBook) => void
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

export default function AddBookModal({
  isOpen,
  onClose,
  onSave,
}: AddBookModalProps) {
  const [formData, setFormData] = useState<NewBook>({
    title: "",
    author: "",
    type: "book",
    isbn: "",
    publisher: "",
    year: "",
    edition: "",
    coverUrl: "",
    notes: "",
    price: "",
    url: "",
  })
  const [isUploading, setIsUploading] = useState(false)

  const handleInputChange = (field: keyof NewBook, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (!formData.title.trim() || !formData.author.trim()) {
      alert("Title and Author are required fields.")
      return
    }

    onSave(formData)

    // Reset form
    setFormData({
      title: "",
      author: "",
      type: "book",
      isbn: "",
      publisher: "",
      year: "",
      edition: "",
      coverUrl: "",
      notes: "",
      price: "",
      url: "",
    })
    onClose()
  }

  const handleClose = () => {
    // Reset form on close
    setFormData({
      title: "",
      author: "",
      type: "book",
      isbn: "",
      publisher: "",
      year: "",
      edition: "",
      coverUrl: "",
      notes: "",
      price: "",
      url: "",
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-light text-foreground">
            Add Book Manually
          </h2>
          <button
            onClick={handleClose}
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
                    alt={formData.title || "Book cover"}
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
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                placeholder="Enter book title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Author <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => handleInputChange("author", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                placeholder="Enter author name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Type
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleInputChange("type", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              >
                <option value="book">Book</option>
                <option value="zine">Zine</option>
                <option value="artist edition">Artist Edition</option>
                <option value="magazine">Magazine</option>
                <option value="catalog">Catalog</option>
                <option value="other">Other</option>
              </select>
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
                placeholder="978-0-123456-78-9"
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
                placeholder="Publisher name"
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
                placeholder="2024"
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
                placeholder="First edition, Limited edition, etc."
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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                URL
              </label>
              <input
                type="url"
                value={formData.url || ""}
                onChange={(e) => handleInputChange("url", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                placeholder="https://... (optional link to artist page, gallery, etc.)"
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
              placeholder="Add notes about this book, zine, or edition..."
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-border">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              isUploading || !formData.title.trim() || !formData.author.trim()
            }
            className="px-6 py-2 text-sm bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm disabled:opacity-50"
          >
            {isUploading ? "Uploading..." : "Add Book"}
          </button>
        </div>
      </div>
    </div>
  )
}
