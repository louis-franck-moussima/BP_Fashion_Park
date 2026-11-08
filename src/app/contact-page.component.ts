import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { StoreSettingsService } from './store-settings.service';
import { SeoService } from './seo.service';

@Component({
  selector: 'app-contact-page',
  templateUrl: './contact-page.component.html',
  styleUrl: './contact-page.component.css',
})
export class ContactPageComponent implements OnInit {
  readonly storeSettings = inject(StoreSettingsService);
  private readonly seo = inject(SeoService);
  readonly name = signal('');
  readonly phone = signal('');
  readonly city = signal('');
  readonly message = signal('');

  readonly address = computed(
    () =>
      this.storeSettings.settings().businessAddress.trim() ||
      'Exact shop location coming soon',
  );
  readonly emailUrl = computed(
    () => `mailto:${this.storeSettings.settings().contactEmail}`,
  );

  async ngOnInit(): Promise<void> {
    await this.storeSettings.initialize();
    this.seo.setContact();
  }

  sendWhatsApp(event: Event): void {
    event.preventDefault();
    const text = [
      'Hello BP Fashion Park,',
      `My name is ${this.name().trim()}.`,
      this.phone().trim() ? `Phone: ${this.phone().trim()}` : '',
      this.city().trim() ? `City: ${this.city().trim()}` : '',
      this.message().trim(),
    ]
      .filter(Boolean)
      .join('\n');
    if (typeof window !== 'undefined')
      window.open(this.storeSettings.whatsappUrl(text), '_blank', 'noopener');
  }
}
