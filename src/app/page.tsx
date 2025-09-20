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
  rowIndex: number
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])

  useEffect(() => {
    fetch("/api/books")
      .then((res) => res.json())
      .then(setBooks)
  }, [])

  return (
    <div className="grid grid-cols-2 gap-4">
      {books.map((book) => (
        <div key={book.rowIndex} className="p-4 border rounded">
          {book.coverUrl && (
            <img src={book.coverUrl} alt={book.title} className="w-full" />
          )}
          <h3 className="font-bold">{book.title || "Untitled"}</h3>
          <p>{book.author}</p>
          {book.isbn && <small>ISBN: {book.isbn}</small>}
          {book.price && <p>💰 {book.price}</p>}
        </div>
      ))}
    </div>
  )
}
