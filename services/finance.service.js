import fetch from 'node-fetch';
import { ApiError } from '../utils/ApiError.js';

const API_BASE_URL = 'https://api.api-ninjas.com/v1/interestrate';

const normalizeValue = (value = '') => value.replace(/_/g, ' ').trim();

export const fetchInterestRates = async ({ country = 'India' } = {}) => {
  const apiKey = process.env.API_NINJAS_API_KEY;
  if (!apiKey) {
    throw new ApiError(500, 'Missing API_NINJAS_API_KEY in environment');
  }

  const resp = await fetch(API_BASE_URL, {
    headers: {
      'X-Api-Key': apiKey
    },
    timeout: 10_000
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new ApiError(resp.status, `Interest rate provider error: ${text}`);
  }

  const data = await resp.json();
  if (!data || typeof data !== 'object') {
    throw new ApiError(500, 'Unexpected interest rate API response');
  }

  const centralRates = Array.isArray(data.central_bank_rates) ? data.central_bank_rates : [];
  const referenceRates = Array.isArray(data.non_central_bank_rates) ? data.non_central_bank_rates : [];

  const availableCountries = Array.from(new Set(centralRates.map((rate) => normalizeValue(rate.country ?? '')))).filter(Boolean);

  let filteredCentralRates = centralRates;
  if (country && country.toLowerCase() !== 'global') {
    const query = country.toLowerCase();
    const underscoredQuery = query.replace(/\s+/g, '_');
    filteredCentralRates = centralRates.filter((rate) => {
      const rawCountry = (rate.country ?? '').toLowerCase();
      const friendlyCountry = normalizeValue(rate.country ?? '').toLowerCase();
      const byCountry = rawCountry.includes(underscoredQuery) || friendlyCountry.includes(query);
      const byBank = (rate.central_bank ?? '').toLowerCase().includes(query);
      return byCountry || byBank;
    });
  }

  return {
    central_bank_rates: filteredCentralRates,
    non_central_bank_rates: referenceRates,
    available_countries: availableCountries
  };
};
