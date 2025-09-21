import { UTApi } from "uploadthing/server"

const utapi = new UTApi()

/**
 * Downloads an image from a URL and uploads it to UploadThing
 * @param imageUrl - The URL of the image to download and upload
 * @param fileName - Optional custom filename for the uploaded image
 * @returns Promise<string | null> - Returns the UploadThing URL or null if failed
 */
export async function downloadAndUploadImage(
  imageUrl: string,
  fileName?: string
): Promise<string | null> {
  try {
    // Download the image
    const response = await fetch(imageUrl)
    if (!response.ok) {
      console.error(`Failed to download image: ${response.status}`)
      return null
    }

    // Check if it's actually an image
    const contentType = response.headers.get("content-type")
    if (!contentType?.startsWith("image/")) {
      console.error(`Invalid content type: ${contentType}`)
      return null
    }

    // Get the image data
    const imageBuffer = await response.arrayBuffer()
    const imageBlob = new Blob([imageBuffer], { type: contentType })

    // Generate filename if not provided
    const finalFileName =
      fileName || generateImageFileName(imageUrl, contentType)

    // Create a File object from the blob
    const file = new File([imageBlob], finalFileName, { type: contentType })

    // Upload to UploadThing
    const uploadResult = await utapi.uploadFiles([file])

    if (uploadResult[0]?.data?.url) {
      console.log(`Successfully uploaded image: ${uploadResult[0].data.url}`)
      return uploadResult[0].data.url
    } else {
      console.error("Upload failed:", uploadResult[0]?.error)
      return null
    }
  } catch (error) {
    console.error("Error downloading and uploading image:", error)
    return null
  }
}

/**
 * Generates a filename for an image based on URL and content type
 */
function generateImageFileName(url: string, contentType: string): string {
  // Extract extension from content type
  const extension = contentType.split("/")[1]?.split(";")[0] || "jpg"

  // Generate a unique filename
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)

  // Try to extract some meaningful part from URL
  const urlParts = url.split("/")
  const lastPart = urlParts[urlParts.length - 1]
  const baseName = lastPart.split(".")[0]?.substring(0, 20) || "cover"

  return `${baseName}-${timestamp}-${random}.${extension}`
}

/**
 * Downloads and uploads a book cover image, with retry logic for multiple URLs
 * @param imageUrls - Array of image URLs to try (in priority order)
 * @param bookTitle - Book title for generating filename
 * @param bookAuthor - Book author for generating filename
 * @returns Promise<string | null> - Returns the UploadThing URL or null if all failed
 */
export async function uploadBookCoverImage(
  imageUrls: string[],
  bookTitle: string,
  bookAuthor?: string
): Promise<string | null> {
  // Generate a meaningful filename
  const sanitizeForFilename = (str: string) =>
    str
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase()

  const titlePart = sanitizeForFilename(bookTitle).substring(0, 20)
  const authorPart = bookAuthor
    ? sanitizeForFilename(bookAuthor).substring(0, 15)
    : ""
  const timestamp = Date.now()

  const baseFileName = authorPart
    ? `${titlePart}-${authorPart}-${timestamp}`
    : `${titlePart}-${timestamp}`

  // Try each URL until one succeeds
  for (const imageUrl of imageUrls) {
    if (!imageUrl || imageUrl.trim() === "") continue

    try {
      const result = await downloadAndUploadImage(
        imageUrl,
        `${baseFileName}.jpg`
      )
      if (result) {
        return result
      }
    } catch (error) {
      console.warn(`Failed to upload image from ${imageUrl}:`, error)
      continue
    }
  }

  console.warn(
    `Failed to upload cover image for "${bookTitle}" from all provided URLs`
  )
  return null
}
