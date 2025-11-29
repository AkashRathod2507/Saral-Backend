import { Item } from "../models/item.model.js";
import { StockMovement } from "../models/stock_movement.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { parseCSV } from '../utils/csvParser.js';
import multer from 'multer';

export const getInventory = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  // Only products are stored in physical inventory
  const items = await Item.find({ organization_id, item_type: 'product' }).select("name item_type unit_price stock_quantity hsn_sac_code tax_rate");
  return res.status(200).json(new ApiResponse(200, items, "Inventory fetched"));
});

export const adjustStock = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const { item_id, quantity_change, reason, notes } = req.body;

  if (!item_id || !quantity_change) {
    throw new ApiError(400, "item_id and quantity_change are required");
  }

  const item = await Item.findOne({ _id: item_id, organization_id });
  if (!item) throw new ApiError(404, "Item not found");

  const newQty = (item.stock_quantity || 0) + Number(quantity_change);
  if (newQty < 0) throw new ApiError(400, "Stock cannot be negative");

  item.stock_quantity = newQty;
  await item.save();

  const movement = await StockMovement.create({ organization_id, item_id, quantity_change: Number(quantity_change), reason, notes });

  return res.status(200).json(new ApiResponse(200, { item_id: item._id, stock_quantity: item.stock_quantity, movement }, "Stock adjusted"));
});

export const getMovements = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const movements = await StockMovement.find({ organization_id }).sort({ createdAt: -1 }).limit(100).populate("item_id", "name");
  return res.status(200).json(new ApiResponse(200, movements, "Stock movements fetched"));
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'text/csv') {
      cb(new Error('Only CSV files are allowed'));
      return;
    }
    cb(null, true);
  },
}).single('file'); // 'file' is the field name expected in form data

/**
 * Upload CSV to create/update inventory items
 * CSV should have headers: name,item_type,unit_price,stock_quantity,hsn_sac_code,tax_rate
 */
export const uploadInventoryCSV = asyncHandler(async (req, res) => {
  // Wrap multer in a promise
  await new Promise((resolve, reject) => {
    upload(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        reject(new ApiError(400, `File upload error: ${err.message}`));
      } else if (err) {
        reject(new ApiError(400, err.message));
      }
      resolve();
    });
  });

  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }

  const requiredHeaders = ['name', 'item_type', 'unit_price', 'stock_quantity', 'hsn_sac_code', 'tax_rate'];
  
  try {
    const records = await parseCSV(req.file.buffer, requiredHeaders);
    
    // Validate and transform records
    const items = records.map(record => ({
      organization_id: req.organization_id,
      name: record.name,
      item_type: record.item_type,
      unit_price: parseFloat(record.unit_price),
      stock_quantity: parseInt(record.stock_quantity, 10),
      hsn_sac_code: record.hsn_sac_code,
      tax_rate: parseFloat(record.tax_rate)
    }));

    // Validate all records before inserting
    const errors = items.map((item, index) => {
      if (!['product', 'service'].includes(item.item_type)) {
        return `Row ${index + 2}: Invalid item_type. Must be 'product' or 'service'`;
      }
      if (isNaN(item.unit_price) || item.unit_price < 0) {
        return `Row ${index + 2}: Invalid unit_price. Must be a positive number`;
      }
      if (isNaN(item.stock_quantity) || item.stock_quantity < 0) {
        return `Row ${index + 2}: Invalid stock_quantity. Must be a non-negative integer`;
      }
      if (isNaN(item.tax_rate) || item.tax_rate < 0) {
        return `Row ${index + 2}: Invalid tax_rate. Must be a non-negative number`;
      }
      return null;
    }).filter(Boolean);

    if (errors.length > 0) {
      throw new ApiError(400, "Validation errors in CSV", errors);
    }

    // Insert items in bulk
    const result = await Item.insertMany(items);

    // Create stock movements for initial quantities
    const movements = items.filter(item => item.stock_quantity > 0).map(item => ({
      organization_id: req.organization_id,
      item_id: result.find(r => r.name === item.name)._id,
      quantity_change: item.stock_quantity,
      reason: 'CSV Import',
      notes: 'Initial stock from CSV import'
    }));

    if (movements.length > 0) {
      await StockMovement.insertMany(movements);
    }

    return res.status(201).json(
      new ApiResponse(201, {
        insertedCount: result.length,
        items: result
      }, "Items imported successfully")
    );

  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, `Error processing CSV: ${error.message}`);
  }
});
