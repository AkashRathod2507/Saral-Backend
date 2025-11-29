import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { fetchInterestRates } from '../services/finance.service.js';

export const getBankInterestRates = asyncHandler(async (req, res) => {
  const { country = 'India' } = req.query;
  const rates = await fetchInterestRates({ country });

  return res.status(200).json(
    new ApiResponse(200, {
      country,
      centralBankRates: rates.central_bank_rates,
      referenceRates: rates.non_central_bank_rates,
      availableCountries: rates.available_countries,
      matchCount: rates.central_bank_rates?.length ?? 0
    }, 'Bank interest rates fetched')
  );
});
