import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Item } from "../models/item.model.js";
import { StockMovement } from "../models/stock_movement.model.js";
import mongoose from "mongoose";

// --- 1. CREATE ITEM ---
const createItem = asyncHandler(async (req, res) => {
  // 1. Get data
  const { name, item_type, unit_price, hsn_sac_code, tax_rate, stock_quantity } = req.body;
  
  // 2. Validate
  if (!name || !item_type || unit_price === undefined || tax_rate === undefined) {
    throw new ApiError(400, "Name, type, unit price, and tax rate are required");
  }

  // 3. Get org ID
  const organization_id = req.organization_id; // From verifyJWT

  // 4. Create item (allow optional initial stock)
  const itemData = {
    organization_id,
    name,
    item_type,
    unit_price,
    hsn_sac_code,
    tax_rate
  };
  if (stock_quantity !== undefined) itemData.stock_quantity = Number(stock_quantity) || 0;

  const item = await Item.create(itemData);

  // 5. If initial stock provided, record a stock movement
  if (stock_quantity && Number(stock_quantity) > 0) {
    await StockMovement.create({ organization_id, item_id: item._id, quantity_change: Number(stock_quantity), reason: 'purchase' });
  }

  // 5. Send response
  return res.status(201).json(
    new ApiResponse(201, item, "Item created successfully")
  );
});

// --- 2. GET ALL ITEMS ---
const getAllItems = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;

  const items = await Item.find({ organization_id });

  return res.status(200).json(
    new ApiResponse(200, items, "Items retrieved successfully")
  );
});

// --- 3. GET ONE ITEM BY ID ---
const getItemById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organization_id = req.organization_id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const item = await Item.findOne({ _id: id, organization_id });

  if (!item) {
    throw new ApiError(404, "Item not found");
  }

  return res.status(200).json(
    new ApiResponse(200, item, "Item retrieved successfully")
  );
});

// --- 4. UPDATE ITEM ---
const updateItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, item_type, unit_price, hsn_sac_code, tax_rate } = req.body;
  const organization_id = req.organization_id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const updatedItem = await Item.findOneAndUpdate(
    { _id: id, organization_id },
    {
      $set: {
        name,
        item_type,
        unit_price,
        hsn_sac_code,
        tax_rate
      }
    },
    { new: true }
  );

  if (!updatedItem) {
    throw new ApiError(404, "Item not found");
  }

  return res.status(200).json(
    new ApiResponse(200, updatedItem, "Item updated successfully")
  );
});

// --- 5. DELETE ITEM ---
const deleteItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const organization_id = req.organization_id;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ApiError(400, "Invalid item ID");
  }

  const deletedItem = await Item.findOneAndDelete({ _id: id, organization_id });

  if (!deletedItem) {
    throw new ApiError(404, "Item not found");
  }
  
  // TODO: Add logic to check if item is used in any invoices.
  // For now, we will just delete.

  return res.status(200).json(
    new ApiResponse(200, { id: id }, "Item deleted successfully")
  );
});

export {
  createItem,
  getAllItems,
  getItemById,
  updateItem,
  deleteItem
};