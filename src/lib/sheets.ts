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
    range: "Sheet1!A:K", // Adjust to cover your columns
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

        results.push({
          id: item.id,
          title: volumeInfo.title,
          author: volumeInfo.authors?.join(", ") || "Unknown Author",
          publisher: volumeInfo.publisher,
          year: volumeInfo.publishedDate,
          isbn: isbn,
          coverUrl: volumeInfo.imageLinks?.thumbnail,
          description: volumeInfo.description,
          source: "Google Books",
        })
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
          results.push({
            id: doc.key,
            title: doc.title,
            author: doc.author_name?.join(", ") || "Unknown Author",
            publisher: doc.publisher?.[0],
            year: doc.first_publish_year,
            isbn: isbn,
            coverUrl: isbn
              ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
              : undefined,
            source: "Open Library",
          })
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
          results.push({
            id: book.isbn13,
            title: book.title,
            author: book.authors?.join(", ") || "Unknown Author",
            publisher: book.publisher,
            year: book.date_published,
            isbn: book.isbn13,
            coverUrl: book.image,
            source: "ISBN DB",
          })
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

export async function addBook(sheetId: string, values: any[]) {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:K", // adjust to your column range
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
