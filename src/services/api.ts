import axios, { AxiosInstance } from 'axios';
import { HealthStatus, CodeReviewResult, GitSummary } from '@/store/appStore';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handling interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('[API Error]', error.response?.data || error.message);
    throw error;
  }
);

export const apiService = {
  // Health Check Endpoints
  async getHealthStatus(): Promise<HealthStatus> {
    try {
      const response = await apiClient.get<HealthStatus>('/api/health-check');
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch health status');
    }
  },

  // Code Review Endpoints
  async submitCodeReview(code: string, filePath: string): Promise<CodeReviewResult[]> {
    try {
      const response = await apiClient.post<CodeReviewResult[]>('/api/code-review', {
        code,
        file_path: filePath,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to review code');
    }
  },

  // Git Endpoints
  async getGitSummary(repositoryPath: string): Promise<GitSummary> {
    try {
      const response = await apiClient.get<GitSummary>('/api/git-summary', {
        params: {
          repo_path: repositoryPath,
        },
      });
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || 'Failed to fetch git summary');
    }
  },

  // Health check for API availability
  async checkApiHealth(): Promise<boolean> {
    try {
      await apiClient.get('/health');
      return true;
    } catch {
      return false;
    }
  },
};
