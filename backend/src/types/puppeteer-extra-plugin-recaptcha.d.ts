declare module 'puppeteer-extra-plugin-recaptcha' {
  import type { PuppeteerExtraPlugin } from 'puppeteer-extra-plugin';

  interface RecaptchaPluginOptions {
    provider?: {
      id: string;
      token: string;
    };
    visualFeedback?: boolean;
    throwOnError?: boolean;
  }

  export default function RecaptchaPlugin(
    options?: RecaptchaPluginOptions,
  ): PuppeteerExtraPlugin;
}
