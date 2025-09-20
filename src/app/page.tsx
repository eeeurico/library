"use client"
import { useEffect, useState } from "react"

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
  rowIndex: number
}

type ViewMode = "grid" | "table"

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>("grid")
  const [loading, setLoading] = useState(true)
  const [fetchingPrices, setFetchingPrices] = useState<Set<number>>(new Set())
  const [isValidating, setIsValidating] = useState(false)

  // Initialize view mode from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('bookLibrary_viewMode') as ViewMode
    if (savedViewMode && (savedViewMode === 'grid' || savedViewMode === 'table')) {
      setViewMode(savedViewMode)
    }
  }, [])

  // Save view mode to localStorage when it changes
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('bookLibrary_viewMode', mode)
  }

  useEffect(() => {
    const loadBooks = async () => {
      try {
        // Try to load from localStorage first
        const cachedBooks = localStorage.getItem('bookLibrary_books')
        const cacheTimestamp = localStorage.getItem('bookLibrary_books_timestamp')
        const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp) : Infinity
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
        console.error('Error loading books:', error)
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
        localStorage.setItem('bookLibrary_books', JSON.stringify(data))
        localStorage.setItem('bookLibrary_books_timestamp', Date.now().toString())
      } catch (error) {
        console.error('Error fetching fresh books:', error)
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
        const dataChanged = JSON.stringify(cachedBooks) !== JSON.stringify(freshData)
        
        if (dataChanged) {
          setBooks(freshData)
          localStorage.setItem('bookLibrary_books', JSON.stringify(freshData))
          localStorage.setItem('bookLibrary_books_timestamp', Date.now().toString())
        }
      } catch (error) {
        console.error('Error validating books:', error)
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
        localStorage.setItem('bookLibrary_books', JSON.stringify(updatedBooks))
        localStorage.setItem('bookLibrary_books_timestamp', Date.now().toString())
      } else {
        alert("Failed to delete book")
      }
    } catch (error) {
      alert("Error deleting book")
    }
  }

  const handleFetchPrice = async (book: Book) => {
    if (!book.isbn || !book.title) return
    
    setFetchingPrices(prev => new Set([...prev, book.rowIndex]))
    
    try {
      const response = await fetch(
        `/api/books/price?isbn=${encodeURIComponent(book.isbn)}&title=${encodeURIComponent(book.title)}`
      )
      const data = await response.json()
      
      if (response.ok && data.price) {
        // Update the book in the local state
        setBooks(prevBooks => 
          prevBooks.map(b => 
            b.rowIndex === book.rowIndex 
              ? { ...b, price: data.price }
              : b
          )
        )
      }
    } catch (error) {
      console.error("Failed to fetch price:", error)
    } finally {
      setFetchingPrices(prev => {
        const newSet = new Set(prev)
        newSet.delete(book.rowIndex)
        return newSet
      })
    }
  }

  // Utility function to clear cache manually if needed
  const clearCache = () => {
    localStorage.removeItem('bookLibrary_books')
    localStorage.removeItem('bookLibrary_books_timestamp')
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
    <div>
      {/* Header with view controls */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-light tracking-tight text-foreground">
            Library
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
          <button
            onClick={clearCache}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh library data"
          >
            ↻ Refresh
          </button>
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

      {books.length === 0 ? (
        <div className="text-center py-24">
          <h3 className="text-2xl font-light text-foreground mb-3">
            No books yet
          </h3>
          <p className="text-muted-foreground mb-8 font-light">
            Start building your collection
          </p>
          <a
            href="/search"
            className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm"
          >
            Add Books
          </a>
        </div>
      ) : viewMode === "grid" ? (
        <GridView books={books} onDelete={handleDelete} />
      ) : (
        <TableView 
          books={books} 
          onDelete={handleDelete} 
          onFetchPrice={handleFetchPrice}
          fetchingPrices={fetchingPrices}
        />
      )}
    </div>
  )
}

function GridView({
  books,
  onDelete,
}: {
  books: Book[]
  onDelete: (book: Book) => void
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
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
  onFetchPrice,
  fetchingPrices,
}: {
  books: Book[]
  onDelete: (book: Book) => void
  onFetchPrice: (book: Book) => void
  fetchingPrices: Set<number>
}) {
  return (
    <div className="w-full">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              Cover
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              Title
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              Author
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              Publisher
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              Year
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              ISBN
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              Price
            </th>
            <th className="text-left py-4 px-2 font-normal text-sm text-muted-foreground">
              Link
            </th>
            <th className="text-right py-4 px-2 font-normal text-sm text-muted-foreground">
              Actions
            </th>
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
              <td className="py-4 px-2 text-sm text-muted-foreground">
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
              <td className="py-4 px-2 text-right">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
