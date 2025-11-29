import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import {
  listGstReturns,
  upsertGstReturn,
  getGstReturnById,
  updateGstReturnStatus,
  buildGstDraft,
  searchGstTransactions
} from '../services/gst_return.service.js';

export const listReturns = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const result = await listGstReturns({
    organizationId: req.organization_id,
    page: Number(page),
    limit: Number(limit)
  });
  return res.status(200).json(new ApiResponse(200, result, 'GST returns fetched'));
});

export const generateReturn = asyncHandler(async (req, res) => {
  const { period, returnType } = req.body;
  const doc = await upsertGstReturn({
    organizationId: req.organization_id,
    period,
    returnType,
    userId: req.user?._id
  });
  return res.status(201).json(new ApiResponse(201, doc, 'GST summary prepared'));
});

export const fetchReturn = asyncHandler(async (req, res) => {
  const doc = await getGstReturnById({
    id: req.params.id,
    organizationId: req.organization_id
  });
  return res.status(200).json(new ApiResponse(200, doc, 'GST return detail fetched'));
});

export const modifyReturnStatus = asyncHandler(async (req, res) => {
  const { status, notes, referenceNumber } = req.body;
  const doc = await updateGstReturnStatus({
    id: req.params.id,
    organizationId: req.organization_id,
    status,
    notes,
    referenceNumber,
    userId: req.user?._id
  });
  return res.status(200).json(new ApiResponse(200, doc, 'GST return updated'));
});

export const gstDraftPreviewHandler = asyncHandler(async (req, res) => {
  const { period } = req.query;
  const data = await buildGstDraft({
    organizationId: req.organization_id,
    period
  });
  return res.status(200).json(new ApiResponse(200, data, 'GST draft prepared'));
});

export const gstTransactionSearchHandler = asyncHandler(async (req, res) => {
  const { period, q, treatment, status, limit } = req.query;
  const data = await searchGstTransactions({
    organizationId: req.organization_id,
    period,
    query: q,
    gstTreatment: treatment,
    status,
    limit: limit ? Number(limit) : undefined
  });
  return res.status(200).json(new ApiResponse(200, data, 'GST transactions fetched'));
});
