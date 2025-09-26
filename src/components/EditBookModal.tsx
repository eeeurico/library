"use client"
import { useState, useRef, useCallback, useEffect } from "react"
import { UploadDropzone } from "@uploadthing/react"
import { useToast } from "./ToastProvider"
import type { OurFileRouter } from "@/app/api/uploadthing/core"

type Book = {
  id: string
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
  forsale?: boolean | string // Can be boolean or "TRUE"/"FALSE" string from Google Sheets
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
  const { showToast } = useToast()
  const [formData, setFormData] = useState<Book>(book)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [imageSearching, setImageSearching] = useState(false)
  const [imageSearchResults, setImageSearchResults] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown)
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleInputChange = (field: keyof Book, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    // If upload is in progress, wait for it to complete
    if (isUploading) {
      showToast(
        "Please wait for the image upload to complete before saving.",
        "info"
      )
      return
    }

    setIsSaving(true)
    try {
      await onSave(formData)
      onClose()
    } catch (error) {
      console.error("Error saving book:", error)
      showToast("Failed to save book changes. Please try again.", "error")
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
      showToast("Image upload failed. Please try again.", "error")
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }, [])

  const searchImages = async () => {
    setImageSearching(true)
    setImageSearchResults([])

    try {
      // Create a more specific book search query
      const searchTerms = []
      if (book.title) searchTerms.push(`"${book.title}"`)
      if (book.author) searchTerms.push(`"${book.author}"`)
      if (book.isbn) searchTerms.push(book.isbn)

      // Always include "book cover" to get more relevant results
      const query = `${searchTerms.join(" ")} book cover`

      const response = await fetch(
        `/api/search/images?q=${encodeURIComponent(query)}`
      )
      const data = await response.json()

      if (data.items && data.items.length > 0) {
        // Don't upload images yet - just store the URLs for preview
        setImageSearchResults(
          data.items.map((item: any) => ({
            title: item.title,
            link: item.link, // Original high-res URL
            thumbnailLink: item.thumbnailLink || item.link, // Thumbnail for preview
            source: item.source || "Google Images",
          }))
        )

        if (data.fallback) {
          showToast(data.message || "Using fallback image sources", "info")
        }
      } else {
        showToast("No images found", "error")
      }
    } catch (error) {
      console.error("Image search error:", error)
      showToast("Failed to search for images", "error")
    } finally {
      setImageSearching(false)
    }
  }

  // New function to handle image selection and upload
  const selectAndUploadImage = async (imageUrl: string, imageTitle: string) => {
    setIsUploading(true)

    try {
      showToast("Downloading and uploading image...", "info")

      // Upload the selected image to UploadThing
      const uploadResponse = await fetch("/api/upload-image-from-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageUrl: imageUrl,
          fileName: `${book.title || "book"}-cover.jpg`,
        }),
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image")
      }

      const uploadData = await uploadResponse.json()

      // Update the form data with the new UploadThing URL
      handleInputChange("image", uploadData.url)

      // Clear the search results
      setImageSearchResults([])

      showToast("Image uploaded successfully!", "success")
    } catch (error) {
      console.error("Image upload error:", error)
      showToast("Failed to upload image", "error")
    } finally {
      setIsUploading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg max-w-2xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background flex items-center justify-between p-6 border-b border-border rounded-t-lg">
          <h2 className="text-xl font-light text-foreground">Edit Book</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
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
                    setIsUploading(false)
                    if (res?.[0]?.url) {
                      setFormData((prev) => ({ ...prev, coverUrl: res[0].url }))
                    }
                  }}
                  onUploadError={(error: Error) => {
                    setIsUploading(false)
                    showToast(`Upload error: ${error.message}`, "error")
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
                Type
              </label>
              <select
                value={formData.type || ""}
                onChange={(e) => handleInputChange("type", e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
              >
                <option value="">Select type</option>
                <option value="paperback">Paperback</option>
                <option value="hardcover">Hardcover</option>
                <option value="zine">Zine</option>
                <option value="magazine">Magazine</option>
                <option value="catalog">Catalog</option>
                <option value="artist edition">Artist Edition</option>
                <option value="ebook">E-book</option>
                <option value="audiobook">Audiobook</option>
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
                <option value="Korean">Korean</option>
                <option value="Portuguese">Portuguese</option>
                <option value="Dutch">Dutch</option>
                <option value="German">German</option>
                <option value="French">French</option>
                <option value="Spanish">Spanish</option>
                <option value="Italian">Italian</option>
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
                checked={
                  formData.forsale === true ||
                  formData.forsale === "TRUE" ||
                  formData.forsale === undefined // Default to true (for sale)
                }
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    forsale: e.target.checked,
                  }))
                }
                className="w-4 h-4 text-blue-600 bg-background border-border rounded focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-foreground">
                For sale (show in public library)
              </span>
            </label>
          </div>

          {/* Image Search Section */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-foreground">
              Search for Cover Images
            </label>
            <div className="flex flex-col space-y-2">
              <button
                onClick={searchImages}
                disabled={imageSearching}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-sm hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {imageSearching ? "Searching..." : "Search Images"}
              </button>

              {/* Update the image search results display */}
              {imageSearchResults.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Select an image:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                    {imageSearchResults.map((result, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={result.thumbnailLink}
                          alt={result.title}
                          className="w-full h-24 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() =>
                            selectAndUploadImage(result.link, result.title)
                          }
                          onError={(e) => {
                            e.currentTarget.src = "/placeholder-book-cover.jpg"
                          }}
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white text-xs p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="truncate">{result.source}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 z-10 bg-background flex items-center justify-end space-x-3 p-6 border-t border-border rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isUploading || isSaving}
            className="px-6 py-2 text-sm bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm disabled:opacity-50 cursor-pointer"
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
