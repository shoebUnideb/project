import apiClient from './apiClient';
import type { MarketplaceUser } from '../types';

export const marketplaceApi = {
  list: () => apiClient.get<MarketplaceUser[]>('/api/marketplace/'),
};
