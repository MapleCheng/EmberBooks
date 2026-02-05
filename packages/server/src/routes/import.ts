import { Router } from "express";
import multer from "multer";
import { parse } from "csv-parse/sync";
import mongoose from "mongoose";
import { RecordModel } from "../models/Record.js";
import { AccountModel } from "../models/Account.js";
import { CategoryModel } from "../models/Category.js";
import { authMiddleware } from "../middleware/auth.js";

export const importRouter = Router();
importRouter.use(authMiddleware);

const upload = multer({ dest: "uploads/" });

// MOZE record type mapping
const TYPE_MAP: Record<string, string> = {
  "支出": "expense",
  "收入": "income",
  "轉出": "transfer_out",
  "轉入": "transfer_in",
  "信用卡繳款": "transfer",  // will be handled in pairing
  "應收款項": "receivable",
  "應付款項": "payable",
  "餘額調整": "balance_adjustment",
  "退款": "refund",
  "利息": "interest",
  "紅利回饋": "reward",
  "折扣": "discount",
};

// Infer account type and group from name
function inferAccountType(name: string): string {
  if (/visa|jcb|master/i.test(name)) return "credit";
  return "physical";
}

function inferAccountGroup(name: string): string {
  if (/visa|jcb|master/i.test(name)) return "💳 信用卡";
  if (/錢包/.test(name)) return "💵 現金";
  if (/證券|交割/.test(name)) return "📈 投資帳戶";
  if (/微信|wechat|line\s*pay/i.test(name)) return "📱 電子錢包";
  return "🏦 銀行帳戶";
}

// Infer category type from MOZE record type
function inferCategoryType(mozeType: string): string {
  const mapped = TYPE_MAP[mozeType];
  if (!mapped) return "expense";
  if (mapped === "transfer_out" || mapped === "transfer_in") return "transfer";
  return mapped;
}

interface CsvRow {
  account: string;
  currency: string;
  recordType: string;
  mainCategory: string;
  subCategory: string;
  amount: string;
  fee: string;
  discount: string;
  name: string;
  merchant: string;
  date: string;
  time: string;
  project: string;
  description: string;
  tags: string;
  counterparty: string;
}

function parseCsvRows(content: string): CsvRow[] {
  const records = parse(content, {
    columns: [
      "account", "currency", "recordType", "mainCategory", "subCategory",
      "amount", "fee", "discount", "name", "merchant",
      "date", "time", "project", "description", "tags", "counterparty",
    ],
    skip_empty_lines: true,
    from_line: 2,  // skip header
    relax_column_count: true,
    trim: true,
  }) as CsvRow[];
  return records;
}

function parseDate(dateStr: string, timeStr: string): Date {
  // dateStr: "2025/07/01", timeStr: "18:00"
  const [year, month, day] = dateStr.split("/").map(Number);
  const [hour, minute] = (timeStr || "00:00").split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

function parseTags(tagStr: string): string[] {
  if (!tagStr) return [];
  return tagStr
    .split(";")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
}

function buildNote(name: string, description: string): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (description) parts.push(description);
  return parts.join("\n") || "";
}

importRouter.post("/moze", upload.single("file"), async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    if (!req.file) {
      res.status(400).json({ success: false, error: "No file uploaded" });
      return;
    }

    const fs = await import("fs");
    const content = fs.readFileSync(req.file.path, "utf-8");
    const rows = parseCsvRows(content);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    const userId = req.userId;
    const stats = {
      total: rows.length,
      imported: 0,
      skipped: 0,
      accounts_created: 0,
      categories_created: 0,
      transfers_merged: 0,
    };

    // --- Phase 1: Auto-create accounts ---
    const accountCache = new Map<string, string>(); // name -> _id
    const existingAccounts = await AccountModel.find({ userId }).session(session);
    for (const acc of existingAccounts) {
      accountCache.set(acc.name, acc._id.toString());
    }

    for (const row of rows) {
      if (!row.account || accountCache.has(row.account)) continue;
      const newAcc = await AccountModel.create(
        [
          {
            userId,
            name: row.account,
            type: inferAccountType(row.account),
            group: inferAccountGroup(row.account),
            includeInStats: true,
            currency: row.currency || "TWD",
            balance: 0,
          },
        ],
        { session },
      );
      accountCache.set(row.account, newAcc[0]._id.toString());
      stats.accounts_created++;
    }

    // --- Phase 2: Auto-create categories ---
    const categoryCache = new Map<string, Set<string>>(); // name -> subcategories set
    const existingCategories = await CategoryModel.find({ userId }).session(session);
    for (const cat of existingCategories) {
      categoryCache.set(cat.name, new Set(cat.subcategories || []));
    }

    for (const row of rows) {
      if (!row.mainCategory) continue;
      if (!categoryCache.has(row.mainCategory)) {
        const catType = inferCategoryType(row.recordType);
        const subs = row.subCategory ? [row.subCategory] : [];
        await CategoryModel.create(
          [
            {
              userId,
              name: row.mainCategory,
              icon: "📁",
              type: catType,
              subcategories: subs,
            },
          ],
          { session },
        );
        categoryCache.set(row.mainCategory, new Set(subs));
        stats.categories_created++;
      } else if (row.subCategory) {
        const subs = categoryCache.get(row.mainCategory)!;
        if (!subs.has(row.subCategory)) {
          subs.add(row.subCategory);
          await CategoryModel.updateOne(
            { userId, name: row.mainCategory },
            { $addToSet: { subcategories: row.subCategory } },
          ).session(session);
        }
      }
    }

    // --- Phase 3: Process records ---
    // Separate transfer pairs (轉出/轉入) and normal records
    interface TransferCandidate {
      index: number;
      row: CsvRow;
      dateKey: string;
      absAmount: number;
      direction: "out" | "in";
    }

    const transferCandidates: TransferCandidate[] = [];
    const normalRows: { index: number; row: CsvRow }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const mozeType = row.recordType;

      if (mozeType === "轉出" || mozeType === "轉入") {
        const dateKey = `${row.date}_${row.time}`;
        const absAmount = Math.abs(parseFloat(row.amount) || 0);
        transferCandidates.push({
          index: i,
          row,
          dateKey,
          absAmount,
          direction: mozeType === "轉出" ? "out" : "in",
        });
      } else {
        normalRows.push({ index: i, row });
      }
    }

    // Pair transfers: match by dateKey + absAmount
    const pairedTransfers: Array<{ outRow: CsvRow; inRow: CsvRow }> = [];
    const usedIndices = new Set<number>();

    const outCandidates = transferCandidates.filter((c) => c.direction === "out");
    const inCandidates = transferCandidates.filter((c) => c.direction === "in");

    for (const out of outCandidates) {
      if (usedIndices.has(out.index)) continue;
      const match = inCandidates.find(
        (inp) =>
          !usedIndices.has(inp.index) &&
          inp.dateKey === out.dateKey &&
          inp.absAmount === out.absAmount,
      );
      if (match) {
        pairedTransfers.push({ outRow: out.row, inRow: match.row });
        usedIndices.add(out.index);
        usedIndices.add(match.index);
        stats.transfers_merged++;
      } else {
        // Unmatched transfer_out, treat as normal
        normalRows.push({ index: out.index, row: out.row });
      }
    }
    // Unmatched transfer_in
    for (const inp of inCandidates) {
      if (!usedIndices.has(inp.index)) {
        normalRows.push({ index: inp.index, row: inp.row });
      }
    }

    // Create paired transfer records
    for (const { outRow, inRow } of pairedTransfers) {
      const fromAccountId = accountCache.get(outRow.account);
      const toAccountId = accountCache.get(inRow.account);
      if (!fromAccountId || !toAccountId) continue;

      const absAmount = Math.abs(parseFloat(outRow.amount) || 0);
      const fee = Math.abs(parseFloat(outRow.fee) || 0) + Math.abs(parseFloat(inRow.fee) || 0);
      const disc = Math.abs(parseFloat(outRow.discount) || 0) + Math.abs(parseFloat(inRow.discount) || 0);
      const note = buildNote(outRow.name, outRow.description);

      const transferDate = parseDate(outRow.date, outRow.time);
      await RecordModel.create(
        [
          {
            userId,
            type: "transfer",
            amount: absAmount,
            category: outRow.mainCategory || "轉帳",
            subcategory: outRow.subCategory || undefined,
            date: transferDate,
            billingDate: transferDate,
            note: note || undefined,
            account: fromAccountId,
            toAccount: toAccountId,
            fee,
            discount: disc,
            merchant: outRow.merchant || undefined,
            project: outRow.project || undefined,
            tags: parseTags(outRow.tags),
          },
        ],
        { session },
      );
      stats.imported++;
    }

    // Create normal records
    for (const { row } of normalRows) {
      const mozeType = row.recordType;
      let recordType = TYPE_MAP[mozeType];

      // Handle unmapped types
      if (!recordType) {
        stats.skipped++;
        continue;
      }

      // transfer_out/transfer_in that didn't get paired
      if (recordType === "transfer_out") recordType = "transfer";
      if (recordType === "transfer_in") recordType = "transfer";

      const accountId = accountCache.get(row.account);
      if (!accountId) {
        stats.skipped++;
        continue;
      }

      const rawAmount = parseFloat(row.amount) || 0;
      const absAmount = recordType === "balance_adjustment" ? rawAmount : Math.abs(rawAmount);
      const fee = Math.abs(parseFloat(row.fee) || 0);
      const disc = Math.abs(parseFloat(row.discount) || 0);
      const rawNote = buildNote(row.name, row.description);
      const note = recordType === "balance_adjustment" ? (rawNote ? `MOZE 餘額校正 - ${rawNote}` : "MOZE 餘額校正") : rawNote;
      const tags = parseTags(row.tags);

      const recordDate = parseDate(row.date, row.time);
      await RecordModel.create(
        [
          {
            userId,
            type: recordType,
            amount: absAmount,
            category: row.mainCategory,
            subcategory: row.subCategory || undefined,
            date: recordDate,
            billingDate: recordDate,
            note: note || undefined,
            account: accountId,
            fee,
            discount: disc,
            merchant: row.merchant || undefined,
            counterparty: row.counterparty || undefined,
            project: row.project || undefined,
            tags,
          },
        ],
        { session },
      );
      stats.imported++;
    }

    await session.commitTransaction();
    res.json({ success: true, data: stats });
  } catch (error) {
    await session.abortTransaction();
    console.error("MOZE import error:", error);
    res.status(500).json({
      success: false,
      error: "Import failed",
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    session.endSession();
  }
});
