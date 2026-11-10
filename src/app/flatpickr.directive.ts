import { AfterViewInit, Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';
import type { Instance } from 'flatpickr/dist/types/instance';

@Directive({
  selector: 'input[appFlatpickr]',
})
export class FlatpickrDirective implements AfterViewInit, OnDestroy {
  private readonly element = inject(ElementRef<HTMLInputElement>).nativeElement;
  private instance?: Instance;
  private destroyed = false;
  @Input() appFlatpickr: 'date' | 'datetime' = 'date';

  private readonly synchronize = () => {
    if (this.element.value) this.instance?.setDate(this.element.value, false);
    else this.instance?.clear(false);
  };

  async ngAfterViewInit(): Promise<void> {
    const { default: flatpickr } = await import('flatpickr');
    if (this.destroyed) return;
    const includesTime = this.appFlatpickr === 'datetime';
    this.instance = flatpickr(this.element, {
      enableTime: includesTime,
      time_24hr: true,
      dateFormat: includesTime ? 'Y-m-d\\TH:i' : 'Y-m-d',
      altInput: true,
      altFormat: includesTime ? 'j F Y · H:i' : 'j F Y',
      allowInput: true,
      disableMobile: true,
      defaultDate: this.element.value || undefined,
    });
    this.element.addEventListener('flatpickr-sync', this.synchronize);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.element.removeEventListener('flatpickr-sync', this.synchronize);
    this.instance?.destroy();
  }
}
