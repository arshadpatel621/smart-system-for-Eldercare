import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AIReportDocument } from '../types/aiReport';

/**
 * AI Report Storage Service
 * Handles saving and retrieving AI analysis reports from Firestore
 */

const COLLECTION_NAME = 'AIReports';

export class AIReportService {
  /**
   * Save an AI analysis report to Firestore
   */
  static async saveReport(
    report: Omit<AIReportDocument, 'createdAt' | 'updatedAt' | 'userId'>,
    userId: string
  ): Promise<string> {
    if (!db) {
      throw new Error('Firebase is not configured');
    }

    try {
      const now = new Date().toISOString();
      const reportData: AIReportDocument = {
        ...report,
        createdAt: now,
        updatedAt: now,
        userId,
      };

      const collectionRef = collection(db, COLLECTION_NAME);
      const docRef = await addDoc(collectionRef, {
        ...reportData,
        // Convert timestamps for Firestore
        timestamp: Timestamp.fromDate(new Date(reportData.timestamp)),
        createdAt: Timestamp.fromDate(new Date(reportData.createdAt)),
        updatedAt: Timestamp.fromDate(new Date(reportData.updatedAt)),
      });

      return docRef.id;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to save AI report: ${error.message}`);
      }
      throw new Error('Failed to save AI report: Unknown error');
    }
  }

  /**
   * Get the latest AI report for a resident
   */
  static async getLatestReport(
    residentId: string
  ): Promise<AIReportDocument | null> {
    if (!db) {
      throw new Error('Firebase is not configured');
    }

    try {
      const collectionRef = collection(db, COLLECTION_NAME);
      const q = query(
        collectionRef,
        where('residentId', '==', residentId),
        orderBy('createdAt', 'desc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      return doc.data() as AIReportDocument;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve AI report: ${error.message}`);
      }
      throw new Error('Failed to retrieve AI report: Unknown error');
    }
  }

  /**
   * Get all AI reports for a resident (paginated)
   */
  static async getResidentReports(
    residentId: string,
    limitCount: number = 10
  ): Promise<AIReportDocument[]> {
    if (!db) {
      throw new Error('Firebase is not configured');
    }

    try {
      const collectionRef = collection(db, COLLECTION_NAME);
      const q = query(
        collectionRef,
        where('residentId', '==', residentId),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => doc.data() as AIReportDocument);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to retrieve AI reports: ${error.message}`);
      }
      throw new Error('Failed to retrieve AI reports: Unknown error');
    }
  }
}
