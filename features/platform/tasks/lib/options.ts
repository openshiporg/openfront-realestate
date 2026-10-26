/* Kept out of the 'use client' TaskForms module: a server page importing a plain array
 * from a client module gets a client reference, and `.find()` on it threw a 500. */
export const priorityOptions: Array<[string, string]> = [['low', 'Low'], ['normal', 'Normal'], ['high', 'High'], ['urgent', 'Urgent']]
