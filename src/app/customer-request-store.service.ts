import { Injectable, inject, signal } from '@angular/core';
import {
  CustomerRequest,
  CustomerRequestItem,
  CustomerRequestStatus,
} from './customer-request.model';
import { CustomerRequestRepository } from './customer-request-repository.service';

@Injectable({ providedIn: 'root' })
export class CustomerRequestStore {
  private readonly repository = inject(CustomerRequestRepository);
  private initialized = false;
  readonly configured = this.repository.configured;
  readonly requests = signal<CustomerRequest[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');

  async create(
    name: string,
    phone: string,
    city: string,
    message: string,
    items: CustomerRequestItem[],
  ): Promise<CustomerRequest> {
    const clean = {
      name: name.trim(),
      phone: phone.trim(),
      city: city.trim(),
      message: message.trim(),
    };
    if (clean.name.length < 2 || clean.name.length > 80)
      throw new Error('Enter a valid name between 2 and 80 characters.');
    if (clean.phone.length < 5 || clean.phone.length > 30)
      throw new Error('Enter a valid phone number.');
    if (clean.city.length < 2 || clean.city.length > 80)
      throw new Error('Enter a valid city.');
    if (clean.message.length > 500)
      throw new Error('The message must not exceed 500 characters.');
    if (!items.length || items.length > 30)
      throw new Error('Add at least one product to the request bag.');
    if (
      items.some(
        (item) =>
          !item.productId ||
          !item.name ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > 100,
      )
    )
      throw new Error('The request bag contains an invalid quantity.');
    return this.repository.create({ ...clean, items });
  }

  async initialize(): Promise<void> {
    if (this.initialized || !this.configured) return;
    this.initialized = true;
    this.loading.set(true);
    this.error.set('');
    try {
      this.requests.set(await this.repository.list());
    } catch {
      this.error.set('Customer requests could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  async setStatus(
    request: CustomerRequest,
    status: CustomerRequestStatus,
  ): Promise<void> {
    await this.repository.updateStatus(request.id, status);
    this.requests.update((items) =>
      items.map((item) =>
        item.id === request.id
          ? { ...item, status, updatedAt: Date.now() }
          : item,
      ),
    );
  }
}
