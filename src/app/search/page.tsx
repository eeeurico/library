"use client"
import { useState } from "react"

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
}

export default function SearchPage() {
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
          type: "book",
        }),
      })

      if (response.ok) {
        alert(`"${book.title}" has been added to your library!`)
      } else {
        const error = await response.json()
        alert(`Failed to add book: ${error.error}`)
      }
    } catch (err) {
      alert("Failed to add book to library")
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Search & Add Books</h1>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-4 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for books..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={searchType}
            onChange={(e) => setSearchType(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="general">General</option>
            <option value="title">Title</option>
            <option value="author">Author</option>
            <option value="isbn">ISBN</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-4 p-4 bg-red-100 border border-red-300 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {results.map((book) => (
          <div
            key={`${book.source}-${book.id}`}
            className="border border-gray-200 rounded-lg p-6 flex gap-4"
          >
            {book.coverUrl && (
              <img
                src={book.coverUrl}
                alt={book.title}
                className="w-24 h-32 object-cover rounded"
              />
            )}
            <div className="flex-1">
              <h3 className="text-xl font-semibold mb-2">{book.title}</h3>
              <p className="text-gray-600 mb-1">
                <strong>Author:</strong> {book.author}
              </p>
              {book.publisher && (
                <p className="text-gray-600 mb-1">
                  <strong>Publisher:</strong> {book.publisher}
                </p>
              )}
              {book.year && (
                <p className="text-gray-600 mb-1">
                  <strong>Year:</strong> {book.year}
                </p>
              )}
              {book.isbn && (
                <p className="text-gray-600 mb-1">
                  <strong>ISBN:</strong> {book.isbn}
                </p>
              )}
              <p className="text-sm text-gray-500 mb-3">
                Source: {book.source}
              </p>
              {book.description && (
                <p className="text-gray-700 mb-4 text-sm line-clamp-3">
                  {book.description.length > 200
                    ? `${book.description.substring(0, 200)}...`
                    : book.description}
                </p>
              )}
              <button
                onClick={() => handleAddBook(book)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              >
                Add to Library
              </button>
            </div>
          </div>
        ))}
      </div>

      {results.length === 0 && !loading && query && (
        <div className="text-center text-gray-500 py-8">
          No books found for "{query}". Try a different search term or type.
        </div>
      )}
    </div>
  )
}
