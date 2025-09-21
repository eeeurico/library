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

export default function SearchPage() {
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
          type: "paperback",
        }),
      })

      if (response.ok) {
        // Clear the books cache so it refreshes on next visit
        localStorage.removeItem("bookLibrary_books")
        localStorage.removeItem("bookLibrary_books_timestamp")

        showToast(`"${book.title}" has been added to your library!`, "success")
      } else {
        const error = await response.json()
        showToast(`Failed to add book: ${error.error}`, "error")
      }
    } catch (err) {
      showToast("Failed to add book to library", "error")
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-4xl font-light tracking-tight text-foreground mb-8">
        Search
      </h1>

      <form onSubmit={handleSearch} className="mb-12">
        <div className="flex gap-4 mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for books..."
            className="flex h-10 w-full rounded-sm border border-[#282828] bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white transition-colors flex-1"
          />
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as any)}
            className="flex h-10 w-32 rounded-sm border border-[#282828] bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:border-white transition-colors cursor-pointer"
          >
            <option value="general">General</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="isbn">ISBN</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 text-destructive rounded text-sm">
          {error}
        </div>
      )}

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
                  <p className="text-sm text-muted-foreground">{book.year}</p>
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
                <p className="text-xs text-muted-foreground">{book.source}</p>
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
                className="inline-flex items-center justify-center px-6 py-2 text-sm font-normal bg-[rgba(96,96,96,0.5)] text-white hover:bg-[#595959] transition-colors rounded-sm"
              >
                Add to Library
              </button>
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && query && (
        <div className="text-center text-muted-foreground py-12">
          No books found for "{query}"
        </div>
      )}
    </div>
  )
}
