/**
 * Environment configuration for QRefine
 * Determines API base URL based on environment
 */

export type Environment = "development" | "production";

export class EnvironmentConfig {
  private static environment: Environment = "development";

  /**
   * Get the current environment
   */
  static getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Set the environment (useful for testing)
   */
  static setEnvironment(env: Environment): void {
    this.environment = env;
  }

  /**
   * Get API base URL based on environment
   */
  static getApiBaseUrl(): string {
    const env = this.getEnvironment();
    
    switch (env) {
      case "production":
        return "https://qrefined-backend.onrender.com";
      case "development":
      default:
        return "http://localhost:8000";
    }
  }

  /**
   * Detect environment from VS Code settings or environment variables
   */
  static detectEnvironment(extensionMode?: string): void {
    // Check environment variable
    const envVar = process.env.NODE_ENV || process.env.VSCODE_ENV;
    
    if (envVar === "production") {
      this.environment = "production";
      return;
    }

    // Check extension mode (passed from activate function)
    if (extensionMode === "production") {
      this.environment = "production";
      return;
    }

    // Default to development
    this.environment = "development";
  }

  /**
   * Determine if running in production
   */
  static isProduction(): boolean {
    return this.getEnvironment() === "production";
  }

  /**
   * Determine if running in development
   */
  static isDevelopment(): boolean {
    return this.getEnvironment() === "development";
  }
}
