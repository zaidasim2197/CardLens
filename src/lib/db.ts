import Dexie, { type Table } from 'dexie';
import type { ContactRecord } from '../types';

export class BusinessCardDatabase extends Dexie {
  contacts!: Table<ContactRecord, string>;

  constructor() {
    super('BusinessCardScannerDB');
    // Version 3: Clean schema without Constant Contact indices
    this.version(3).stores({
      contacts: 'id, status, createdAt, verifiedAt'
    });
  }
}

export const db = new BusinessCardDatabase();

export const storageService = {
  async saveRecord(record: ContactRecord) {
    return db.contacts.put(record);
  },

  async getRecordById(id: string) {
    return db.contacts.get(id);
  },

  async getVerifiedContacts() {
    return db.contacts
      .where('status')
      .anyOf(['VERIFIED', 'READY_TO_UPLOAD', 'UPLOADED', 'UPLOAD_FAILED'])
      .reverse()
      .sortBy('createdAt');
  },

  async getAllRecords() {
    return db.contacts.reverse().sortBy('createdAt');
  },

  async updateRecord(id: string, changes: Partial<ContactRecord>) {
    return db.contacts.update(id, changes);
  },

  async deleteContact(id: string) {
    return db.contacts.delete(id);
  },

  async archiveRecord(id: string) {
    return db.contacts.update(id, { status: 'ARCHIVED' });
  }
};

