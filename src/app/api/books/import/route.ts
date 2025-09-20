import { NextRequest, NextResponse } from "next/server"
import { getBestCoverImage, getBooks, addBook } from "@/lib/sheets"

// Helper function to clean ISBN from Goodreads format
function cleanISBN(isbn: string): string {
  if (!isbn) return ""
  // Remove Excel formatting like ="value" and quotes
  return isbn.replace(/^="?|"?$/g, "").trim()
}

// Helper function to parse CSV row into book object
function parseCSVBook(row: string[]): any {
  // Based on Goodreads CSV structure
  const [
    bookId,
    title,
    author,
    authorLf,
    additionalAuthors,
    isbn,
    isbn13,
    myRating,
    averageRating,
    publisher,
    binding,
    numberOfPages,
    yearPublished,
    originalPublicationYear,
    dateRead,
    dateAdded,
    bookshelves,
    bookshelvesWithPositions,
    exclusiveShelf,
    myReview,
    spoiler,
    privateNotes,
    readCount,
    ownedCopies,
  ] = row

  if (!title || !author) {
    return null
  }

  const cleanISBN10 = cleanISBN(isbn)
  const cleanISBN13 = cleanISBN(isbn13)
  const bestISBN = cleanISBN13 || cleanISBN10

  return {
    title: title.trim(),
    author: author.trim(),
    isbn: bestISBN,
    publisher: publisher?.trim() || "",
    year: yearPublished?.trim() || originalPublicationYear?.trim() || "",
    notes: privateNotes?.trim() || "",
    type: "book",
    language: "", // Will be enriched
    coverUrl: "", // Will be enriched
    url: "", // Will be enriched
  }
}

// Helper function to parse CSV content
function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split("\n")
  const books: any[] = []

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    try {
      // Parse CSV row respecting quoted values
      const row: string[] = []
      let current = ""
      let inQuotes = false
      let j = 0

      while (j < line.length) {
        const char = line[j]

        if (char === '"') {
          if (inQuotes && line[j + 1] === '"') {
            // Escaped quote
            current += '"'
            j += 2
          } else {
            // Toggle quote state
            inQuotes = !inQuotes
            j++
          }
        } else if (char === "," && !inQuotes) {
          // Field separator
          row.push(current)
          current = ""
          j++
        } else {
          current += char
          j++
        }
      }

      // Add the last field
      row.push(current)

      const book = parseCSVBook(row)
      if (book) {
        books.push(book)
      }
    } catch (error) {
      console.warn(`Error parsing CSV line ${i}:`, error)
    }
  }

  return books
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("csvFile") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload a CSV file." },
        { status: 400 }
      )
    }

    const csvContent = await file.text()
    const parsedBooks = parseCSV(csvContent)

    if (parsedBooks.length === 0) {
      return NextResponse.json(
        { error: "No valid books found in the CSV file" },
        { status: 400 }
      )
    }

    // Get existing books to check for duplicates
    const existingBooks = await getBooks(process.env.SHEET_ID!)
    const existingISBNs = new Set(
      existingBooks
        .filter((book: any) => book.isbn)
        .map((book: any) => book.isbn)
    )

    // Create a streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendProgress = (progress: number) => {
          const data = JSON.stringify({ type: "progress", progress }) + "\n"
          controller.enqueue(encoder.encode(data))
        }

        const sendResult = (result: any) => {
          const data = JSON.stringify({ type: "result", result }) + "\n"
          controller.enqueue(encoder.encode(data))
        }

        const result = {
          total: parsedBooks.length,
          processed: 0,
          added: 0,
          skipped: 0,
          errors: [] as string[],
          duplicates: [] as string[],
        }

        // Process books in batches
        const batchSize = 5
        for (let i = 0; i < parsedBooks.length; i += batchSize) {
          const batch = parsedBooks.slice(i, i + batchSize)

          for (const book of batch) {
            try {
              result.processed++

              // Check for duplicates by ISBN
              if (book.isbn && existingISBNs.has(book.isbn)) {
                result.skipped++
                result.duplicates.push(`${book.title} by ${book.author}`)
                continue
              }

              // Check for duplicates by title + author (case insensitive)
              const titleAuthorKey = `${book.title.toLowerCase()}|${book.author.toLowerCase()}`
              const isDuplicateByTitle = existingBooks.some(
                (existing: any) =>
                  `${existing.title.toLowerCase()}|${existing.author.toLowerCase()}` ===
                  titleAuthorKey
              )

              if (isDuplicateByTitle) {
                result.skipped++
                result.duplicates.push(`${book.title} by ${book.author}`)
                continue
              }

              // Enrich book data
              if (book.isbn) {
                try {
                  const coverUrl = await getBestCoverImage(
                    book.isbn,
                    book.title,
                    book.author
                  )
                  if (coverUrl) {
                    book.coverUrl = coverUrl
                  }
                } catch (error) {
                  console.warn(`Failed to get cover for ${book.title}:`, error)
                }
              }

              // Add the book
              const values = [
                "", // id - auto-generated
                book.isbn || "",
                book.title || "",
                book.author || "",
                book.type || "book",
                book.publisher || "",
                book.year || "",
                "", // edition
                book.coverUrl || "",
                book.notes || "",
                "", // price
                book.url || "",
                book.language || "",
                "", // sellingprice
                "FALSE", // notforsale
              ]
              await addBook(process.env.SHEET_ID!, values)
              result.added++

              // Add to existing ISBNs to prevent duplicates within this import
              if (book.isbn) {
                existingISBNs.add(book.isbn)
              }
            } catch (error) {
              console.error(`Error processing book ${book.title}:`, error)
              result.errors.push(
                `Failed to add "${book.title}" by ${book.author}: ${
                  error instanceof Error ? error.message : "Unknown error"
                }`
              )
            }

            // Send progress update
            const progress = Math.round(
              (result.processed / parsedBooks.length) * 100
            )
            sendProgress(progress)
          }

          // Small delay between batches to prevent overwhelming the APIs
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        // Send final result
        sendResult(result)
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (error) {
    console.error("Import error:", error)
    return NextResponse.json(
      { error: "Failed to import books" },
      { status: 500 }
    )
  }
}
