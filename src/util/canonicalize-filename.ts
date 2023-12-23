export function canonicalizeFileName(fileName: string) {
  return fileName.replace(/^\//g, '').replace(/\s+/g, '-').replace(/\//g, '-');
}
