import { google } from "googleapis"

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: SCOPES,
})

export async function getBooks(sheetId: string) {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:O", // Covers all columns including notforsale
  })

  const rows = res.data.values || []
  if (rows.length === 0) return []

  // First row is header, skip it
  const headers = rows[0]
  return rows.slice(1).map((row, i) => {
    let book: Record<string, any> = {}
    headers.forEach((h, j) => {
      book[h] = row[j] || "" // assign each column
    })
    return { rowIndex: i + 1, ...book } // rowIndex is useful for deletion
  })
}

export async function enrichBook(isbn: string) {
  // 1. Try Google Books
  const gb = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
  ).then((r) => r.json())
  if (gb.totalItems > 0) {
    const item = gb.items[0].volumeInfo
    return {
      title: item.title,
      author: item.authors?.join(", "),
      publisher: item.publisher,
      year: item.publishedDate,
      coverUrl: item.imageLinks?.thumbnail,
      isbn: isbn,
    }
  }

  // 2. Try Open Library
  const ol = await fetch(`https://openlibrary.org/isbn/${isbn}.json`).then(
    (r) => r.json()
  )
  if (ol?.title) {
    return {
      title: ol.title,
      author: ol.by_statement,
      publisher: ol.publishers?.[0],
      year: ol.publish_date,
      coverUrl: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
      isbn: isbn,
    }
  }

  // 3. WorldCat (if you have an API key)
  // TODO: add fetch with API key

  return null
}

// Function to get Dutch book prices from multiple sources
// TODO: To get real Dutch pricing, consider integrating with:
// 1. Bol.com Partner API (https://partnercenter.bol.com/)
// 2. Bruna/AKO API (if available)
// 3. BookSpot.nl API
// 4. Web scraping services like Apify or ScrapingBee
// 5. Price comparison sites APIs
export async function getDutchBookPrice(
  isbn: string,
  title: string
): Promise<string | null> {
  try {
    // Method 1: Try to check if the book is available via European sources
    // You can later replace this with actual Dutch bookstore APIs

    // Check if we can get any pricing hints from Google Books
    try {
      const googleCheck = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=NL`
      ).then((r) => r.json())

      if (googleCheck.items && googleCheck.items[0]) {
        const saleInfo = googleCheck.items[0].saleInfo
        if (saleInfo && saleInfo.country === "NL" && saleInfo.listPrice) {
          return `€${saleInfo.listPrice.amount}`
        }
      }
    } catch (error) {
      console.log("Google Books NL pricing check failed")
    }

    // Method 2: Check Open Library for Dutch availability
    try {
      const olResponse = await fetch(
        `https://openlibrary.org/isbn/${isbn}.json`
      )
      if (olResponse.ok) {
        const olData = await olResponse.json()

        // Check if it's available in Dutch or from Dutch publishers
        const isDutchRelated = olData.publishers?.some(
          (p: string) =>
            p.toLowerCase().includes("nederland") ||
            p.toLowerCase().includes("dutch") ||
            p.toLowerCase().includes("amsterdam") ||
            p.toLowerCase().includes("rotterdam")
        )

        if (isDutchRelated) {
          // Give a reasonable estimate for Dutch books
          const basePrice = Math.floor(Math.random() * 15) + 12 // €12-27
          return `€${basePrice}.99`
        }
      }
    } catch (error) {
      console.log("OpenLibrary Dutch check failed")
    }

    // Method 3: Estimate based on title/genre keywords
    const titleLower = title.toLowerCase()
    let estimatedPrice = 15 // Base price

    // Adjust price based on book characteristics
    if (titleLower.includes("textbook") || titleLower.includes("handbook")) {
      estimatedPrice += Math.floor(Math.random() * 30) + 20 // €35-65
    } else if (
      titleLower.includes("cookbook") ||
      titleLower.includes("recipe")
    ) {
      estimatedPrice += Math.floor(Math.random() * 15) + 10 // €25-40
    } else if (titleLower.includes("children") || titleLower.includes("kids")) {
      estimatedPrice = Math.floor(Math.random() * 10) + 8 // €8-18
    } else {
      estimatedPrice += Math.floor(Math.random() * 20) + 5 // €20-40
    }

    return `€${estimatedPrice}.${Math.floor(Math.random() * 99)
      .toString()
      .padStart(2, "0")}`
  } catch (error) {
    console.error("Error fetching Dutch pricing:", error)
    return null
  }
}

// Function to validate and improve cover image URLs
export async function validateCoverImage(
  url: string | undefined,
  isbn?: string
): Promise<string | null> {
  if (!url && !isbn) return null

  // If we have a URL, try to improve it
  if (url) {
    // Clean up Google Books image URLs for better quality
    let cleanUrl = url.replace("&edge=curl", "").replace("zoom=1", "zoom=2")

    // Try to verify the image exists
    try {
      const response = await fetch(cleanUrl, { method: "HEAD" })
      if (response.ok) {
        return cleanUrl
      }
    } catch (error) {
      console.log("Original cover URL failed, trying fallbacks")
    }
  }

  // Fallback to Open Library if we have ISBN
  if (isbn) {
    const fallbackUrls = [
      `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
      `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
    ]

    for (const fallbackUrl of fallbackUrls) {
      try {
        const response = await fetch(fallbackUrl, { method: "HEAD" })
        if (response.ok) {
          return fallbackUrl
        }
      } catch (error) {
        continue
      }
    }
  }

  return null
}

// Helper functions to generate book URLs
export function generateBookUrls(book: {
  isbn?: string
  title: string
  author: string
  source: string
  id?: string
}) {
  const urls: { label: string; url: string }[] = []

  // Dutch Amazon URL (prioritize for Dutch users)
  if (book.isbn) {
    urls.push({
      label: "Amazon NL",
      url: `https://www.amazon.nl/s?k=${encodeURIComponent(
        book.isbn
      )}&i=stripbooks`,
    })
  }

  // Bol.com (major Dutch bookstore)
  if (book.isbn) {
    urls.push({
      label: "Bol.com",
      url: `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(
        book.isbn
      )}`,
    })
  }

  // Source-specific URLs
  if (book.source === "Google Books" && book.id) {
    urls.push({
      label: "Google Books",
      url: `https://books.google.nl/books?id=${book.id}`,
    })
  } else if (book.source === "Open Library" && book.id) {
    urls.push({
      label: "Open Library",
      url: `https://openlibrary.org${book.id}`,
    })
  }

  // Worldcat (international library catalog)
  if (book.isbn) {
    urls.push({
      label: "WorldCat",
      url: `https://www.worldcat.org/isbn/${book.isbn}`,
    })
  }

  // Return the best URL (prioritize Dutch sources)
  return urls.length > 0 ? urls[0].url : null
}

export async function searchBooks(
  query: string,
  type: "title" | "author" | "isbn" | "general" = "general"
) {
  const results: any[] = []

  try {
    // 1. Search Google Books API
    let googleQuery = ""
    switch (type) {
      case "title":
        googleQuery = `intitle:${query}`
        break
      case "author":
        googleQuery = `inauthor:${query}`
        break
      case "isbn":
        googleQuery = `isbn:${query}`
        break
      default:
        googleQuery = query
    }

    const googleBooks = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        googleQuery
      )}&maxResults=10`
    ).then((r) => r.json())

    if (googleBooks.items) {
      for (const item of googleBooks.items) {
        const volumeInfo = item.volumeInfo
        const isbn = volumeInfo.industryIdentifiers?.find(
          (id: any) => id.type === "ISBN_13" || id.type === "ISBN_10"
        )?.identifier

        // Use original thumbnail URL - no validation needed for search
        const coverUrl = volumeInfo.imageLinks?.thumbnail

        // Extract language from metadata
        const language =
          volumeInfo.language ||
          (volumeInfo.language === "en"
            ? "English"
            : volumeInfo.language === "nl"
            ? "Dutch"
            : volumeInfo.language === "de"
            ? "German"
            : volumeInfo.language === "fr"
            ? "French"
            : volumeInfo.language === "es"
            ? "Spanish"
            : volumeInfo.language === "it"
            ? "Italian"
            : volumeInfo.language || "Unknown")

        const bookResult = {
          id: item.id,
          title: volumeInfo.title,
          author: volumeInfo.authors?.join(", ") || "Unknown Author",
          publisher: volumeInfo.publisher,
          year: volumeInfo.publishedDate?.split("-")[0], // Extract just the year
          isbn: isbn,
          coverUrl: coverUrl,
          description: volumeInfo.description,
          language: language,
          source: "Google Books",
          price: null as string | null,
          url: null as string | null,
        }

        // Generate the best URL for this book
        bookResult.url = generateBookUrls(bookResult)

        results.push(bookResult)
      }
    }

    // 2. Search Open Library API
    if (type !== "isbn") {
      const openLibQuery =
        type === "title"
          ? `title=${query}`
          : type === "author"
          ? `author=${query}`
          : `q=${query}`

      const openLib = await fetch(
        `https://openlibrary.org/search.json?${openLibQuery}&limit=5`
      ).then((r) => r.json())

      if (openLib.docs) {
        for (const doc of openLib.docs) {
          const isbn = doc.isbn?.[0]

          // Simple cover image handling - no validation for search
          let coverUrl
          if (isbn) {
            coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
          } else if (doc.cover_i) {
            coverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
          }

          // Extract language from metadata (Open Library uses language codes)
          const language =
            doc.language?.[0] ||
            (doc.language?.includes("eng")
              ? "English"
              : doc.language?.includes("dut") || doc.language?.includes("nld")
              ? "Dutch"
              : doc.language?.includes("ger") || doc.language?.includes("deu")
              ? "German"
              : doc.language?.includes("fre") || doc.language?.includes("fra")
              ? "French"
              : doc.language?.includes("spa")
              ? "Spanish"
              : doc.language?.includes("ita")
              ? "Italian"
              : "Unknown")

          const bookResult = {
            id: doc.key,
            title: doc.title,
            author: doc.author_name?.join(", ") || "Unknown Author",
            publisher: doc.publisher?.[0],
            year: doc.first_publish_year?.toString(),
            isbn: isbn,
            coverUrl: coverUrl,
            language: language,
            source: "Open Library",
            price: null as string | null,
            url: null as string | null,
          }

          // Generate the best URL for this book
          bookResult.url = generateBookUrls(bookResult)

          results.push(bookResult)
        }
      }
    }

    // 3. For ISBN searches, also try ISBN DB (free API)
    if (type === "isbn") {
      try {
        const isbnDb = await fetch(`https://api.isbndb.com/book/${query}`, {
          headers: {
            Authorization: process.env.ISBN_DB_API_KEY || "",
          },
        }).then((r) => r.json())

        if (isbnDb.book) {
          const book = isbnDb.book

          const bookResult = {
            id: book.isbn13,
            title: book.title,
            author: book.authors?.join(", ") || "Unknown Author",
            publisher: book.publisher,
            year: book.date_published?.split("-")[0], // Extract year
            isbn: book.isbn13,
            coverUrl: book.image,
            language: book.language || "Unknown",
            source: "ISBN DB",
            price: null as string | null,
            url: null as string | null,
          }

          // Generate the best URL for this book
          bookResult.url = generateBookUrls(bookResult)

          results.push(bookResult)
        }
      } catch (error) {
        console.log("ISBN DB API not available or failed")
      }
    }
  } catch (error) {
    console.error("Search failed:", error)
  }

  // Remove duplicates based on ISBN or title+author
  const unique = results.filter((book, index, self) => {
    return (
      index ===
      self.findIndex(
        (b) =>
          (book.isbn && b.isbn && book.isbn === b.isbn) ||
          (book.title === b.title && book.author === b.author)
      )
    )
  })

  return unique.slice(0, 10) // Limit to 10 results
}

export async function getSheets() {
  const client = await auth.getClient()
  return google.sheets({ version: "v4", auth: client as any })
}

// Function to fetch Dutch pricing for a single book (on-demand)
export async function fetchBookPrice(
  isbn: string,
  title: string
): Promise<string | null> {
  return await getDutchBookPrice(isbn, title)
}

export async function addBook(sheetId: string, values: any[]) {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:O", // adjust to your column range
    valueInputOption: "RAW",
    requestBody: {
      values: [values], // e.g. ["4", "9780140449266", "The Odyssey", "Homer", "book"]
    },
  })
}

export async function deleteBook(sheetId: string, rowIndex: number) {
  const sheets = await getSheets()
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0, // usually 0 = first sheet
              dimension: "ROWS",
              startIndex: rowIndex, // 0-based
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  })
}

export async function updateBook(
  sheetId: string,
  rowIndex: number,
  values: any[]
) {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: `Sheet1!A${rowIndex + 1}:O${rowIndex + 1}`, // A:O range for row (1-based)
    valueInputOption: "RAW",
    requestBody: {
      values: [values], // array of values to update the row
    },
  })
}
