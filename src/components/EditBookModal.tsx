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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // New state for enhanced features
  const [showImageSearch, setShowImageSearch] = useState(false)
  const [showPriceSearch, setShowPriceSearch] = useState(false)
  const [showUrlSearch, setShowUrlSearch] = useState(false)
  const [imageSearchResults, setImageSearchResults] = useState<string[]>([])
  const [priceSearchResults, setPriceSearchResults] = useState<
    Array<{
      price: string
      source: string
      info: string
      url?: string
    }>
  >([])
  const [urlSearchResults, setUrlSearchResults] = useState<
    Array<{
      url: string
      source: string
      title: string
    }>
  >([])
  const [isSearching, setIsSearching] = useState(false)

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

  // Search functions for enhanced features
  const searchImages = async () => {
    if (!formData.title && !formData.author) {
      showToast(
        "Please enter title and/or author to search for images",
        "error"
      )
      return
    }

    setIsSearching(true)
    try {
      // Create a better search query with more specific book terms
      const queryParts = []
      if (formData.title) queryParts.push(`"${formData.title}"`)
      if (formData.author) queryParts.push(`"${formData.author}"`)
      queryParts.push("book cover")

      const query = queryParts.join(" ")
      const response = await fetch(
        `/api/search/images?q=${encodeURIComponent(query)}`
      )

      if (response.ok) {
        const results = await response.json()
        if (results.note) {
          showToast(results.note, "info")
        }
        setImageSearchResults(results.images || [])
        setShowImageSearch(true)
      } else {
        const errorData = await response.json().catch(() => ({}))
        showToast(errorData.error || "Failed to search for images", "error")
      }
    } catch (error) {
      console.error("Image search error:", error)
      showToast("Error searching for images", "error")
    } finally {
      setIsSearching(false)
    }
  }

  const searchPrices = async () => {
    if (!formData.isbn && !formData.title) {
      showToast("Please enter ISBN or title to search for prices", "error")
      return
    }

    setIsSearching(true)
    try {
      // Create a search query from available book information
      const queryParts = []
      if (formData.title) queryParts.push(formData.title)
      if (formData.author) queryParts.push(formData.author)
      if (formData.isbn) queryParts.push(formData.isbn)

      const query = queryParts.join(" ")
      const response = await fetch(
        `/api/search/prices?q=${encodeURIComponent(query)}`
      )

      if (response.ok) {
        const results = await response.json()
        setPriceSearchResults(results.prices || [])
        setShowPriceSearch(true)
      } else {
        showToast("Failed to search for prices", "error")
      }
    } catch (error) {
      console.error("Price search error:", error)
      showToast("Error searching for prices", "error")
    } finally {
      setIsSearching(false)
    }
  }

  const searchUrls = async () => {
    if (!formData.isbn && !formData.title) {
      showToast("Please enter ISBN or title to search for URLs", "error")
      return
    }

    setIsSearching(true)
    try {
      const searchParams = new URLSearchParams()
      if (formData.isbn) searchParams.append("isbn", formData.isbn)
      if (formData.title) searchParams.append("title", formData.title)
      if (formData.author) searchParams.append("author", formData.author)

      const response = await fetch(`/api/search/urls?${searchParams}`)

      if (response.ok) {
        const results = await response.json()
        setUrlSearchResults(results.urls || [])
        setShowUrlSearch(true)
      } else {
        showToast("Failed to search for URLs", "error")
      }
    } catch (error) {
      console.error("URL search error:", error)
      showToast("Error searching for URLs", "error")
    } finally {
      setIsSearching(false)
    }
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
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={searchImages}
                    disabled={isSearching}
                    className="px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors rounded-sm disabled:opacity-50"
                  >
                    {isSearching ? "Searching..." : "Search Images"}
                  </button>
                  {formData.coverUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, coverUrl: "" }))
                      }
                      className="px-3 py-2 text-sm border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm"
                    >
                      Clear Image
                    </button>
                  )}
                </div>

                {showImageSearch && (
                  <div className="mb-4 p-4 border border-border rounded-sm bg-muted/30">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">Search Results</h4>
                      <button
                        type="button"
                        onClick={() => setShowImageSearch(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                      {imageSearchResults.map((imageUrl, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              coverUrl: imageUrl,
                            }))
                            setShowImageSearch(false)
                          }}
                          className="aspect-[3/4] border border-border rounded overflow-hidden hover:ring-2 hover:ring-blue-500"
                        >
                          <img
                            src={imageUrl}
                            alt={`Cover option ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = "none"
                            }}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

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
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.price || ""}
                    onChange={(e) => handleInputChange("price", e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                    placeholder="€19.99"
                  />
                  <button
                    type="button"
                    onClick={searchPrices}
                    disabled={isSearching}
                    className="px-3 py-2 text-sm bg-green-600 text-white hover:bg-green-700 transition-colors rounded-sm disabled:opacity-50"
                  >
                    {isSearching ? "..." : "Search"}
                  </button>
                </div>

                {showPriceSearch && (
                  <div className="p-4 border border-border rounded-sm bg-muted/30">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">Price Options</h4>
                      <button
                        type="button"
                        onClick={() => setShowPriceSearch(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {priceSearchResults.map((result, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              price: result.price,
                            }))
                            setShowPriceSearch(false)
                          }}
                          className="w-full text-left p-3 border border-border rounded hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-green-600">
                                {result.price}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {result.source}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {result.info}
                              </div>
                            </div>
                            {result.url && (
                              <a
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-blue-500 hover:text-blue-600 text-xs"
                              >
                                View
                              </a>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={formData.url || ""}
                    onChange={(e) => handleInputChange("url", e.target.value)}
                    className="flex-1 px-3 py-2 border border-border rounded-sm bg-background text-foreground focus:outline-none focus:border-white transition-colors"
                    placeholder="https://..."
                  />
                  <button
                    type="button"
                    onClick={searchUrls}
                    disabled={isSearching}
                    className="px-3 py-2 text-sm bg-orange-600 text-white hover:bg-orange-700 transition-colors rounded-sm disabled:opacity-50"
                  >
                    {isSearching ? "..." : "Find"}
                  </button>
                </div>

                {showUrlSearch && (
                  <div className="p-4 border border-border rounded-sm bg-muted/30">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-medium">URL Options</h4>
                      <button
                        type="button"
                        onClick={() => setShowUrlSearch(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {urlSearchResults.map((result, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              url: result.url,
                            }))
                            setShowUrlSearch(false)
                          }}
                          className="w-full text-left p-3 border border-border rounded hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-blue-600 truncate">
                                {result.title}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {result.source}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 truncate">
                                {result.url}
                              </div>
                            </div>
                            <a
                              href={result.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-blue-500 hover:text-blue-600 text-xs ml-2"
                            >
                              Visit
                            </a>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
