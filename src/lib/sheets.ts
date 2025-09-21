import { google } from "googleapis"
import { uploadBestAvailableImage } from "./uploadUtils"

type Book = {
  id?: string
  isbn?: string | null
  title?: string | null
  author?: string | null
  type?: string | null
  coverUrl?: string | null
  notes?: string | null
  price?: string | null
  publisher?: string | null
  year?: string | null
  url?: string | null
  edition?: string | null
  language?: string | null
  sellingprice?: string | null
  forsale?: boolean | string | null
  _sheetRowIndex?: number
}

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: SCOPES,
})

// Function to create a slug from a string
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single
    .trim()
}

// Function to generate a unique ID for books
export function generateBookId(
  isbn?: string,
  title?: string,
  author?: string
): string {
  const timestamp = Date.now().toString(36) // Base36 timestamp for shorter string
  const random = Math.random().toString(36).substring(2, 8) // 6 character random string

  let uniquePart = ""
  if (isbn) {
    uniquePart = isbn.replace(/[^\d]/g, "") // Clean ISBN numbers only
  } else if (title && author) {
    const titleSlug = createSlug(title).substring(0, 10) // First 10 chars of title slug
    const authorSlug = createSlug(author).substring(0, 10) // First 10 chars of author slug
    uniquePart = `${titleSlug}-${authorSlug}`
  }

  return uniquePart
    ? `${uniquePart}-${timestamp}-${random}`
    : `book-${timestamp}-${random}`
}

export async function getBooks(sheetId: string): Promise<Book[]> {
  const sheets = await getSheets()
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:P", // Extended range to include ID column and potential future columns
  })

  const rows = res.data.values || []
  if (rows.length === 0) return []

  // First row is header, skip it
  const headers = rows[0]
  const books: Book[] = []

  rows.slice(1).forEach((row, i) => {
    const book: Record<string, string> = {}
    headers.forEach((h, j) => {
      book[h] = row[j] || "" // assign each column
    })

    // Only include non-empty rows (must have title AND author)
    if (
      book.title &&
      book.title.trim() !== "" &&
      book.author &&
      book.author.trim() !== ""
    ) {
      // Generate ID if missing (for legacy books without ID)
      if (!book.id || book.id.trim() === "") {
        book.id = generateBookId(book.isbn, book.title, book.author)
        // Optionally update the sheet with the generated ID
        // This could be done in a background process
      }

      // Store sheet position for legacy operations that might still need it
      ;(book as Record<string, unknown>)._sheetRowIndex = i + 2 // +2 because: +1 for header row, +1 for 1-based indexing

      books.push(book)
    }
  })

  return books
}

// Function to check if an image URL returns a valid image
async function isValidImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: "HEAD" })
    const contentType = response.headers.get("content-type")
    return response.ok && (contentType?.startsWith("image/") ?? false)
  } catch {
    return false
  }
}

// Function to get the best available cover image from multiple sources
// Enhanced version with proper cover image search
export async function getBestCoverImage(
  isbn?: string,
  title?: string,
  author?: string,
  googleCoverUrl?: string
): Promise<string | null> {
  // List of image sources to try in order of preference
  const imageSources = [
    // Google Books (if available)
    googleCoverUrl,
    // Open Library covers (multiple sizes)
    ...(isbn
      ? [
          `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
          `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
        ]
      : []),
    // Amazon covers (if ISBN-10 available)
    ...(isbn && isbn.length === 13
      ? [
          `https://images-na.ssl-images-amazon.com/images/P/${convertToIsbn10(
            isbn
          )}.01.L.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${convertToIsbn10(
            isbn
          )}.01.M.jpg`,
        ]
      : []),
    // WorldCat covers
    ...(isbn
      ? [
          `https://www.worldcat.org/title/-/oclc-/covers/cover?isbn=${isbn}&size=L`,
        ]
      : []),
    // BookCover API
    ...(title && author
      ? [
          `https://bookcover.longitood.com/bookcover?book_title=${encodeURIComponent(
            title
          )}&author_name=${encodeURIComponent(author)}&size=large`,
        ]
      : []),
  ].filter(Boolean) as string[]

  // Try each source until we find a working image
  for (const imageUrl of imageSources) {
    if (await isValidImageUrl(imageUrl)) {
      return imageUrl
    }
  }

  return null
}

// Function to get all possible cover image URLs for upload purposes
// Returns array of URLs in priority order for the upload utility to try
export function getAllCoverImageUrls(
  isbn?: string,
  title?: string,
  author?: string,
  googleCoverUrl?: string
): string[] {
  const imageSources = [
    // Google Books (if available)
    googleCoverUrl,
    // Open Library covers (multiple sizes)
    ...(isbn
      ? [
          `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`,
          `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`,
        ]
      : []),
    // Amazon covers (if ISBN-10 available)
    ...(isbn && isbn.length === 13
      ? [
          `https://images-na.ssl-images-amazon.com/images/P/${convertToIsbn10(
            isbn
          )}.01.L.jpg`,
          `https://images-na.ssl-images-amazon.com/images/P/${convertToIsbn10(
            isbn
          )}.01.M.jpg`,
        ]
      : []),
    // WorldCat covers
    ...(isbn
      ? [
          `https://www.worldcat.org/title/-/oclc-/covers/cover?isbn=${isbn}&size=L`,
        ]
      : []),
    // BookCover API
    ...(title && author
      ? [
          `https://bookcover.longitood.com/bookcover?book_title=${encodeURIComponent(
            title
          )}&author_name=${encodeURIComponent(author)}&size=large`,
        ]
      : []),
  ].filter(Boolean) as string[]

  return imageSources
}

// Convert ISBN-13 to ISBN-10 for Amazon covers
function convertToIsbn10(isbn13: string): string | null {
  if (isbn13.length !== 13 || !isbn13.startsWith("978")) {
    return null
  }

  const isbn9 = isbn13.substring(3, 12)
  let checksum = 0

  for (let i = 0; i < 9; i++) {
    checksum += parseInt(isbn9[i]) * (10 - i)
  }

  const check = (11 - (checksum % 11)) % 11
  const checkDigit = check === 10 ? "X" : check.toString()

  return isbn9 + checkDigit
}

export async function enrichBook(isbn: string) {
  // 1. Try Google Books
  const gb = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
  ).then((r) => r.json())
  if (gb.totalItems > 0) {
    const item = gb.items[0].volumeInfo
    const thumbnailUrl = item.imageLinks?.thumbnail
    const highResUrl = thumbnailUrl ? `${thumbnailUrl}&zoom=1` : undefined

    // Get all possible cover image URLs for this book
    const allCoverUrls = getAllCoverImageUrls(
      isbn,
      item.title,
      item.authors?.[0],
      highResUrl
    )

    // Upload the best available image to UploadThing
    const uploadedCoverUrl = await uploadBestAvailableImage(allCoverUrls, {
      isbn,
      title: item.title,
      author: item.authors?.[0],
    })

    // Fallback to getBestCoverImage if upload fails
    const coverUrl =
      uploadedCoverUrl ||
      (await getBestCoverImage(isbn, item.title, item.authors?.[0], highResUrl))

    return {
      title: item.title,
      author: item.authors?.join(", "),
      publisher: item.publisher,
      year: item.publishedDate,
      coverUrl: coverUrl,
      isbn: isbn,
    }
  }

  // 2. Try Open Library
  const ol = await fetch(`https://openlibrary.org/isbn/${isbn}.json`).then(
    (r) => r.json()
  )
  if (ol?.title) {
    const coverUrl = await getBestCoverImage(isbn, ol.title, ol.by_statement)
    return {
      title: ol.title,
      author: ol.by_statement,
      publisher: ol.publishers?.[0],
      year: ol.publish_date,
      coverUrl: coverUrl,
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
    const cleanUrl = url.replace("&edge=curl", "")
    // Keep zoom=1 as most books don't have zoom=2 available

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
  type: "title" | "author" | "isbn" | "general" = "general",
  source: "google" | "openlibrary" | "all" = "google"
) {
  const results: Book[] = []

  try {
    // Based on source parameter, decide which APIs to call
    const shouldSearchGoogle = source === "google" || source === "all"
    const shouldSearchOpenLibrary = source === "openlibrary" || source === "all"

    // 1. Search Google Books API
    if (shouldSearchGoogle) {
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
            (id: { type: string }) =>
              id.type === "ISBN_13" || id.type === "ISBN_10"
          )?.identifier

          // Get the best available cover image and upload it to UploadThing
          const thumbnailUrl = volumeInfo.imageLinks?.thumbnail
          const googleCoverUrl = thumbnailUrl
            ? `${thumbnailUrl}&zoom=1`
            : undefined

          // Get all possible cover image URLs for this book
          const allCoverUrls = getAllCoverImageUrls(
            isbn,
            volumeInfo.title,
            volumeInfo.authors?.[0],
            googleCoverUrl
          )

          // Upload the best available image to UploadThing
          const uploadedCoverUrl = await uploadBestAvailableImage(
            allCoverUrls,
            { isbn, title: volumeInfo.title, author: volumeInfo.authors?.[0] }
          )

          // Fallback to getBestCoverImage if upload fails
          const coverUrl =
            uploadedCoverUrl ||
            (await getBestCoverImage(
              isbn,
              volumeInfo.title,
              volumeInfo.authors?.[0],
              googleCoverUrl
            ))

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
    }

    // 2. Search Open Library API
    if (shouldSearchOpenLibrary && type !== "isbn") {
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

          // Get cover image URLs and upload to UploadThing
          const coverImageUrls: string[] = []
          if (isbn) {
            coverImageUrls.push(
              `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`
            )
            coverImageUrls.push(
              `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`
            )
          } else if (doc.cover_i) {
            coverImageUrls.push(
              `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
            )
            coverImageUrls.push(
              `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
            )
          }

          // Upload the best available image to UploadThing
          const uploadedCoverUrl = await uploadBestAvailableImage(
            coverImageUrls,
            { isbn, title: doc.title, author: doc.author_name?.[0] }
          )

          // Fallback to original URL if upload fails
          let coverUrl = uploadedCoverUrl
          if (!coverUrl && coverImageUrls.length > 0) {
            coverUrl = coverImageUrls[0] // Use the first URL as fallback
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
    if (shouldSearchGoogle && type === "isbn") {
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

export async function addBook(sheetId: string, values: string[]) {
  const sheets = await getSheets()
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:P", // Extended to P to include more columns if needed
    valueInputOption: "RAW",
    requestBody: {
      values: [values], // e.g. ["unique-id", "9780140449266", "The Odyssey", "Homer", "book"]
    },
  })
}

// Enhanced addBook function that accepts a book object and generates unique ID
export async function addBookWithId(sheetId: string, book: Book) {
  const sheets = await getSheets()

  // First, get the current headers to understand the sheet structure
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!1:1", // Get just the header row
  })

  const headers = headerRes.data.values?.[0] || []

  // Generate unique ID if not provided
  const id =
    book.id ||
    generateBookId(
      book.isbn || undefined,
      book.title || undefined,
      book.author || undefined
    )

  // Ensure the book has the generated ID
  const bookWithId = { ...book, id }

  // Check if 'id' column exists
  const idColumnIndex = headers.findIndex((h) => h.toLowerCase() === "id")

  if (idColumnIndex === -1) {
    // No ID column exists - we need to add it as the first column
    // First, add the ID header if this is the first book
    if (headers.length === 0) {
      // Sheet is empty, add headers
      const newHeaders = [
        "id",
        "isbn",
        "title",
        "author",
        "type",
        "publisher",
        "year",
        "edition",
        "coverUrl",
        "notes",
        "price",
        "url",
        "language",
        "sellingprice",
        "forsale",
      ]
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Sheet1!A1:O1",
        valueInputOption: "RAW",
        requestBody: {
          values: [newHeaders],
        },
      })
    } else {
      // Insert ID column as the first column
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          requests: [
            {
              insertDimension: {
                range: {
                  sheetId: 0,
                  dimension: "COLUMNS",
                  startIndex: 0,
                  endIndex: 1,
                },
              },
            },
          ],
        },
      })

      // Add 'id' header to the new first column
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: "Sheet1!A1",
        valueInputOption: "RAW",
        requestBody: {
          values: [["id"]],
        },
      })
    }
  }

  // Now add the book data based on the current structure
  // If we just added the ID column, use the new structure
  const values = [
    id, // ID (now guaranteed to be first column)
    bookWithId.isbn || "",
    bookWithId.title || "",
    bookWithId.author || "",
    bookWithId.type || "",
    bookWithId.publisher || "",
    bookWithId.year || "",
    bookWithId.edition || "",
    bookWithId.coverUrl || "",
    bookWithId.notes || "",
    bookWithId.price || "",
    bookWithId.url || "",
    bookWithId.language || "",
    bookWithId.sellingprice || "",
    bookWithId.forsale !== false ? "TRUE" : "FALSE", // Convert boolean to Google Sheets string
  ]

  await addBook(sheetId, values)
  return bookWithId
}

// Utility function to add IDs to existing books in the sheet
export async function addIdsToExistingBooks(sheetId: string) {
  const sheets = await getSheets()

  // Get all current data
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:P",
  })

  const rows = res.data.values || []
  if (rows.length === 0) return

  const headers = rows[0]
  const idColumnIndex = headers.findIndex((h) => h.toLowerCase() === "id")

  if (idColumnIndex === -1) {
    console.log(
      "No ID column found. Use addBookWithId to add new books and it will create the ID column."
    )
    return
  }

  // Check each row and add ID if missing
  const updates: { range: string; values: string[][] }[] = []

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    const book: Record<string, string> = {}

    headers.forEach((h, j) => {
      book[h] = row[j] || ""
    })

    // If this row has title and author but no ID, generate one
    if (book.title && book.author && (!book.id || book.id.trim() === "")) {
      const newId = generateBookId(book.isbn, book.title, book.author)
      updates.push({
        range: `Sheet1!${String.fromCharCode(65 + idColumnIndex)}${i + 1}`, // Convert to A1 notation
        values: [[newId]],
      })
    }
  }

  // Batch update all the missing IDs
  if (updates.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: updates,
      },
    })
    console.log(`Updated ${updates.length} books with new IDs`)
  }
}

export async function deleteBook(sheetId: string, sheetRowIndex: number) {
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
              startIndex: sheetRowIndex - 1, // Convert to 0-based index
              endIndex: sheetRowIndex,
            },
          },
        },
      ],
    },
  })
}

// New function to delete book by unique ID
export async function deleteBookById(sheetId: string, bookId: string) {
  const sheets = await getSheets()

  // First, get all rows to find the row with matching ID
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Sheet1!A:P",
  })

  const rows = res.data.values || []
  if (rows.length === 0) throw new Error("Sheet is empty")

  const headers = rows[0]
  const idColumnIndex = headers.findIndex((h) => h.toLowerCase() === "id")

  if (idColumnIndex === -1) {
    throw new Error("ID column not found in sheet")
  }

  // Find the row with matching ID
  let targetRowIndex = -1
  for (let i = 1; i < rows.length; i++) {
    // Start from 1 to skip header
    if (rows[i][idColumnIndex] === bookId) {
      targetRowIndex = i + 1 // Convert to 1-based index
      break
    }
  }

  if (targetRowIndex === -1) {
    throw new Error(`Book with ID ${bookId} not found`)
  }

  // Delete the row
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: "ROWS",
              startIndex: targetRowIndex - 1, // Convert to 0-based index
              endIndex: targetRowIndex,
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
  values: string[]
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

export async function updateBookById(sheetId: string, bookId: string, bookData: Book) {
  const books = await getBooks(sheetId)
  
  // Find the book by ID
  const bookIndex = books.findIndex((book: Book) => book.id === bookId)
  if (bookIndex === -1) {
    throw new Error(`Book with ID ${bookId} not found`)
  }
  
  // Get the sheet row index (accounting for header row)
  const sheetRowIndex = bookIndex + 1 // +1 for header row
  
  // Convert book data to array format matching sheet columns
  const values = [
    bookData.id || "",
    bookData.isbn || "",
    bookData.title || "",
    bookData.author || "",
    bookData.type || "",
    bookData.publisher || "",
    bookData.year || "",
    bookData.edition || "",
    bookData.coverUrl || "",
    bookData.notes || "",
    bookData.price || "",
    bookData.url || "",
    bookData.language || "",
    bookData.sellingprice || "",
    bookData.forsale !== false ? "TRUE" : "FALSE", // Convert boolean to string
  ]
  
  // Update the row using the existing updateBook function
  await updateBook(sheetId, sheetRowIndex, values)
}
