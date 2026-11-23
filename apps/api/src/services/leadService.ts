import { prisma } from '../db/prisma.js';
import type {
  Lead,
  CreateLeadDto,
  UpdateLeadDto,
  LeadFilterQuery,
  LeadListResponse,
  CsvLeadRow,
  CsvImportPreviewResponse,
  CsvImportResultResponse,
  LeadStatus,
  ConsentStatus,
  LeadSource,
} from '@voicepilot/shared';

interface InMemoryLead {
  id: string;
  tenantId: string;
  fullName: string;
  phoneNumber: string;
  email: string | null;
  companyName: string | null;
  country: string;
  languagePreference: string;
  leadSource: LeadSource;
  status: LeadStatus;
  notes: string | null;
  assignedAgentId: string | null;
  consentStatus: ConsentStatus;
  consentSource: string | null;
  consentDate: Date | null;
  isDnc: boolean;
  dncReason: string | null;
  dncUpdatedAt: Date | null;
  isCallable: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export class LeadService {
  private useMemoryFallback = false;
  private memoryLeads = new Map<string, InMemoryLead>();

  constructor() {
    if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('your-database-url-placeholder')) {
      this.useMemoryFallback = true;
    }
  }

  public setMemoryMode(enabled: boolean) {
    this.useMemoryFallback = enabled;
  }

  public clearMemoryState() {
    this.memoryLeads.clear();
  }

  public evaluateCallability(
    isDnc: boolean,
    consentStatus: ConsentStatus,
    country: string = 'IN'
  ): { isCallable: boolean; unfitReason: string | null } {
    if (isDnc) {
      return { isCallable: false, unfitReason: 'Marked on Do-Not-Call (DNC) registry' };
    }

    if (consentStatus !== 'CONSENT_GRANTED' && consentStatus !== 'LAWFUL_BASIS') {
      return {
        isCallable: false,
        unfitReason:
          consentStatus === 'PENDING_VERIFICATION'
            ? 'TRAI & compliance: Consent pending verification'
            : 'Missing documented opt-in consent or verified lawful basis',
      };
    }

    return { isCallable: true, unfitReason: null };
  }

  public normalizePhoneNumber(phone: string, defaultCountry = 'IN'): string {
    const cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    if (defaultCountry === 'IN' && !cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        return `+91${cleaned}`;
      }
      if (cleaned.startsWith('0') && cleaned.length === 11) {
        return `+91${cleaned.substring(1)}`;
      }
      if (cleaned.startsWith('91') && cleaned.length === 12) {
        return `+${cleaned}`;
      }
    }
    return cleaned;
  }

  async createLead(tenantId: string, userId: string, data: CreateLeadDto): Promise<Lead> {
    const normalizedPhone = this.normalizePhoneNumber(data.phoneNumber, data.country || 'IN');

    // 1. Duplicate check in tenant
    if (this.useMemoryFallback) {
      for (const item of this.memoryLeads.values()) {
        if (item.tenantId === tenantId && item.phoneNumber === normalizedPhone) {
          const error: any = new Error(
            `A lead with phone number ${normalizedPhone} already exists in this company.`
          );
          error.statusCode = 409;
          throw error;
        }
      }
    } else {
      const existing = await prisma.lead.findUnique({
        where: {
          tenant_phone_unique: {
            tenantId,
            phoneNumber: normalizedPhone,
          },
        },
      });

      if (existing) {
        const error: any = new Error(
          `A lead with phone number ${normalizedPhone} already exists in this company.`
        );
        error.statusCode = 409;
        throw error;
      }
    }

    // 2. Compute regulatory calling eligibility
    const consentStatus = data.consentStatus || 'PENDING_VERIFICATION';
    const isDnc = Boolean(data.isDnc);
    const { isCallable } = this.evaluateCallability(isDnc, consentStatus, data.country || 'IN');

    if (this.useMemoryFallback) {
      const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const inMemory: InMemoryLead = {
        id,
        tenantId,
        fullName: data.fullName.trim(),
        phoneNumber: normalizedPhone,
        email: data.email?.trim().toLowerCase() || null,
        companyName: data.companyName?.trim() || null,
        country: data.country || 'IN',
        languagePreference: data.languagePreference || 'en-IN',
        leadSource: (data.leadSource as any) || 'OTHER',
        status: (data.status as any) || 'NEW',
        notes: data.notes || null,
        assignedAgentId: data.assignedAgentId || null,
        consentStatus,
        consentSource: data.consentSource || null,
        consentDate: consentStatus === 'CONSENT_GRANTED' ? now : null,
        isDnc,
        dncReason: data.dncReason || null,
        dncUpdatedAt: isDnc ? now : null,
        isCallable,
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      };
      this.memoryLeads.set(id, inMemory);
      return this.mapToLead(inMemory);
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        fullName: data.fullName.trim(),
        phoneNumber: normalizedPhone,
        email: data.email?.trim().toLowerCase() || null,
        companyName: data.companyName?.trim() || null,
        country: data.country || 'IN',
        languagePreference: data.languagePreference || 'en-IN',
        leadSource: (data.leadSource as any) || 'OTHER',
        status: (data.status as any) || 'NEW',
        notes: data.notes || null,
        assignedAgentId: data.assignedAgentId || null,
        consentStatus,
        consentSource: data.consentSource || null,
        consentDate: consentStatus === 'CONSENT_GRANTED' ? new Date() : null,
        isDnc,
        dncReason: data.dncReason || null,
        dncUpdatedAt: isDnc ? new Date() : null,
        isCallable,
        createdById: userId,
      },
      include: {
        assignedAgent: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'LEAD_CREATED',
        entityType: 'LEAD',
        entityId: lead.id,
        metadata: {
          leadName: lead.fullName,
          phone: lead.phoneNumber,
          isCallable: lead.isCallable,
          isDnc: lead.isDnc,
        },
      },
    });

    return this.mapToLead(lead);
  }

  async getLeads(tenantId: string, query: LeadFilterQuery): Promise<LeadListResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    if (this.useMemoryFallback) {
      let filtered = Array.from(this.memoryLeads.values()).filter(
        (item) => item.tenantId === tenantId
      );

      if (query.search) {
        const s = query.search.trim().toLowerCase();
        filtered = filtered.filter(
          (i) =>
            i.fullName.toLowerCase().includes(s) ||
            i.phoneNumber.includes(s) ||
            (i.email && i.email.toLowerCase().includes(s)) ||
            (i.companyName && i.companyName.toLowerCase().includes(s))
        );
      }

      if (query.status) {
        filtered = filtered.filter((i) => i.status === query.status);
      }

      if (query.leadSource) {
        filtered = filtered.filter((i) => i.leadSource === query.leadSource);
      }

      if (query.languagePreference) {
        filtered = filtered.filter((i) => i.languagePreference === query.languagePreference);
      }

      if (query.isDnc !== undefined) {
        const dncBool = query.isDnc === true || String(query.isDnc) === 'true';
        filtered = filtered.filter((i) => i.isDnc === dncBool);
      }

      if (query.isCallable !== undefined) {
        const callBool = query.isCallable === true || String(query.isCallable) === 'true';
        filtered = filtered.filter((i) => i.isCallable === callBool);
      }

      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      const total = filtered.length;
      const records = filtered.slice(skip, skip + limit);

      return {
        leads: records.map((r) => this.mapToLead(r)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      };
    }

    const where: any = { tenantId };

    if (query.search) {
      const search = query.search.trim();
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.leadSource) {
      where.leadSource = query.leadSource;
    }

    if (query.languagePreference) {
      where.languagePreference = query.languagePreference;
    }

    if (query.isDnc !== undefined) {
      where.isDnc = query.isDnc === true || String(query.isDnc) === 'true';
    }

    if (query.isCallable !== undefined) {
      where.isCallable = query.isCallable === true || String(query.isCallable) === 'true';
    }

    const [total, records] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          assignedAgent: {
            select: { id: true, fullName: true, email: true },
          },
        },
      }),
    ]);

    return {
      leads: records.map((r) => this.mapToLead(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getLeadById(tenantId: string, leadId: string): Promise<Lead> {
    if (this.useMemoryFallback) {
      const item = this.memoryLeads.get(leadId);
      if (!item || item.tenantId !== tenantId) {
        const error: any = new Error(`Lead with ID ${leadId} not found in this company`);
        error.statusCode = 404;
        throw error;
      }
      return this.mapToLead(item);
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: leadId,
        tenantId,
      },
      include: {
        assignedAgent: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (!lead) {
      const error: any = new Error(`Lead with ID ${leadId} not found in this company`);
      error.statusCode = 404;
      throw error;
    }

    return this.mapToLead(lead);
  }

  async updateLead(
    tenantId: string,
    leadId: string,
    userId: string,
    data: UpdateLeadDto
  ): Promise<Lead> {
    if (this.useMemoryFallback) {
      const existing = this.memoryLeads.get(leadId);
      if (!existing || existing.tenantId !== tenantId) {
        const error: any = new Error(`Lead not found or access denied`);
        error.statusCode = 404;
        throw error;
      }

      const normalizedPhone = data.phoneNumber
        ? this.normalizePhoneNumber(data.phoneNumber, data.country || existing.country)
        : existing.phoneNumber;

      if (data.phoneNumber && normalizedPhone !== existing.phoneNumber) {
        for (const item of this.memoryLeads.values()) {
          if (item.tenantId === tenantId && item.phoneNumber === normalizedPhone && item.id !== leadId) {
            const error: any = new Error(
              `Another lead already exists with phone number ${normalizedPhone}`
            );
            error.statusCode = 409;
            throw error;
          }
        }
      }

      const isDnc = data.isDnc !== undefined ? Boolean(data.isDnc) : existing.isDnc;
      const consentStatus = (data.consentStatus as ConsentStatus) || existing.consentStatus;
      const country = data.country || existing.country;
      const { isCallable } = this.evaluateCallability(isDnc, consentStatus, country);

      const now = new Date();
      existing.fullName = data.fullName !== undefined ? data.fullName.trim() : existing.fullName;
      existing.phoneNumber = normalizedPhone;
      existing.email = data.email !== undefined ? data.email?.trim().toLowerCase() || null : existing.email;
      existing.companyName = data.companyName !== undefined ? data.companyName?.trim() || null : existing.companyName;
      existing.country = data.country || existing.country;
      existing.languagePreference = data.languagePreference || existing.languagePreference;
      existing.leadSource = (data.leadSource as any) || existing.leadSource;
      existing.status = (data.status as any) || existing.status;
      existing.notes = data.notes !== undefined ? data.notes : existing.notes;
      existing.assignedAgentId = data.assignedAgentId !== undefined ? data.assignedAgentId : existing.assignedAgentId;
      existing.consentStatus = consentStatus;
      existing.consentSource = data.consentSource !== undefined ? data.consentSource : existing.consentSource;
      if (consentStatus === 'CONSENT_GRANTED' && existing.consentStatus !== 'CONSENT_GRANTED') {
        existing.consentDate = now;
      }
      existing.isDnc = isDnc;
      existing.dncReason = data.dncReason !== undefined ? data.dncReason : existing.dncReason;
      if (isDnc !== existing.isDnc) {
        existing.dncUpdatedAt = now;
      }
      existing.isCallable = isCallable;
      existing.updatedAt = now;

      return this.mapToLead(existing);
    }

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!existing) {
      const error: any = new Error(`Lead not found or access denied`);
      error.statusCode = 404;
      throw error;
    }

    const normalizedPhone = data.phoneNumber
      ? this.normalizePhoneNumber(data.phoneNumber, data.country || existing.country)
      : existing.phoneNumber;

    if (data.phoneNumber && normalizedPhone !== existing.phoneNumber) {
      const duplicate = await prisma.lead.findUnique({
        where: {
          tenant_phone_unique: {
            tenantId,
            phoneNumber: normalizedPhone,
          },
        },
      });

      if (duplicate && duplicate.id !== leadId) {
        const error: any = new Error(
          `Another lead already exists with phone number ${normalizedPhone}`
        );
        error.statusCode = 409;
        throw error;
      }
    }

    const isDnc = data.isDnc !== undefined ? Boolean(data.isDnc) : existing.isDnc;
    const consentStatus = (data.consentStatus as ConsentStatus) || existing.consentStatus;
    const country = data.country || existing.country;
    const { isCallable } = this.evaluateCallability(isDnc, consentStatus, country);

    const updated = await prisma.lead.update({
      where: { id: leadId },
      data: {
        fullName: data.fullName !== undefined ? data.fullName.trim() : undefined,
        phoneNumber: normalizedPhone,
        email: data.email !== undefined ? data.email?.trim().toLowerCase() || null : undefined,
        companyName: data.companyName !== undefined ? data.companyName?.trim() || null : undefined,
        country: data.country || undefined,
        languagePreference: data.languagePreference || undefined,
        leadSource: (data.leadSource as any) || undefined,
        status: (data.status as any) || undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
        assignedAgentId: data.assignedAgentId !== undefined ? data.assignedAgentId : undefined,
        consentStatus: (data.consentStatus as any) || undefined,
        consentSource: data.consentSource !== undefined ? data.consentSource : undefined,
        consentDate:
          consentStatus === 'CONSENT_GRANTED' && existing.consentStatus !== 'CONSENT_GRANTED'
            ? new Date()
            : undefined,
        isDnc,
        dncReason: data.dncReason !== undefined ? data.dncReason : undefined,
        dncUpdatedAt: isDnc !== existing.isDnc ? new Date() : undefined,
        isCallable,
      },
      include: {
        assignedAgent: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'LEAD_UPDATED',
        entityType: 'LEAD',
        entityId: leadId,
        metadata: {
          updatedFields: Object.keys(data),
          isCallable: updated.isCallable,
          isDnc: updated.isDnc,
        },
      },
    });

    return this.mapToLead(updated);
  }

  async deleteLead(tenantId: string, leadId: string, userId: string): Promise<{ success: boolean }> {
    if (this.useMemoryFallback) {
      const existing = this.memoryLeads.get(leadId);
      if (!existing || existing.tenantId !== tenantId) {
        const error: any = new Error(`Lead not found or access denied`);
        error.statusCode = 404;
        throw error;
      }
      this.memoryLeads.delete(leadId);
      return { success: true };
    }

    const existing = await prisma.lead.findFirst({
      where: { id: leadId, tenantId },
    });

    if (!existing) {
      const error: any = new Error(`Lead not found or access denied`);
      error.statusCode = 404;
      throw error;
    }

    await prisma.lead.delete({
      where: { id: leadId },
    });

    await prisma.auditLog.create({
      data: {
        tenantId,
        userId,
        action: 'LEAD_DELETED',
        entityType: 'LEAD',
        entityId: leadId,
        metadata: {
          fullName: existing.fullName,
          phone: existing.phoneNumber,
        },
      },
    });

    return { success: true };
  }

  async previewCsvImport(tenantId: string, rows: CsvLeadRow[]): Promise<CsvImportPreviewResponse> {
    const preview: any[] = [];
    const seenPhonesInFile = new Set<string>();
    const seenEmailsInFile = new Set<string>();

    let dbPhones = new Set<string>();
    let dbEmails = new Set<string>();

    if (this.useMemoryFallback) {
      for (const lead of this.memoryLeads.values()) {
        if (lead.tenantId === tenantId) {
          dbPhones.add(lead.phoneNumber);
          if (lead.email) dbEmails.add(lead.email);
        }
      }
    } else {
      const existingLeads = await prisma.lead.findMany({
        where: { tenantId },
        select: { phoneNumber: true, email: true },
      });
      dbPhones = new Set(existingLeads.map((l) => l.phoneNumber));
      dbEmails = new Set(
        existingLeads.map((l) => l.email).filter((e): e is string => Boolean(e))
      );
    }

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;

    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i];
      const errors: string[] = [];
      let isDuplicateInFile = false;
      let isDuplicateInDb = false;
      let duplicateField: 'phone' | 'email' | undefined;

      const fullName = raw.fullName?.trim();
      const rawPhone = raw.phoneNumber?.trim();
      const email = raw.email?.trim().toLowerCase();

      if (!fullName) {
        errors.push('Full name is required');
      }

      if (!rawPhone) {
        errors.push('Phone number is required');
      }

      let normalizedPhone = '';
      if (rawPhone) {
        normalizedPhone = this.normalizePhoneNumber(rawPhone, raw.country || 'IN');
        if (normalizedPhone.length < 8) {
          errors.push('Invalid phone number format');
        }

        if (seenPhonesInFile.has(normalizedPhone)) {
          isDuplicateInFile = true;
          duplicateField = 'phone';
          errors.push('Duplicate phone number in uploaded file');
        } else {
          seenPhonesInFile.add(normalizedPhone);
        }

        if (dbPhones.has(normalizedPhone)) {
          isDuplicateInDb = true;
          duplicateField = 'phone';
          errors.push('Lead already exists in database with this phone');
        }
      }

      if (email && email.length > 0) {
        if (!email.includes('@')) {
          errors.push('Invalid email format');
        } else if (seenEmailsInFile.has(email)) {
          isDuplicateInFile = true;
          duplicateField = 'email';
          errors.push('Duplicate email in uploaded file');
        } else {
          seenEmailsInFile.add(email);
        }
      }

      const isDnc =
        raw.isDnc === true ||
        raw.isDnc === 'true' ||
        raw.isDnc === 'yes' ||
        raw.isDnc === '1';

      const consentStatus: ConsentStatus =
        raw.consentStatus === 'CONSENT_GRANTED'
          ? 'CONSENT_GRANTED'
          : raw.consentStatus === 'LAWFUL_BASIS'
          ? 'LAWFUL_BASIS'
          : raw.consentStatus === 'CONSENT_REVOKED'
          ? 'CONSENT_REVOKED'
          : 'PENDING_VERIFICATION';

      const { isCallable } = this.evaluateCallability(isDnc, consentStatus, raw.country || 'IN');

      const isRowValid = errors.length === 0;
      if (isRowValid) {
        validRows++;
      } else {
        invalidRows++;
        if (isDuplicateInFile || isDuplicateInDb) {
          duplicateRows++;
        }
      }

      preview.push({
        rowNumber: i + 1,
        data: {
          ...raw,
          phoneNumber: normalizedPhone || rawPhone,
        },
        isValid: isRowValid,
        errors,
        isDuplicateInFile,
        isDuplicateInDb,
        duplicateField,
        isCallable,
      });
    }

    return {
      totalRows: rows.length,
      validRows,
      invalidRows,
      duplicateRows,
      preview,
    };
  }

  async importCsvLeads(
    tenantId: string,
    userId: string,
    rows: CsvLeadRow[]
  ): Promise<CsvImportResultResponse> {
    const previewResult = await this.previewCsvImport(tenantId, rows);
    const validItems = previewResult.preview.filter((p) => p.isValid);

    let totalImported = 0;
    let duplicatesSkipped = previewResult.duplicateRows;
    const errors: Array<{ rowNumber: number; reason: string }> = [];

    previewResult.preview
      .filter((p) => !p.isValid)
      .forEach((p) => {
        errors.push({
          rowNumber: p.rowNumber,
          reason: p.errors.join('; '),
        });
      });

    for (const item of validItems) {
      const row = item.data;
      const normalizedPhone = this.normalizePhoneNumber(row.phoneNumber, row.country || 'IN');
      const isDnc =
        row.isDnc === true ||
        row.isDnc === 'true' ||
        row.isDnc === 'yes' ||
        row.isDnc === '1';

      const consentStatus: ConsentStatus =
        row.consentStatus === 'CONSENT_GRANTED'
          ? 'CONSENT_GRANTED'
          : row.consentStatus === 'LAWFUL_BASIS'
          ? 'LAWFUL_BASIS'
          : row.consentStatus === 'CONSENT_REVOKED'
          ? 'CONSENT_REVOKED'
          : 'PENDING_VERIFICATION';

      const { isCallable } = this.evaluateCallability(isDnc, consentStatus, row.country || 'IN');

      if (this.useMemoryFallback) {
        const id = `lead_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const now = new Date();
        this.memoryLeads.set(id, {
          id,
          tenantId,
          fullName: row.fullName.trim(),
          phoneNumber: normalizedPhone,
          email: row.email?.trim().toLowerCase() || null,
          companyName: row.companyName?.trim() || null,
          country: row.country || 'IN',
          languagePreference: row.languagePreference || 'en-IN',
          leadSource: 'CSV_IMPORT',
          status: (row.status as any) || 'NEW',
          notes: row.notes || null,
          assignedAgentId: null,
          consentStatus,
          consentSource: row.consentSource || 'Bulk CSV Import',
          consentDate: consentStatus === 'CONSENT_GRANTED' ? now : null,
          isDnc,
          dncReason: isDnc ? 'Marked in CSV import' : null,
          dncUpdatedAt: isDnc ? now : null,
          isCallable,
          createdById: userId,
          createdAt: now,
          updatedAt: now,
        });
        totalImported++;
        continue;
      }

      try {
        await prisma.lead.create({
          data: {
            tenantId,
            fullName: row.fullName.trim(),
            phoneNumber: normalizedPhone,
            email: row.email?.trim().toLowerCase() || null,
            companyName: row.companyName?.trim() || null,
            country: row.country || 'IN',
            languagePreference: row.languagePreference || 'en-IN',
            leadSource: 'CSV_IMPORT',
            status: (row.status as any) || 'NEW',
            notes: row.notes || null,
            consentStatus,
            consentSource: row.consentSource || 'Bulk CSV Import',
            consentDate: consentStatus === 'CONSENT_GRANTED' ? new Date() : null,
            isDnc,
            dncReason: isDnc ? 'Marked in CSV import' : null,
            dncUpdatedAt: isDnc ? new Date() : null,
            isCallable,
            createdById: userId,
          },
        });
        totalImported++;
      } catch (err: any) {
        errors.push({
          rowNumber: item.rowNumber,
          reason: err.message || 'Database insert failed',
        });
      }
    }

    if (!this.useMemoryFallback) {
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId,
          action: 'LEADS_CSV_IMPORTED',
          entityType: 'LEAD',
          metadata: {
            totalRows: rows.length,
            totalImported,
            duplicatesSkipped,
            errorsCount: errors.length,
          },
        },
      });
    }

    return {
      totalImported,
      totalSkipped: rows.length - totalImported,
      duplicatesSkipped,
      errors,
    };
  }

  private mapToLead(raw: any): Lead {
    return {
      id: raw.id,
      tenantId: raw.tenantId,
      fullName: raw.fullName,
      phoneNumber: raw.phoneNumber,
      email: raw.email,
      companyName: raw.companyName,
      country: raw.country,
      languagePreference: raw.languagePreference,
      leadSource: raw.leadSource as LeadSource,
      status: raw.status as LeadStatus,
      notes: raw.notes,
      assignedAgentId: raw.assignedAgentId,
      assignedAgent: raw.assignedAgent || null,
      consentStatus: raw.consentStatus as ConsentStatus,
      consentSource: raw.consentSource,
      consentDate: raw.consentDate ? (raw.consentDate instanceof Date ? raw.consentDate.toISOString() : String(raw.consentDate)) : null,
      isDnc: raw.isDnc,
      dncReason: raw.dncReason,
      dncUpdatedAt: raw.dncUpdatedAt ? (raw.dncUpdatedAt instanceof Date ? raw.dncUpdatedAt.toISOString() : String(raw.dncUpdatedAt)) : null,
      isCallable: raw.isCallable,
      createdAt: raw.createdAt instanceof Date ? raw.createdAt.toISOString() : String(raw.createdAt),
      updatedAt: raw.updatedAt instanceof Date ? raw.updatedAt.toISOString() : String(raw.updatedAt),
      createdById: raw.createdById,
    };
  }
}

export const leadService = new LeadService();
