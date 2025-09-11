const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Analytics API for fetching proposal analytics data
 */
class AnalyticsAPI {
  async getAnalytics(id: number): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/${id}`);
      if (!response.ok) throw new Error('Failed to fetch analytics');
      return await response.json();
    } catch (error) {
      console.error('Error fetching analytics:', error);
      return null;
    }
  }
}

export const analyticsApi = new AnalyticsAPI();

// Also export as standalone function for convenience
export async function getAnalytics(id: number): Promise<any> {
  return analyticsApi.getAnalytics(id);
}