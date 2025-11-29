import { parse } from 'csv-parse';
import { Readable } from 'stream';

/**
 * Parse CSV buffer and return array of objects
 * @param {Buffer} buffer - CSV file buffer
 * @param {Array<string>} headers - Expected CSV headers
 * @returns {Promise<Array<Object>>}
 */
export const parseCSV = (buffer, headers) => {
  return new Promise((resolve, reject) => {
    const records = [];
    const parser = parse({
      columns: true, // Use first line as headers
      skip_empty_lines: true,
      trim: true
    });

    // Collect records
    parser.on('readable', function() {
      let record;
      while ((record = parser.read()) !== null) {
        records.push(record);
      }
    });

    // Validate headers when they're read
    parser.on('headers', (csvHeaders) => {
      const missingHeaders = headers.filter(h => !csvHeaders.includes(h));
      if (missingHeaders.length > 0) {
        reject(new Error(`Missing required headers: ${missingHeaders.join(', ')}`));
      }
    });

    // Handle end of parsing
    parser.on('end', () => resolve(records));
    
    // Handle errors
    parser.on('error', (err) => reject(err));

    // Feed the parser
    Readable.from(buffer).pipe(parser);
  });
};