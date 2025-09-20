"use client"
import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import EditBookModal from "@/components/EditBookModal"
import AddBookModal from "@/components/AddBookModal"
import SearchBooksModal from "@/components/SearchBooksModal"
import LoginModal from "@/components/LoginModal"

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
  language?: string
  sellingprice?: string
  notforsale?: boolean
  rowIndex: number
}

type ViewMode = "grid" | "table"

export default function BooksPage() {
  const { isAuthenticated, logout } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [loading, setLoading] = useState(true)
  const [fetchingPrices, setFetchingPrices] = useState<Set<number>>(new Set())
  const [isValidating, setIsValidating] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingBook, setEditingBook] = useState<Book | null>(null)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [searchModalOpen, setSearchModalOpen] = useState(false)
  const [loginModalOpen, setLoginModalOpen] = useState(false)

  // Initialize view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem(
      "bookLibrary_viewMode"
    ) as ViewMode
    if (
      savedViewMode &&
      (savedViewMode === "grid" || savedViewMode === "table")
    ) {
      setViewMode(savedViewMode)
    }
  }, [])

  // Save view mode to localStorage when it changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("bookLibrary_viewMode", mode)
  }

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
        body: JSON.stringify({ rowIndex: book.rowIndex }),
      })

      if (response.ok) {
        const updatedBooks = books.filter((b) => b.rowIndex !== book.rowIndex)
        setBooks(updatedBooks)

        // Update cache immediately
        localStorage.setItem("bookLibrary_books", JSON.stringify(updatedBooks))
        localStorage.setItem(
          "bookLibrary_books_timestamp",
          Date.now().toString()
        )
      } else {
        alert("Failed to delete book")
      }
    } catch (error) {
      alert("Error deleting book")
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
          book.rowIndex === updatedBook.rowIndex ? updatedBook : book
        )
        setBooks(updatedBooks)

        // Update cache immediately
        localStorage.setItem("bookLibrary_books", JSON.stringify(updatedBooks))
        localStorage.setItem(
          "bookLibrary_books_timestamp",
          Date.now().toString()
        )
        console.log("Book updated successfully")
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

  const handleManualAdd = async (newBook: any): Promise<void> => {
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
    } catch (error) {
      console.error("Error refreshing books:", error)
    }
  }

  const handleFetchPrice = async (book: Book) => {
    if (!book.isbn || !book.title) return

    setFetchingPrices((prev) => new Set([...prev, book.rowIndex]))

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
            b.rowIndex === book.rowIndex ? { ...b, price: data.price } : b
          )
        )
      }
    } catch (error) {
      console.error("Failed to fetch price:", error)
    } finally {
      setFetchingPrices((prev) => {
        const newSet = new Set(prev)
        newSet.delete(book.rowIndex)
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                className="px-4 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm"
              >
                Search Books
              </button>
              <button
                onClick={() => setAddModalOpen(true)}
                className="px-4 py-2 text-sm font-normal border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm"
              >
                Add Manually
              </button>
            </div>
          )}
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <button
                onClick={clearCache}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh library data"
              >
                ↻ Refresh
              </button>
              <button
                onClick={logout}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Logout"
              >
                Logout
              </button>
            </div>
          ) : (
            <button
              onClick={clearCache}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh library data"
            >
              ↻ Refresh
            </button>
          )}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleViewModeChange("grid")}
              className={`px-4 py-2 text-sm font-normal transition-all ${
                viewMode === "grid"
                  ? "text-foreground border-b border-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => handleViewModeChange("table")}
              className={`px-4 py-2 text-sm font-normal transition-all ${
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

      {/* Filter books based on authentication */}
      {(() => {
        const filteredBooks = isAuthenticated
          ? books
          : books.filter((book) => !book.notforsale)

        return filteredBooks.length === 0 ? (
          <div className="text-center py-24">
            <h3 className="text-2xl font-light text-foreground mb-3">
              No books yet
            </h3>
            <p className="text-muted-foreground mb-8 font-light">
              Start building your collection
            </p>
            {isAuthenticated && (
              <div className="flex items-center justify-center space-x-4">
                <button
                  onClick={() => setSearchModalOpen(true)}
                  className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm"
                >
                  Search Books
                </button>
                <button
                  onClick={() => setAddModalOpen(true)}
                  className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal border border-border text-muted-foreground hover:text-foreground hover:border-white transition-colors rounded-sm"
                >
                  Add Manually
                </button>
              </div>
            )}
          </div>
        ) : viewMode === "grid" ? (
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

      {/* Login Modal */}
      <LoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
      />

      {/* Fixed Login Button */}
      {!isAuthenticated && (
        <button
          onClick={() => setLoginModalOpen(true)}
          className="fixed bottom-6 right-6 w-12 h-12 bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-full flex items-center justify-center shadow-lg z-40"
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
        <div key={book.rowIndex} className="group">
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
                  className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background rounded-sm p-1"
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
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background rounded-sm p-1"
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
            {book.year && (
              <p className="text-xs text-muted-foreground mt-1">{book.year}</p>
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
  fetchingPrices: Set<number>
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
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
              Language
            </th>
            {isAuthenticated && (
              <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
                Selling Price
              </th>
            )}
            {isAuthenticated && (
              <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground min-w-[100px]">
                Not for Sale
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
              key={book.rowIndex}
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
                    <span className="text-foreground">{book.price}</span>
                  ) : book.isbn ? (
                    <button
                      onClick={() => onFetchPrice(book)}
                      disabled={fetchingPrices.has(book.rowIndex)}
                      className="text-xs px-2 py-1 bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] rounded-sm disabled:opacity-50"
                    >
                      {fetchingPrices.has(book.rowIndex) ? "..." : "Get Price"}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              )}
              <td className="py-4 px-2 text-sm text-muted-foreground">
                {book.language || "—"}
              </td>
              {isAuthenticated && (
                <td className="py-4 px-2 text-sm text-muted-foreground">
                  {book.sellingprice || "—"}
                </td>
              )}
              {isAuthenticated && (
                <td className="py-4 px-2 text-sm">
                  <span
                    className={`px-2 py-1 text-xs rounded-sm ${
                      book.notforsale
                        ? "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
                        : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                    }`}
                  >
                    {book.notforsale ? "Not for Sale" : "For Sale"}
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
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
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
                      className="text-muted-foreground hover:text-destructive transition-colors p-1"
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
