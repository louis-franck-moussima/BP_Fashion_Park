import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { environment } from '../environments/environment';

@Injectable({ providedIn: 'root' })
export class FirebaseAppService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly configured = Boolean(environment.firebase.apiKey && environment.firebase.projectId);
  readonly app: FirebaseApp | null;
  readonly appCheckConfigured = Boolean(environment.appCheck.recaptchaEnterpriseSiteKey);

  constructor() {
    if (!isPlatformBrowser(this.platformId) || !this.configured) {
      this.app = null;
      return;
    }

    this.app = getApps().length ? getApp() : initializeApp(environment.firebase);
    if (this.appCheckConfigured) void this.initializeAppCheck();
  }

  private async initializeAppCheck(): Promise<void> {
    if (!this.app) return;
    const { ReCaptchaEnterpriseProvider, initializeAppCheck } = await import('firebase/app-check');
    initializeAppCheck(this.app, {
      provider: new ReCaptchaEnterpriseProvider(environment.appCheck.recaptchaEnterpriseSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  }
}
