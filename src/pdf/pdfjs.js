/*
 * pdf.js laddas dynamiskt vid första användningen — biblioteket (och dess
 * worker) är appens tyngsta beroende och ska inte ligga i startbunten.
 */
let libPromise = null;

function getLib() {
  if (!libPromise) {
    libPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return libPromise;
}

/** Öppnar ett pdf.js-dokument från en Blob. Anroparen ansvarar för destroy(). */
export async function openPdfFromBlob(blob) {
  const pdfjsLib = await getLib();
  const data = await blob.arrayBuffer();
  const task = pdfjsLib.getDocument({ data, isEvalSupported: false });
  return task.promise;
}

/** Snabb validering + sidräkning vid import. */
export async function inspectPdf(blob) {
  const doc = await openPdfFromBlob(blob);
  const pageCount = doc.numPages;
  await doc.destroy();
  return { pageCount };
}
