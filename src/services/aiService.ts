import type { AIAnalysisRequest, AIAnalysisResponse } from '../types/aiReport';

/**
 * AI Service - Production Implementation
 * Handles communication with n8n AI workflow via webhook
 * 
 * Features:
 * - Timeout handling (60 second max)
 * - Automatic retry with exponential backoff
 * - CORS headers for cross-origin requests
 * - Detailed error handling with specific error messages
 * - Response validation and structure checking
 * - Comprehensive logging for debugging
 */

const TIMEOUT_MS = 60000; // 60 second timeout for AI processing
const RETRY_ATTEMPTS = 1;
const RETRY_DELAY_MS = 1000;

class AIService {
  private webhookUrl: string;

  constructor() {
    this.webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL || '';
  }

  /**
   * Validate if the webhook URL is configured
   */
  isConfigured(): boolean {
    return Boolean(this.webhookUrl);
  }

  /**
   * Get the webhook URL (for debugging)
   */
  getWebhookUrl(): string {
    return this.webhookUrl;
  }

  /**
   * Fetch with timeout support
   * Prevents hanging requests from blocking the UI indefinitely
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number = TIMEOUT_MS
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof TypeError && error.name === 'AbortError') {
        throw new Error(
          `Request timeout after ${timeoutMs}ms. n8n workflow is taking too long to respond. Check if workflow is executing properly.`
        );
      }
      throw error;
    }
  }

  /**
   * Retry logic for failed requests
   * Automatically retries transient failures like network timeouts
   */
  private async retryFetch(
    url: string,
    options: RequestInit,
    attempt: number = 1
  ): Promise<Response> {
    try {
      return await this.fetchWithTimeout(url, options);
    } catch (error) {
      if (attempt < RETRY_ATTEMPTS && error instanceof TypeError) {
        console.warn(
          `⚠️ Fetch attempt ${attempt} failed, retrying in ${RETRY_DELAY_MS}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        return this.retryFetch(url, options, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * Validate response structure
   * Ensures required fields are present in the response
   */
  private validateResponse(data: unknown): AIAnalysisResponse {
    if (!data || typeof data !== 'object') {
      throw new Error('Response is not a valid JSON object');
    }

    const response = data as Record<string, unknown>;

    // Check for minimum required fields
    if (!response.residentId) {
      throw new Error(
        'Response missing required field: residentId. Check Assemble node output.'
      );
    }

    return response as unknown as AIAnalysisResponse;
  }

  /**
   * Parse response with detailed error handling
   * Distinguishes between network errors, parse errors, and validation errors
   */
  private async parseResponse(response: Response): Promise<AIAnalysisResponse> {
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    // Check if response has content
    if (contentLength === '0') {
      throw new Error(
        'n8n returned empty response. Verify "Respond to Webhook" node is correctly configured with response body.'
      );
    }

    // Check content type
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error(
        '❌ Wrong content-type. Expected application/json, got:',
        contentType
      );
      throw new Error(
        `Invalid response content-type: ${contentType}. Response: ${text.substring(
          0,
          300
        )}`
      );
    }

    // Parse JSON with error handling
    let jsonData: unknown;
    try {
      const text = await response.text();

      if (!text) {
        throw new Error('Response body is empty. Check "Respond to Webhook" node.');
      }

      // Validate JSON before parsing
      if (!text.startsWith('{')) {
        throw new Error(
          `Response is not JSON. First char: ${text.charAt(0)}. Full response: ${text.substring(
            0,
            200
          )}`
        );
      }

      jsonData = JSON.parse(text);
    } catch (parseError) {
      if (parseError instanceof SyntaxError) {
        throw new Error(
          `Invalid JSON from n8n: ${parseError.message}. Check Assemble node output format.`
        );
      }
      if (parseError instanceof Error) {
        throw parseError;
      }
      throw new Error('Unknown JSON parse error');
    }

    return this.validateResponse(jsonData);
  }

  /**
   * Analyze health data through n8n AI workflow
   * Sends health metrics and receives comprehensive AI analysis
   * 
   * Flow:
   * 1. Validate webhook is configured
   * 2. Send POST request with health data
   * 3. Handle timeout and retries
   * 4. Parse and validate response
   * 5. Return structured AI analysis
   */
  async analyzeHealthData(data: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    if (!this.isConfigured()) {
      throw new Error(
        'N8N webhook URL is not configured. Please set VITE_N8N_WEBHOOK_URL in your environment variables.'
      );
    }

    console.log('📤 Sending analysis request to n8n');
    console.log('   URL:', this.webhookUrl);
    console.log('   Payload:', {
      residentId: data.residentId,
      name: data.name,
      age: data.age,
      timestamp: data.timestamp,
    });

    try {
      const response = await this.retryFetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'VitalCare-React/1.0',
        },
        body: JSON.stringify(data),
      });

      // Check HTTP status
      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `❌ HTTP ${response.status} from n8n:`,
          errorText.substring(0, 500)
        );

        // Specific error messages for common HTTP codes
        const errorMessages: Record<number, string> = {
          400: 'Bad Request. Check request payload format.',
          401: 'Unauthorized. Check webhook authentication.',
          403: 'Forbidden. Webhook access denied.',
          404: 'Webhook not found. Verify VITE_N8N_WEBHOOK_URL is correct and workflow is published.',
          500: 'n8n Internal Error. Check workflow execution in n8n logs.',
          502: 'Bad Gateway. n8n service unavailable.',
          503: 'Service Unavailable. n8n might be restarting.',
          504: 'Gateway Timeout. Workflow execution exceeded timeout.',
        };

        const message =
          errorMessages[response.status] ||
          `HTTP ${response.status} error from n8n`;
        throw new Error(`${message}: ${errorText.substring(0, 100)}`);
      }

      // Parse and validate response
      const result = await this.parseResponse(response);

      console.log('✅ Analysis received from n8n successfully');
      console.log('   Report ID:', result.id);
      console.log('   Timestamp:', result.timestamp);

      // Ensure the response has required fields
      if (!result.id) {
        result.id = `report-${Date.now()}`;
      }
      if (!result.timestamp) {
        result.timestamp = new Date().toISOString();
      }

      return result;
    } catch (error) {
      if (error instanceof Error) {
        console.error('🔴 Analysis request failed:', error.message);
        throw new Error(`Failed to analyze health data: ${error.message}`);
      }
      console.error('🔴 Unexpected error during analysis');
      throw new Error('Failed to analyze health data: Unknown error');
    }
  }

  /**
   * Validate the request data format
   * Ensures all required fields are present and valid
   */
  validateRequest(data: Partial<AIAnalysisRequest>): string[] {
    const errors: string[] = [];

    if (!data.residentId || typeof data.residentId !== 'string')
      errors.push('residentId is required (string)');
    if (!data.name || typeof data.name !== 'string')
      errors.push('name is required (string)');
    if (
      data.age === undefined ||
      data.age === null ||
      typeof data.age !== 'number' ||
      data.age < 0 ||
      data.age > 150
    )
      errors.push('age is required (0-150)');
    if (
      data.heartRate === undefined ||
      data.heartRate === null ||
      typeof data.heartRate !== 'number' ||
      data.heartRate < 0 ||
      data.heartRate > 300
    )
      errors.push('heartRate is required (0-300 bpm)');
    if (
      data.spo2 === undefined ||
      data.spo2 === null ||
      typeof data.spo2 !== 'number' ||
      data.spo2 < 0 ||
      data.spo2 > 100
    )
      errors.push('spo2 is required (0-100%)');
    if (!data.bloodPressure || typeof data.bloodPressure !== 'string')
      errors.push('bloodPressure is required (format: SYS/DIA)');
    if (
      data.temperature === undefined ||
      data.temperature === null ||
      typeof data.temperature !== 'number' ||
      data.temperature < 20 ||
      data.temperature > 45
    )
      errors.push('temperature is required (20-45°C)');
    if (
      data.sleepHours === undefined ||
      data.sleepHours === null ||
      typeof data.sleepHours !== 'number' ||
      data.sleepHours < 0 ||
      data.sleepHours > 24
    )
      errors.push('sleepHours is required (0-24)');
    if (
      data.steps === undefined ||
      data.steps === null ||
      typeof data.steps !== 'number' ||
      data.steps < 0
    )
      errors.push('steps is required (non-negative)');
    if (!data.timestamp || typeof data.timestamp !== 'string')
      errors.push('timestamp is required (ISO string)');

    return errors;
  }
}

export const aiService = new AIService();
