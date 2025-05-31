import { Config, PartialDeep } from './lib/types.ts';

/** Check the Config type for all the possible options and instructions. */
const config: PartialDeep<Config> = {
  auth: {
    baseUrl: 'http://localhost:8000', // The base URL of the application you use to access the app, i.e. "http://localhost:8000" or "https://cloud.example.com"
    allowSignups: false, // If true, anyone can sign up for an account. Note that it's always possible to sign up for the first user, and they will be an admin
    enableEmailVerification: false, // If true, email verification will be required for signups (using Brevo)
    enableForeverSignup: true, // If true, all signups become active for 100 years
    enableMultiFactor: false, // If true, users can enable multi-factor authentication (TOTP or Passkeys)
    // allowedCookieDomains: ['example.com', 'example.net'], // Can be set to allow more than the baseUrl's domain for session cookies
    // skipCookieDomainSecurity: true, // If true, the cookie domain will not be strictly set and checked against. This skipping slightly reduces security, but is usually necessary for reverse proxies like Cloudflare Tunnel
  },
  // files: {
  //   rootPath: 'data-files',
  // },
  // core: {
  //   enabledApps: ['news', 'notes', 'photos', 'expenses'], // dashboard and files cannot be disabled
  // },
  // visuals: {
  //   title: 'My own cloud',
  //   description: 'This is my own cloud!',
  //   helpEmail: '',
  // },
  /**
   * S3 Configuration (Optional)
   * Uncomment and fill in the details below if you want to use S3 for file storage.
   * Ensure that the necessary environment variables are also set.
   * It is recommended to set these via environment variables for security reasons,
   * but you can also hardcode them here if necessary (not recommended for production).
   */
  // s3: {
  //   bucket: 'your_s3_bucket_name', // Environment variable: S3_BUCKET
  //   region: 'your_s3_region', // Environment variable: S3_REGION
  //   accessKeyID: 'your_s3_access_key_id', // Environment variable: S3_ACCESS_KEY_ID (sensitive)
  //   secretAccessKey: 'your_s3_secret_access_key', // Environment variable: S3_SECRET_ACCESS_KEY (sensitive)
  //   endpoint: 'https://your_s3_compatible_endpoint', // Optional, for S3-compatible services. Environment variable: S3_ENDPOINT
  // },
};

export default config;
