import { Config, PartialDeep } from './lib/types.ts';

/** Check the Config type for all the possible options and instructions. */
const config: PartialDeep<Config> = {
  auth: {
    baseUrl: 'http://localhost:8000', // The base URL of the application you use to access the app, i.e. "http://localhost:8000" or "https://cloud.example.com"
    allowSignups: false, // If true, anyone can sign up for an account. Note that it's always possible to sign up for the first user, and they will be an admin
    enableEmailVerification: false, // If true, email verification will be required for signups (using Brevo)
    enableForeverSignup: true, // If true, all signups become active for 100 years
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
};

export default config;
