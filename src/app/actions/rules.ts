"use server";

import { refresh } from "next/cache";
import { getDb } from "@/server/db/client";
import { requireChild, requireParentWithFamily } from "@/server/auth/next";
import { cancelProposal, createProposal } from "@/server/domain/adhoc-proposals";
import { getBalance, recordAdjustment } from "@/server/domain/ledger";
import { applyAdhoc, applyRule, createRule, setRuleHidden, updateRule } from "@/server/domain/rules";
import { approveClaim, cancelClaim, createClaim, rejectClaim } from "@/server/domain/rule-claims";
import { signed } from "@/lib/time";
import { fromError, int, str, type ActionState } from "./result";

// Server Actions cho rule, thưởng/phạt, khai rule, đề xuất ngoài rule và điều chỉnh.

/** Thưởng/phạt theo rule hoặc đột xuất. Trả về mức thực ghi và số dư mới để phát âm thanh, hiện thông báo. */
export async function applyAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  const db = getDb();
  const childId = int(form, "childId");
  try {
    const choice = str(form, "choice");
    const txn =
      choice === "adhoc"
        ? await applyAdhoc(db, { familyId: auth.familyId, actorParentId: auth.parentId, childId, kind: str(form, "kind"), points: int(form, "points"), reason: str(form, "reason") })
        : await applyRule(db, { familyId: auth.familyId, actorParentId: auth.parentId, childId, ruleId: Number(choice), note: str(form, "note") });
    const balance = await getBalance(db, childId);
    refresh();
    return {
      ok: true,
      message: `Đã ghi: ${txn.description} ${signed(txn.appliedAmount)}`,
      data: { applied: String(txn.appliedAmount), requested: String(txn.requestedAmount), balance: String(balance), nonce: String(txn.id) },
    };
  } catch (err) {
    return fromError(err, { action: "applyAction", auth: auth, form });
  }
}

export async function createRuleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const rule = await createRule(getDb(), auth.familyId, { name: str(form, "name"), kind: str(form, "kind"), points: int(form, "points") });
    refresh();
    return { ok: true, message: `Đã thêm rule "${rule.name}"` };
  } catch (err) {
    return fromError(err, { action: "createRuleAction", auth: auth, form });
  }
}

export async function updateRuleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const rule = await updateRule(getDb(), auth.familyId, int(form, "ruleId"), { name: str(form, "name"), points: int(form, "points") });
    refresh();
    return { ok: true, message: `Đã lưu "${rule.name}". Giao dịch cũ không đổi.` };
  } catch (err) {
    return fromError(err, { action: "updateRuleAction", auth: auth, form });
  }
}

export async function toggleRuleHiddenAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const rule = await setRuleHidden(getDb(), auth.familyId, int(form, "ruleId"), str(form, "hidden") === "1");
    refresh();
    return { ok: true, message: rule.hidden ? `Đã ẩn "${rule.name}"` : `Đã hiện lại "${rule.name}"` };
  } catch (err) {
    return fromError(err, { action: "toggleRuleHiddenAction", auth: auth, form });
  }
}

export async function adjustTransactionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const txn = await recordAdjustment(getDb(), { familyId: auth.familyId, originalTransactionId: int(form, "transactionId"), reason: str(form, "reason"), actorParentId: auth.parentId });
    refresh();
    return { ok: true, message: `Đã ghi điều chỉnh ${signed(txn.appliedAmount)}` };
  } catch (err) {
    return fromError(err, { action: "adjustTransactionAction", auth: auth, form });
  }
}

export async function approveClaimAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    const txn = await approveClaim(getDb(), { familyId: auth.familyId, actorParentId: auth.parentId, claimId: int(form, "id") });
    refresh();
    return { ok: true, message: `Đã duyệt ${signed(txn.appliedAmount)}`, data: { applied: String(txn.appliedAmount) } };
  } catch (err) {
    return fromError(err, { action: "approveClaimAction", auth: auth, form });
  }
}

export async function rejectClaimAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const auth = await requireParentWithFamily();
  try {
    await rejectClaim(getDb(), { familyId: auth.familyId, actorParentId: auth.parentId, claimId: int(form, "id"), reason: str(form, "reason") });
    refresh();
    return { ok: true, message: "Đã từ chối" };
  } catch (err) {
    return fromError(err, { action: "rejectClaimAction", auth: auth, form });
  }
}

// ---- Phía con ----

export async function claimRuleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    const claim = await createClaim(getDb(), { familyId: kid.familyId, childId: kid.childId, ruleId: int(form, "ruleId"), note: str(form, "note") });
    refresh();
    return { ok: true, message: `Đã gửi "${claim.nameSnapshot}" cho bố mẹ duyệt` };
  } catch (err) {
    return fromError(err, { action: "claimRuleAction", auth: kid, form });
  }
}

export async function cancelClaimAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    await cancelClaim(getDb(), { childId: kid.childId, claimId: int(form, "id") });
    refresh();
    return { ok: true, message: "Đã hủy yêu cầu" };
  } catch (err) {
    return fromError(err, { action: "cancelClaimAction", auth: kid, form });
  }
}

/** Con gửi đề xuất thưởng/phạt ngoài rule cho chính mình; `childId` chỉ lấy từ phiên. */
export async function createProposalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    const proposal = await createProposal(getDb(), {
      familyId: kid.familyId,
      childId: kid.childId,
      kind: str(form, "kind"),
      description: str(form, "description"),
      points: int(form, "points"),
    });
    refresh();
    return { ok: true, message: `Đã gửi "${proposal.description}" cho bố mẹ duyệt`, data: { nonce: String(proposal.id) } };
  } catch (err) {
    return fromError(err, { action: "createProposalAction", auth: kid, form });
  }
}

export async function cancelProposalAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const kid = await requireChild();
  try {
    await cancelProposal(getDb(), { childId: kid.childId, proposalId: int(form, "id") });
    refresh();
    return { ok: true, message: "Đã hủy yêu cầu" };
  } catch (err) {
    return fromError(err, { action: "cancelProposalAction", auth: kid, form });
  }
}
