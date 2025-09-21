"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/components/ToastProvider"
import EditBookModal from "@/components/EditBookModal"
import AddBookModal from "@/components/AddBookModal"
import SearchBooksModal from "@/components/SearchBooksModal"
import ImportBooksModal from "@/components/ImportBooksModal"
import LoginModal from "@/components/LoginModal"

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
  language?: string
  sellingprice?: string
  forsale?: boolean | string // Can be boolean or "TRUE"/"FALSE" string from Google Sheets
}

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
  language?: string
  sellingprice?: string
  forsale?: boolean | string
}

type ViewMode = "grid" | "table"

export default function BooksPage() {
  const { isAuthenticated, logout } = useAuth()
  const { showToast } = useToast()
  const [books, setBooks] = useState<Book[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [loading, setLoading] = useState(true)
  const [fetchingPrices, setFetchingPrices] = useState<Set<string>>(new Set())
  const [isValidating, setIsValidating] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)
  const [sortBy, setSortBy] = useState<"default" | "title-asc" | "title-desc">(
    "default"
  )
  const [quickSearch, setQuickSearch] = useState("")
  const [isMobile, setIsMobile] = useState(false)

  // Mobile detection
  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener("resize", checkIsMobile)

    return () => window.removeEventListener("resize", checkIsMobile)
  }, [])

  // Initialize view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem(
      "bookLibrary_viewMode"
    ) as ViewMode
    if (
      savedViewMode &&
      (savedViewMode === "grid" || savedViewMode === "table")
    ) {
      // Force grid view on mobile regardless of saved preference
      setViewMode(isMobile ? "grid" : savedViewMode)
    }
  }, [isMobile])

  // Save view mode to localStorage when it changes
  const handleViewModeChange = (mode: ViewMode) => {
    // Don't allow table view on mobile
    if (isMobile && mode === "table") {
      return
    }
    setViewMode(mode)
    localStorage.setItem("bookLibrary_viewMode", mode)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on Ctrl+K or Cmd+K
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        const searchInput = document.querySelector(
          'input[placeholder="Quick search books..."]'
        ) as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
          searchInput.select()
        }
      }
      // Focus search on "/" key (like GitHub)
      if (e.key === "/" && e.target === document.body) {
        e.preventDefault()
        const searchInput = document.querySelector(
          'input[placeholder="Quick search books..."]'
        ) as HTMLInputElement
        if (searchInput) {
          searchInput.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    const loadBooks = async () => {
      try {
        // Try to load from localStorage first
        const cachedBooks = localStorage.getItem("bookLibrary_books")
        const cacheTimestamp = localStorage.getItem(
          "bookLibrary_books_timestamp"
        )
        const cacheAge = cacheTimestamp
          ? Date.now() - parseInt(cacheTimestamp)
          : Infinity
        const cacheMaxAge = 5 * 60 * 1000 // 5 minutes

        if (cachedBooks && cacheAge < cacheMaxAge) {
          // Use cached data immediately
          const parsedBooks = JSON.parse(cachedBooks)
          setBooks(parsedBooks)
          setLoading(false)

          // Validate in background if cache is older than 1 minute
          if (cacheAge > 60 * 1000) {
            setIsValidating(true)
            validateAndUpdateBooks(parsedBooks)
          }
        } else {
          // Fetch fresh data
          await fetchFreshBooks()
        }
      } catch (error) {
        console.error("Error loading books:", error)
        // Fallback to fresh fetch
        await fetchFreshBooks()
      }
    }

    const fetchFreshBooks = async () => {
      try {
        const res = await fetch("/api/books")
        const data = await res.json()
        setBooks(data)

        // Cache the data
        localStorage.setItem("bookLibrary_books", JSON.stringify(data))
        localStorage.setItem(
          "bookLibrary_books_timestamp",
          Date.now().toString()
        )
      } catch (error) {
        console.error("Error fetching fresh books:", error)
      } finally {
        setLoading(false)
        setIsValidating(false)
      }
    }

    const validateAndUpdateBooks = async (cachedBooks: Book[]) => {
      try {
        const res = await fetch("/api/books")
        const freshData = await res.json()

        // Compare with cached data
        const dataChanged =
          JSON.stringify(cachedBooks) !== JSON.stringify(freshData)

        if (dataChanged) {
          setBooks(freshData)
          localStorage.setItem("bookLibrary_books", JSON.stringify(freshData))
          localStorage.setItem(
            "bookLibrary_books_timestamp",
            Date.now().toString()
          )
        }
      } catch (error) {
        console.error("Error validating books:", error)
      } finally {
        setIsValidating(false)
      }
    }

    loadBooks()
  }, [])

  const handleDelete = async (book: Book) => {
    if (!confirm(`Are you sure you want to delete "${book.title}"?`)) return

    try {
      const response = await fetch("/api/books/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: book.id }),
      })

      if (response.ok) {
        const updatedBooks = books.filter((b) => b.id !== book.id)
        setBooks(updatedBooks)

        // Update cache immediately
        localStorage.setItem("bookLibrary_books", JSON.stringify(updatedBooks))
        localStorage.setItem(
          "bookLibrary_books_timestamp",
          Date.now().toString()
        )
        showToast("Book deleted successfully", "success")
      } else {
        showToast("Failed to delete book", "error")
      }
    } catch (error) {
      showToast("Error deleting book", "error")
    }
  }

  const handleEdit = (book: Book) => {
    setEditingBook(book)
    setEditModalOpen(true)
  }

  const handleEditSave = async (updatedBook: Book) => {
    try {
      console.log("Saving book:", updatedBook)
      const response = await fetch("/api/books/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedBook),
      })

      if (response.ok) {
        const updatedBooks = books.map((book) =>
          book.id === updatedBook.id ? updatedBook : book
        )
        setBooks(updatedBooks)

        // Update cache immediately
        localStorage.setItem("bookLibrary_books", JSON.stringify(updatedBooks))
        localStorage.setItem(
          "bookLibrary_books_timestamp",
          Date.now().toString()
        )
        console.log("Book updated successfully")
        showToast("Book updated successfully", "success")
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Update failed:", response.status, errorData)
        throw new Error(
          errorData.error || `Failed to update book (${response.status})`
        )
      }
    } catch (error) {
      console.error("Error updating book:", error)
      throw error // Re-throw so the modal can handle it
    }
  }

  const handleManualAdd = async (newBook: NewBook): Promise<void> => {
    try {
      // Generate the next available ID
      const nextId =
        books.length > 0
          ? Math.max(...books.map((b) => parseInt(b.id || "0"))) + 1
          : 1

      const bookToAdd = {
        ...newBook,
        id: nextId.toString(),
      }

      const response = await fetch("/api/books/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bookToAdd),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to add book")
      }

      // Refresh the book list by fetching fresh data
      const res = await fetch("/api/books")
      if (!res.ok) {
        throw new Error("Failed to refresh book list")
      }

      const data = await res.json()
      setBooks(data)

      // Update cache
      localStorage.setItem("bookLibrary_books", JSON.stringify(data))
      localStorage.setItem("bookLibrary_books_timestamp", Date.now().toString())
      showToast("Book added successfully", "success")
    } catch (error) {
      console.error("Error adding book:", error)
      throw error // Re-throw to let the modal handle the error display
    }
  }

  const handleBookAdded = async () => {
    // Refresh the book list when a book is added from search
    try {
      const res = await fetch("/api/books")
      const data = await res.json()
      setBooks(data)

      // Update cache
      localStorage.setItem("bookLibrary_books", JSON.stringify(data))
      localStorage.setItem("bookLibrary_books_timestamp", Date.now().toString())
      showToast("Book added to library", "success")
    } catch (error) {
      console.error("Error refreshing books:", error)
    }
  }

  const handleFetchPrice = async (book: Book) => {
    if (!book.isbn || !book.title) return

    setFetchingPrices((prev) => new Set([...prev, book.id]))

    try {
      const response = await fetch(
        `/api/books/price?isbn=${encodeURIComponent(
          book.isbn
        )}&title=${encodeURIComponent(book.title)}`
      )
      const data = await response.json()

      if (response.ok && data.price) {
        // Update the book in the local state
        setBooks((prevBooks) =>
          prevBooks.map((b) =>
            b.id === book.id ? { ...b, price: data.price } : b
          )
        )
      }
    } catch (error) {
      console.error("Failed to fetch price:", error)
    } finally {
      setFetchingPrices((prev) => {
        const newSet = new Set(prev)
        newSet.delete(book.id)
        return newSet
      })
    }
  }

  // Utility function to clear cache manually if needed
  const clearCache = () => {
    localStorage.removeItem("bookLibrary_books")
    localStorage.removeItem("bookLibrary_books_timestamp")
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <svg
          aria-hidden="true"
          className="w-12 h-12 text-white/20 animate-spin  fill-white"
          viewBox="0 0 100 101"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
            fill="currentColor"
          />
          <path
            d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
            fill="currentFill"
          />
        </svg>
      </div>
    )
  }

  return (
    <>
      {/* Header with view controls */}
      <div className="flex justify-between items-center mb-8 px-6">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-foreground">
            BookLibrary
          </h1>
          <p className="text-muted-foreground mt-2 font-light">
            {books.length} books
          </p>
        </div>

        <div className="flex items-center space-x-6">
          {isValidating && (
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <div className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin"></div>
              <span>Updating...</span>
            </div>
          )}
          {isAuthenticated && (
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSearchModalOpen(true)}
                className="px-4 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm cursor-pointer"
              >
                Search Books
              </button>
              <button
                onClick={() => setImportModalOpen(true)}
                className="px-4 py-2 text-sm font-normal bg-[rgba(45,96,45,0.5)] text-white hover:bg-[#3a7a3a] transition-colors rounded-sm cursor-pointer"
              >
                Import CSV
              </button>
              <button
                onClick={() => setAddModalOpen(true)}
                className="px-4 py-2 text-sm font-normal border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm cursor-pointer"
              >
                Add Manually
              </button>
            </div>
          )}
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <button
                onClick={clearCache}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Refresh library data"
              >
                ↻ Refresh
              </button>
              <button
                onClick={logout}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Logout"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={clearCache}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Refresh library data"
            >
              ↻ Refresh
            </button>
          )}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleViewModeChange("grid")}
              className={`px-4 py-2 text-sm font-normal transition-all cursor-pointer ${
                viewMode === "grid"
                  ? "text-foreground border-b border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => handleViewModeChange("table")}
              className={`px-4 py-2 text-sm font-normal transition-all cursor-pointer hidden md:block ${
                viewMode === "table"
                  ? "text-foreground border-b border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {/* Search and Sort Controls */}
      <div className="w-full px-6 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          {/* Quick Search */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Quick search books... (Ctrl+K)"
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                className="w-full px-4 py-2 pl-10 pr-16 text-sm bg-background border border-border rounded-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white transition-colors"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {quickSearch && (
                <button
                  onClick={() => setQuickSearch("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
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
              )}
            </div>
          </div>

          {/* Sort Controls */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(
                  e.target.value as "default" | "title-asc" | "title-desc"
                )
              }
              className="px-3 py-2 text-sm bg-background border border-border rounded-sm text-foreground focus:outline-none focus:border-white transition-colors cursor-pointer"
            >
              <option value="default">Sheet Order</option>
              <option value="title-asc">Title A-Z</option>
              <option value="title-desc">Title Z-A</option>
            </select>
          </div>
        </div>
      </div>

      {/* Filter, search, and sort books */}
      {(() => {
        // First filter by authentication and forsale status
        let filteredBooks = isAuthenticated
          ? books
          : books.filter(
              (book) =>
                book.forsale === true ||
                book.forsale === "TRUE" ||
                book.forsale === undefined // Show books that are for sale (default true)
            )

        // Apply quick search filter
        if (quickSearch.trim()) {
          const searchTerm = quickSearch.toLowerCase().trim()
          filteredBooks = filteredBooks.filter(
            (book) =>
              book.title?.toLowerCase().includes(searchTerm) ||
              book.author?.toLowerCase().includes(searchTerm) ||
              book.isbn?.toLowerCase().includes(searchTerm) ||
              book.publisher?.toLowerCase().includes(searchTerm)
          )
        }

        // Apply sorting
        switch (sortBy) {
          case "title-asc":
            filteredBooks.sort((a, b) =>
              (a.title || "").localeCompare(b.title || "")
            )
            break
          case "title-desc":
            filteredBooks.sort((a, b) =>
              (b.title || "").localeCompare(a.title || "")
            )
            break
          case "default":
          default:
            // Keep original sheet order (by rowIndex)
            filteredBooks // Keep original order when no specific sort is applied
            break
        }

        return (
          <>
            {/* Results count and clear search */}
            {(quickSearch.trim() || filteredBooks.length !== books.length) && (
              <div className="w-full px-6 mb-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>
                    Showing {filteredBooks.length} of {books.length} books
                    {quickSearch.trim() && ` for "${quickSearch}"`}
                  </span>
                  {quickSearch.trim() && (
                    <button
                      onClick={() => setQuickSearch("")}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            )}

            {filteredBooks.length === 0 ? (
              <div className="text-center py-24">
                <h3 className="text-2xl font-light text-foreground mb-3">
                  {quickSearch.trim()
                    ? `No books found for "${quickSearch}"`
                    : "No books yet"}
                </h3>
                <p className="text-muted-foreground mb-8 font-light">
                  {quickSearch.trim()
                    ? "Try a different search term"
                    : "Start building your collection"}
                </p>
                {isAuthenticated && (
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={() => setSearchModalOpen(true)}
                      className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm cursor-pointer"
                    >
                      Search Books
                    </button>
                    <button
                      onClick={() => setAddModalOpen(true)}
                      className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm cursor-pointer"
                    >
                      Add Manually
                    </button>
                  </div>
                )}
              </div>
            ) : viewMode === "grid" || isMobile ? (
              <GridView
                books={filteredBooks}
                onDelete={handleDelete}
                onEdit={handleEdit}
                isAuthenticated={isAuthenticated}
              />
            ) : (
              <TableView
                books={filteredBooks}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onFetchPrice={handleFetchPrice}
                fetchingPrices={fetchingPrices}
                isAuthenticated={isAuthenticated}
              />
            )}
          </>
        )
      })()}

      {/* Edit Modal */}
      {editingBook && isAuthenticated && (
        <EditBookModal
          book={editingBook}
          isOpen={editModalOpen}
          onClose={() => {
            setEditModalOpen(false)
            setEditingBook(null)
          }}
          onSave={handleEditSave}
        />
      )}

      {/* Add Manual Book Modal */}
      {isAuthenticated && (
        <AddBookModal
          isOpen={addModalOpen}
          onClose={() => setAddModalOpen(false)}
          onSave={handleManualAdd}
        />
      )}

      {/* Search Books Modal */}
      {isAuthenticated && (
        <SearchBooksModal
          isOpen={searchModalOpen}
          onClose={() => setSearchModalOpen(false)}
          onBookAdded={handleBookAdded}
        />
      )}

      {/* Import Books Modal */}
      {isAuthenticated && (
        <ImportBooksModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onBooksAdded={handleBookAdded}
        />
      )}

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      {/* Fixed Login/Logout Button */}
      {!isAuthenticated ? (
        <button
          onClick={() => setLoginModalOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-full flex items-center justify-center shadow-lg z-40 cursor-pointer"
          title="Admin Login"
        >
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
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </button>
      ) : (
        <button
          onClick={logout}
          className="fixed bottom-6 right-6 w-12 h-12 bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-full flex items-center justify-center shadow-lg z-40 cursor-pointer"
          title="Logout"
        >
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
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
        </button>
      )}
    </>
  )
}

function GridView({
  books,
  onDelete,
  onEdit,
  isAuthenticated,
}: {
  books: Book[]
  onDelete: (book: Book) => void
  onEdit: (book: Book) => void
  isAuthenticated: boolean
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 px-6">
      {books.map((book) => (
        <div key={book.id} className="group">
          <div className="relative aspect-[3/4] mb-3">
            {book.coverUrl ? (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-full h-full object-cover rounded-sm"
              />
            ) : (
              <div className="w-full h-full bg-muted rounded-sm flex items-center justify-center">
                <div className="w-6 h-6 border border-muted-foreground"></div>
              </div>
            )}
            {isAuthenticated && (
              <>
                <button
                  onClick={() => onEdit(book)}
                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background rounded-sm p-1 cursor-pointer"
                  title="Edit"
                >
                  <svg
                    className="w-3 h-3 text-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                </button>
                <button
                  onClick={() => onDelete(book)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background rounded-sm p-1 cursor-pointer"
                  title="Delete"
                >
                  <svg
                    className="w-3 h-3 text-foreground"
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
              </>
            )}
          </div>
          <div>
            <h3 className="font-normal text-sm text-foreground line-clamp-2 mb-1">
              {book.title || "Untitled"}
            </h3>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {book.author || "Unknown Author"}
            </p>
            {book.type && (
              <p className="text-xs text-muted-foreground mt-1 capitalize">
                {book.type}
              </p>
            )}
            {book.year && (
              <p className="text-xs text-muted-foreground mt-1">{book.year}</p>
            )}
            {/* Price display logic */}
            {(book.price || book.sellingprice) && (
              <div className="text-xs mt-1 flex flex-col gap-1">
                {book.sellingprice &&
                book.price &&
                book.sellingprice !== book.price ? (
                  // Show both prices with strikethrough on original
                  <>
                    <p className="text-muted-foreground line-through">
                      ${book.price}
                    </p>
                    <p className="font-medium text-green-600">
                      ${book.sellingprice}
                    </p>
                  </>
                ) : book.sellingprice ? (
                  // Show only selling price
                  <p className="font-medium text-green-600">
                    ${book.sellingprice}
                  </p>
                ) : (
                  // Show only original price
                  <p className="text-muted-foreground">${book.price}</p>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function TableView({
  books,
  onDelete,
  onEdit,
  onFetchPrice,
  fetchingPrices,
  isAuthenticated,
}: {
  books: Book[]
  onDelete: (book: Book) => void
  onEdit: (book: Book) => void
  onFetchPrice: (book: Book) => void
  fetchingPrices: Set<string>
  isAuthenticated: boolean
}) {
  return (
    <div className="w-full overflow-x-auto px-6">
      <table className="w-full min-w-[1200px]">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[60px]">
              Cover
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[200px]">
              Title
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[150px]">
              Author
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
              Type
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[120px]">
              Publisher
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[80px]">
              Year
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[120px]">
              ISBN
            </th>
            {isAuthenticated && (
              <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
                Price
              </th>
            )}
            {isAuthenticated && (
              <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
                Selling Price
              </th>
            )}
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
              Language
            </th>
            {isAuthenticated && (
              <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
                Status
              </th>
            )}
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[80px]">
              Link
            </th>
            {isAuthenticated && (
              <th className="text-right py-4 px-2 font-normal text-sm text-muted-foreground min-w-[120px]">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {books.map((book) => (
            <tr
              key={book.id}
              className="border-b border-border hover:bg-muted/30 transition-colors"
            >
              <td className="py-4 px-2">
                <div className="w-8 h-12">
                  {book.coverUrl ? (
                    <img
                      className="w-full h-full object-cover rounded-sm"
                      src={book.coverUrl}
                      alt={book.title}
                    />
                  ) : (
                    <div className="w-full h-full bg-muted rounded-sm flex items-center justify-center">
                      <div className="w-3 h-3 border border-muted-foreground"></div>
                    </div>
                  )}
                </div>
              </td>
              <td className="py-4 px-2">
                <div className="font-normal text-sm text-foreground">
                  {book.title || "Untitled"}
                </div>
                {book.notes && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {book.notes}
                  </div>
                )}
              </td>
              <td className="py-4 px-2 text-sm text-muted-foreground overflow-ellipsis whitespace-nowrap max-w-[200px] relative overflow-hidden">
                {book.author || "Unknown"}
              </td>
              <td className="py-4 px-2 text-sm text-muted-foreground">
                <span className="px-2 py-1 text-xs rounded-sm bg-muted text-muted-foreground capitalize">
                  {book.type || "paperback"}
                </span>
              </td>
              <td className="py-4 px-2 text-sm text-muted-foreground">
                {book.publisher || "—"}
              </td>
              <td className="py-4 px-2 text-sm text-muted-foreground">
                {book.year || "—"}
              </td>
              <td className="py-4 px-2 text-sm text-muted-foreground font-mono">
                {book.isbn || "—"}
              </td>
              {isAuthenticated && (
                <td className="py-4 px-2 text-sm">
                  {book.price ? (
                    <div className="flex flex-col gap-1">
                      <span className="text-foreground">{book.price}</span>
                    </div>
                  ) : book.isbn ? (
                    <button
                      onClick={() => onFetchPrice(book)}
                      disabled={fetchingPrices.has(book.id)}
                      className="text-xs px-2 py-1 bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] rounded-sm disabled:opacity-50 cursor-pointer"
                    >
                      {fetchingPrices.has(book.id) ? "..." : "Get Price"}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
              <td className="py-4 px-2 text-sm text-muted-foreground">
                {book.sellingprice ? (
                  <span className="font-medium text-green-600">
                    {book.sellingprice}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-4 px-2 text-sm text-muted-foreground">
                {book.language || "—"}
              </td>
              {isAuthenticated && (
                <td className="py-4 px-2 text-sm">
                  <span
                    className={`px-2 py-1 text-xs rounded-sm ${
                      book.forsale === true ||
                      book.forsale === "TRUE" ||
                      book.forsale === undefined
                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                    }`}
                  >
                    {book.forsale === true ||
                    book.forsale === "TRUE" ||
                    book.forsale === undefined
                      ? "For Sale"
                      : "Not for Sale"}
                  </span>
                </td>
              )}
              <td className="py-4 px-2 text-sm">
                {book.url ? (
                  <a
                    href={book.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                    title="View book details"
                  >
                    View ↗
                  </a>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              {isAuthenticated && (
                <td className="py-4 px-2 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      onClick={() => onEdit(book)}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1 cursor-pointer"
                      title="Edit"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onDelete(book)}
                      className="text-muted-foreground hover:text-destructive transition-colors p-1 cursor-pointer"
                      title="Delete"
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
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
