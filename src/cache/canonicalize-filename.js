export function canonicalizeFileName(fileName) {
  return fileName.replace(/^\//g, "").replace(/\s+/g, "-").replace(/\//g, "-");
}
