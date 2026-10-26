/*
 * Routing choice lists. Kept out of the 'use client' forms module: a server page
 * that imports a plain array from a client module receives a client reference,
 * not the array, so `.find()` threw and Lead routing returned a 500.
 */
export const intentOptions: Array<[string, string]> = [['any', 'Any intent'], ['buy', 'Buying'], ['rent', 'Renting'], ['sell', 'Selling'], ['invest', 'Investing']]
export const sourceOptions: Array<[string, string]> = [['any', 'Any source'], ['website', 'Website'], ['zillow', 'Zillow'], ['referral', 'Referral'], ['open_house', 'Open house'], ['phone', 'Phone'], ['import', 'Import']]
