"use client"
import { useState } from "react"
import { useToast } from "@/components/ToastProvider"

type SearchResult = {
  id: string
  title: string
  author: string
  publisher?: string
  year?: string
  isbn?: string
  coverUrl?: string
  description?: string
  source: string
  price?: string | null
  url?: string | null
}

interface SearchBooksModalProps {
  isOpen: boolean
  onClose: () => void
  onBookAdded?: () => void
}

export default function SearchBooksModal({
  isOpen,
  onClose,
  onBookAdded,
}: SearchBooksModalProps) {
  const { showToast } = useToast()
  const [query, setQuery] = useState("")
  const [searchType, setSearchType] = useState<
    "general" | "title" | "author" | "isbn"
  >("general")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch(
        `/api/books/search?q=${encodeURIComponent(query)}&type=${searchType}`
      )
      const data = await response.json()

      if (response.ok) {
        setResults(data.results)
      } else {
        setError(data.error || "Search failed")
      }
    } catch (err) {
      setError("Network error occurred")
    } finally {
      setLoading(false)
    }
  }

  const handleAddBook = async (book: SearchResult) => {
    try {
      const response = await fetch("/api/books/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: book.title,
          author: book.author,
          isbn: book.isbn,
          publisher: book.publisher,
          year: book.year,
          coverUrl: book.coverUrl,
          price: "", // Empty price, will be fetched on-demand
          url: book.url || "",
          type: "book",
        }),
      })

      if (response.ok) {
        // Clear the books cache so it refreshes on next visit
        localStorage.removeItem("bookLibrary_books")
        localStorage.removeItem("bookLibrary_books_timestamp")

        showToast(`"${book.title}" has been added to your library!`)

        // Notify parent component that a book was added
        if (onBookAdded) {
          onBookAdded()
        }

        // Remove the added book from search results
        setResults((prev) => prev.filter((r) => r !== book))
      } else {
        const error = await response.json()
        showToast(`Failed to add book: ${error.error}`, "error")
      }
    } catch (err) {
      showToast("Failed to add book to library", "error")
    }
  }

  const handleClose = () => {
    // Reset search state when closing
    setQuery("")
    setResults([])
    setError("")
    setSearchType("general")
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border flex-shrink-0">
          <h2 className="text-xl font-light text-foreground">Search Books</h2>
          <button
            onClick={handleClose}
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

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="flex gap-4 mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for books..."
                className="flex h-10 w-full rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white transition-colors flex-1"
              />
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value as any)}
                className="flex h-10 w-32 rounded-sm border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white transition-colors cursor-pointer"
              >
                <option value="general">General</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
                <option value="isbn">ISBN</option>
              </select>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded text-sm">
              {error}
            </div>
          )}

          {/* Search Results */}
          <div className="space-y-6">
            {results.map((book) => (
              <div
                key={`${book.source}-${book.id}`}
                className="border border-border rounded p-6 flex gap-6"
              >
                {book.coverUrl && (
                  <img
                    src={book.coverUrl}
                    alt={book.title}
                    className="w-20 h-28 object-cover rounded-sm flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-normal text-foreground mb-2">
                    {book.title}
                  </h3>
                  <p className="text-muted-foreground mb-3">{book.author}</p>
                  <div className="space-y-1 mb-4">
                    {book.publisher && (
                      <p className="text-sm text-muted-foreground">
                        {book.publisher}
                      </p>
                    )}
                    {book.year && (
                      <p className="text-sm text-muted-foreground">
                        {book.year}
                      </p>
                    )}
                    {book.isbn && (
                      <p className="text-sm text-muted-foreground font-mono">
                        {book.isbn}
                      </p>
                    )}
                    {book.url && (
                      <a
                        href={book.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 underline"
                      >
                        View on{" "}
                        {book.url.includes("amazon.nl")
                          ? "Amazon NL"
                          : book.url.includes("bol.com")
                          ? "Bol.com"
                          : book.url.includes("openlibrary.org")
                          ? "Open Library"
                          : book.url.includes("books.google")
                          ? "Google Books"
                          : "External Site"}{" "}
                        ↗
                      </a>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {book.source}
                    </p>
                  </div>
                  {book.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                      {book.description.length > 200
                        ? `${book.description.substring(0, 200)}...`
                        : book.description}
                    </p>
                  )}
                  <button
                    onClick={() => handleAddBook(book)}
                    className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm cursor-pointer"
                  >
                    Add to Library
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* No Results Message */}
          {results.length === 0 && !loading && query && (
            <div className="text-center text-muted-foreground py-12">
              No books found for "{query}"
            </div>
          )}

          {/* Empty State */}
          {results.length === 0 && !query && (
            <div className="text-center text-muted-foreground py-12">
              <svg
                className="w-12 h-12 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
              <p>
                Search for books by title, author, ISBN, or general keywords
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
