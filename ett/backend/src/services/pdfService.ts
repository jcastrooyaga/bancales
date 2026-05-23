export const generatePDF = async (requestId: string): Promise<Buffer> => {
  // Stub: return empty buffer in dev
  console.log(`[PDF STUB] Generating PDF for request ${requestId}`);
  return Buffer.from('PDF stub');
};
