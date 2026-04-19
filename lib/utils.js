// lib/utils.js
export function transformDriveLink(url) {
  if (!url || typeof url !== 'string') return url;
  
  // Agar Google Drive link hai toh transform karo
  if (url.includes('drive.google.com')) {
    const fileId = url.split('/d/')[1]?.split('/')[0] || url.split('id=')[1]?.split('&')[0];
    if (fileId) {
      return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    }
  }
  
  // Agar normal image link ya Instagram image address hai toh waise hi rehne do
  return url;
}
