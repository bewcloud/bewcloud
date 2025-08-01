import { Config, PartialDeep } from './lib/types.ts';

/** Check the Config type for all the possible options and instructions. */
const config: PartialDeep<Config> = {
  auth: {
    baseUrl: 'http://localhost:8000', // The base URL of the application you use to access the app, i.e. "http://localhost:8000" or "https://cloud.example.com" (SSO redirect, if enabled, will be this + /oidc/callback, so "https://cloud.example.com/oidc/callback")
    allowSignups: false, // If true, anyone can sign up for an account. Note that it's always possible to sign up for the first user, and they will be an admin
    enableEmailVerification: false, // If true, email verification will be required for signups (using SMTP settings below)
    enableForeverSignup: true, // If true, all signups become active for 100 years
    enableMultiFactor: false, // If true, users can enable multi-factor authentication (TOTP, Passkeys, or Email if the SMTP settings below are set)
    // allowedCookieDomains: ['example.com', 'example.net'], // Can be set to allow more than the baseUrl's domain for session cookies
    // skipCookieDomainSecurity: true, // If true, the cookie domain will not be strictly set and checked against. This skipping slightly reduces security, but is usually necessary for reverse proxies like Cloudflare Tunnel
    // enableSingleSignOn: false, // If true, single sign-on will be enabled
    // singleSignOnUrl: '', // The Discovery URL (AKA Issuer) of the identity/single sign-on provider
    // singleSignOnEmailAttribute: 'email', // The attribute to prefer as email of the identity/single sign-on provider
    // singleSignOnScopes: ['openid', 'email'], // The scopes to request from the identity/single sign-on provider
  },
  // files: {
  //   rootPath: 'data-files',
  //   allowPublicSharing: false, // If true, public file sharing will be allowed (still requires a user to enable sharing for a given file or directory)
  // },
  // core: {
  //   enabledApps: ['news', 'notes', 'photos', 'expenses'], // dashboard and files cannot be disabled
  // },
  // visuals: {
  //   title: 'My own cloud',
  //   description: 'This is my own cloud!',
  //   helpEmail: '',
  // },
  // email: {
  //   from: 'help@bewcloud.com',
  //   host: 'localhost',
  //   port: 465,
  // },
  // contacts: {
  //   enableCardDavServer: true,
  //   cardDavUrl: 'http://127.0.0.1:5232',
  // },
  // calendar: {
  //   enableCalDavServer: true,
  //   calDavUrl: 'http://127.0.0.1:5232',
  // },
};

export default config;
