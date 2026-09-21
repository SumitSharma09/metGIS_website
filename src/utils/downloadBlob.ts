/** Triggers a browser "Save As" for an in-memory Blob - the shared last
 *  step for every client-generated export (Excel via ExcelJS, and anything
 *  else that ends up as a Blob rather than a data URL). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
