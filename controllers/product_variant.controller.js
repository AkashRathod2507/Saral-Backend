import { ProductVariant } from "../models/product_variant.model.js";
import { Product } from "../models/product.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listVariants = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const variants = await ProductVariant.find({ organization_id })
    .populate("productId", "name category")
    .populate("supplierId", "name");
  return res.status(200).json(new ApiResponse(200, variants, "Variants fetched"));
});

export const adjustVariantStock = asyncHandler(async (req, res) => {
  const organization_id = req.organization_id;
  const { variantId, quantity_change } = req.body;
  if (!variantId || typeof quantity_change === 'undefined') {
    throw new ApiError(400, "variantId and quantity_change are required");
  }
  const variant = await ProductVariant.findOne({ _id: variantId, organization_id });
  if (!variant) throw new ApiError(404, "Variant not found");
  const newQty = (variant.stockQuantity || 0) + Number(quantity_change);
  if (newQty < 0) throw new ApiError(400, "Stock cannot be negative");
  variant.stockQuantity = newQty;
  await variant.save();
  return res.status(200).json(new ApiResponse(200, variant, "Variant stock adjusted"));
});








