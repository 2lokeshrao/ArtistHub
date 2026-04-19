/** Google Drive link ko Direct Image link mein badalne ka function */
export function transformDriveLink(url) {
  if (!url) return url;
  
  // Agar link mein 'drive.google.com' hai toh hi badlo
  if (url.includes('drive.google.com')) {
    const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
    if (fileId) {
      // thumbnail wala link sabse fast aur reliable hota hai website ke liye
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  return url; // Agar normal link hai toh waise hi rehne do
}

